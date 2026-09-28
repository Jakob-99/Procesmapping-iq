"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { SUBPROCESS_STATUS, STEP_TYPES, isGateway, type StepType } from "@/lib/domain";
import { requireSessionUser } from "@/lib/session";
import { ensureLane } from "@/lib/process-lanes";
import { runProcessAgent } from "@/lib/process-agent";
import {
  assertDataObjectOwnership,
  assertRoleOwnership,
  assertSubProcessOwnership,
  assertSystemOwnership,
  assertUserInEngagement,
} from "@/lib/ownership";

function path(processId: string, subId: string) {
  return `/processes/${processId}/${subId}`;
}

function revalidate(processId: string, subProcessId: string) {
  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

// Titlen kan rettes direkte fra procesoversigten — man behøver ikke åbne
// underprocessens egen arbejdsflade for en simpel omdøbning.
export async function renameSubProcess(processId: string, subProcessId: string, name: string) {
  if (!name.trim()) return;
  await assertSubProcessOwnership(subProcessId);
  await db.subProcess.update({ where: { id: subProcessId }, data: { name: name.trim() } });
  revalidate(processId, subProcessId);
}

// Sletter underprocessen og alt der hænger under den (skridt, pile,
// svimlaner, koblinger, chat — cascader via skemaet).
export async function deleteSubProcess(processId: string, subProcessId: string) {
  await assertSubProcessOwnership(subProcessId);
  await db.subProcess.delete({ where: { id: subProcessId } });
  revalidatePath(`/processes/${processId}`);
  revalidatePath("/processes");
}

export async function setSubProcessStatus(processId: string, subProcessId: string, status: string) {
  if (!(status in SUBPROCESS_STATUS)) return;
  await assertSubProcessOwnership(subProcessId);
  await db.subProcess.update({ where: { id: subProcessId }, data: { status } });
  revalidate(processId, subProcessId);
}

// Ude af scope: underprocessen står stadig i procesmodellen, men tæller ikke
// med i dækningsgraden og vises med stiplet kant.
export async function setSubProcessScope(processId: string, subProcessId: string, inScope: boolean) {
  await assertSubProcessOwnership(subProcessId);
  await db.subProcess.update({ where: { id: subProcessId }, data: { inScope } });
  revalidate(processId, subProcessId);
  revalidatePath("/");
}

// Hvem der er ansvarlig for underprocessen — kan sættes både fra
// procesoversigten og inde fra underprocessens egen arbejdsflade.
export async function setAssignee(processId: string, subProcessId: string, userId: string | null) {
  await assertSubProcessOwnership(subProcessId);
  if (userId) await assertUserInEngagement(userId);
  await db.subProcess.update({ where: { id: subProcessId }, data: { assigneeId: userId || null } });
  revalidate(processId, subProcessId);
}

async function assertStepInSubProcess(subProcessId: string, stepId: string) {
  const step = await db.processStep.findUnique({ where: { id: stepId }, select: { subProcessId: true } });
  return !!step && step.subProcessId === subProcessId;
}

// Hvem/hvad der udfører et skridt — en rolle fra /roles eller et system fra
// /landscape. Præcis ét af actorRoleId/actorSystemId sættes, det andet
// ryddes. Er aktøren et system, oprettes også et StepSystem-link, så
// systemet altid "ved" hvilke skridt der ligger i dets svimlane.
export async function setStepActor(
  processId: string,
  subProcessId: string,
  stepId: string,
  actor: { type: "role" | "system"; id: string } | null,
) {
  await assertSubProcessOwnership(subProcessId);
  if (!(await assertStepInSubProcess(subProcessId, stepId))) return;
  if (actor?.type === "role") await assertRoleOwnership(actor.id);
  if (actor?.type === "system") await assertSystemOwnership(actor.id);

  await db.processStep.update({
    where: { id: stepId },
    data: {
      actorRoleId: actor?.type === "role" ? actor.id : null,
      actorSystemId: actor?.type === "system" ? actor.id : null,
    },
  });

  if (actor?.type === "system") {
    await db.stepSystem.upsert({
      where: { stepId_systemId: { stepId, systemId: actor.id } },
      update: {},
      create: { stepId, systemId: actor.id, usage: "BOTH" },
    });
  }
  if (actor) await ensureLane(subProcessId, actor);

  revalidate(processId, subProcessId);
}

async function assertPoolInSubProcess(subProcessId: string, poolId: string) {
  const pool = await db.processPool.findUnique({ where: { id: poolId }, select: { subProcessId: true } });
  if (!pool || pool.subProcessId !== subProcessId) throw new Error("Ikke fundet.");
}

// poolId null = hovedpoolen (titlen er underprocessens navn).
export async function createLane(
  processId: string,
  subProcessId: string,
  actor: { type: "role" | "system"; id: string },
  poolId: string | null = null,
) {
  await assertSubProcessOwnership(subProcessId);
  if (actor.type === "role") await assertRoleOwnership(actor.id);
  else await assertSystemOwnership(actor.id);
  if (poolId) await assertPoolInSubProcess(subProcessId, poolId);

  const lane = await ensureLane(subProcessId, actor, poolId);
  revalidatePath(path(processId, subProcessId));
  return lane;
}

// Flytter en svimlane til en anden pool (eller tilbage til hovedpoolen).
export async function setLanePool(
  processId: string,
  subProcessId: string,
  laneId: string,
  poolId: string | null,
) {
  await assertSubProcessOwnership(subProcessId);
  const lane = await db.processLane.findUnique({ where: { id: laneId } });
  if (!lane || lane.subProcessId !== subProcessId || lane.isDefault) return;
  if (poolId) await assertPoolInSubProcess(subProcessId, poolId);
  await db.processLane.update({ where: { id: laneId }, data: { poolId } });
  revalidatePath(path(processId, subProcessId));
}

// ---------------------------------------------------------------- Pools

// En ny pool — fx en ekstern part som "Rekrutteringspartner". Oprettes med
// sin første svimlane med det samme, for en tom pool har intet at vise.
export async function createPool(
  processId: string,
  subProcessId: string,
  name: string,
  firstActor: { type: "role" | "system"; id: string } | null,
) {
  if (!name.trim()) return;
  await assertSubProcessOwnership(subProcessId);
  if (firstActor?.type === "role") await assertRoleOwnership(firstActor.id);
  if (firstActor?.type === "system") await assertSystemOwnership(firstActor.id);

  const last = await db.processPool.findFirst({ where: { subProcessId }, orderBy: { sortOrder: "desc" } });
  const pool = await db.processPool.create({
    data: { subProcessId, name: name.trim(), sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  if (firstActor) {
    const lane = await ensureLane(subProcessId, firstActor, pool.id);
    // Fandtes svimlanen allerede (i en anden pool), flyttes den herover.
    if (lane.poolId !== pool.id) await db.processLane.update({ where: { id: lane.id }, data: { poolId: pool.id } });
  }
  revalidatePath(path(processId, subProcessId));
  return pool;
}

export async function renamePool(processId: string, subProcessId: string, poolId: string, name: string) {
  if (!name.trim()) return;
  await assertSubProcessOwnership(subProcessId);
  await assertPoolInSubProcess(subProcessId, poolId);
  await db.processPool.update({ where: { id: poolId }, data: { name: name.trim() } });
  revalidatePath(path(processId, subProcessId));
}

// Sletter kun rammen — svimlanerne i den flytter tilbage til hovedpoolen
// (poolId sættes til null via skemaets onDelete: SetNull).
export async function deletePool(processId: string, subProcessId: string, poolId: string) {
  await assertSubProcessOwnership(subProcessId);
  await assertPoolInSubProcess(subProcessId, poolId);
  await db.processPool.delete({ where: { id: poolId } });
  revalidatePath(path(processId, subProcessId));
}

// Skifter hvilken rolle/system en eksisterende svimlane repræsenterer — alle
// skridt der sidder i lanen flytter med.
export async function setLaneActor(
  processId: string,
  subProcessId: string,
  laneId: string,
  actor: { type: "role" | "system"; id: string },
) {
  await assertSubProcessOwnership(subProcessId);
  const lane = await db.processLane.findUnique({ where: { id: laneId } });
  if (!lane || lane.subProcessId !== subProcessId) return;
  if (actor.type === "role") await assertRoleOwnership(actor.id);
  else await assertSystemOwnership(actor.id);

  const conflict = await db.processLane.findFirst({
    where: {
      subProcessId,
      id: { not: laneId },
      actorRoleId: actor.type === "role" ? actor.id : null,
      actorSystemId: actor.type === "system" ? actor.id : null,
    },
  });
  if (conflict) throw new Error("Der findes allerede en svimlane med denne aktør.");

  const steps = await db.processStep.findMany({
    where: { subProcessId, actorRoleId: lane.actorRoleId, actorSystemId: lane.actorSystemId },
    select: { id: true },
  });
  for (const s of steps) await setStepActor(processId, subProcessId, s.id, actor);

  await db.processLane.update({
    where: { id: laneId },
    data: {
      actorRoleId: actor.type === "role" ? actor.id : null,
      actorSystemId: actor.type === "system" ? actor.id : null,
    },
  });
  revalidate(processId, subProcessId);
}

// Sletter en svimlane (aldrig den grundlæggende) — skridtene der sad i den
// mister deres aktør og falder tilbage i den grundlæggende lane.
export async function deleteLane(processId: string, subProcessId: string, laneId: string) {
  await assertSubProcessOwnership(subProcessId);
  const lane = await db.processLane.findUnique({ where: { id: laneId } });
  if (!lane || lane.subProcessId !== subProcessId) return;
  if (lane.isDefault) throw new Error("Den grundlæggende svimlane kan ikke slettes.");

  await db.processStep.updateMany({
    where: { subProcessId, actorRoleId: lane.actorRoleId, actorSystemId: lane.actorSystemId },
    data: { actorRoleId: null, actorSystemId: null },
  });
  await db.processLane.delete({ where: { id: laneId } });
  revalidate(processId, subProcessId);
}

// Koblingen mellem et skridt og et IT-system det bruger — vises som
// [System] under aktiviteten i diagrammet.
export async function linkStepSystem(
  processId: string,
  subProcessId: string,
  stepId: string,
  systemId: string,
  usage: "READ" | "WRITE" | "BOTH",
) {
  await assertSubProcessOwnership(subProcessId);
  await assertSystemOwnership(systemId);
  if (!(await assertStepInSubProcess(subProcessId, stepId))) return;

  await db.stepSystem.upsert({
    where: { stepId_systemId: { stepId, systemId } },
    update: { usage },
    create: { stepId, systemId, usage },
  });
  revalidate(processId, subProcessId);
}

export async function unlinkStepSystem(processId: string, subProcessId: string, stepSystemId: string) {
  await assertSubProcessOwnership(subProcessId);
  const link = await db.stepSystem.findUnique({
    where: { id: stepSystemId },
    select: { step: { select: { subProcessId: true } } },
  });
  if (!link || link.step.subProcessId !== subProcessId) return;
  await db.stepSystem.delete({ where: { id: stepSystemId } });
  revalidate(processId, subProcessId);
}

// Koblingen mellem et skridt og et dataobjekt det bruger/producerer — tegnes
// som et dokument-ikon ved siden af aktiviteten, med pil ind eller ud.
export async function linkStepData(
  processId: string,
  subProcessId: string,
  stepId: string,
  dataObjectId: string,
  direction: "INPUT" | "OUTPUT" | "BOTH",
) {
  await assertSubProcessOwnership(subProcessId);
  await assertDataObjectOwnership(dataObjectId);
  if (!(await assertStepInSubProcess(subProcessId, stepId))) return;

  await db.stepData.upsert({
    where: { stepId_dataObjectId: { stepId, dataObjectId } },
    update: { direction },
    create: { stepId, dataObjectId, direction },
  });
  revalidate(processId, subProcessId);
}

export async function unlinkStepData(processId: string, subProcessId: string, stepDataId: string) {
  await assertSubProcessOwnership(subProcessId);
  const link = await db.stepData.findUnique({
    where: { id: stepDataId },
    select: { step: { select: { subProcessId: true } } },
  });
  if (!link || link.step.subProcessId !== subProcessId) return;
  await db.stepData.delete({ where: { id: stepDataId } });
  revalidate(processId, subProcessId);
}

// De øvrige felter pr. skridt — frekvens, varighed, smertepunkt,
// beslutningsgrundlag og resultat. Samlet i ét gem-kald.
export async function updateStepDetails(
  processId: string,
  subProcessId: string,
  stepId: string,
  data: {
    frequency: string;
    durationMin: number | null;
    painPoint: string;
    decisionCriteria: string;
    output: string;
  },
) {
  await assertSubProcessOwnership(subProcessId);
  if (!(await assertStepInSubProcess(subProcessId, stepId))) return;

  await db.processStep.update({
    where: { id: stepId },
    data: {
      frequency: data.frequency.trim() || null,
      durationMin: data.durationMin,
      painPoint: data.painPoint.trim() || null,
      decisionCriteria: data.decisionCriteria.trim() || null,
      output: data.output.trim() || null,
    },
  });
  revalidatePath(path(processId, subProcessId));
}

// ------------------------------------------------- Direkte redigering af diagrammet


// Svimlanens aktør — den grundlæggende lane betyder ingen aktør.
async function actorOfLane(subProcessId: string, laneId: string | null) {
  if (!laneId) return { actorRoleId: null, actorSystemId: null };
  const lane = await db.processLane.findUnique({ where: { id: laneId } });
  if (!lane || lane.subProcessId !== subProcessId) throw new Error("Ikke fundet.");
  return { actorRoleId: lane.actorRoleId, actorSystemId: lane.actorSystemId };
}

// Skriver rækkefølgen om, så sortOrder altid er 0..n-1 i den givne orden.
async function resequence(orderedIds: string[]) {
  await db.$transaction(
    orderedIds.map((id, i) => db.processStep.update({ where: { id }, data: { sortOrder: i } })),
  );
}

async function orderedStepIds(subProcessId: string) {
  const steps = await db.processStep.findMany({
    where: { subProcessId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  return steps.map((s) => s.id);
}

// Nyt element. Med afterStepId sættes det ind lige efter det skridt: de pile
// der før gik ud af det skridt, går nu ud af det nye, og der tegnes en pil
// fra skridtet til det nye — så forløbet hænger sammen uden efterarbejde.
// Er afterStepId en gateway, bliver det nye element i stedet en ny gren:
// kun en ekstra pil ud fra gatewayen (med evt. etiket), de andre grene
// bliver hvor de er.
export async function addStep(
  processId: string,
  subProcessId: string,
  data: {
    type: StepType;
    name: string;
    laneId: string | null;
    afterStepId: string | null;
    branchLabel?: string;
  },
) {
  await assertSubProcessOwnership(subProcessId);
  const type: StepType = STEP_TYPES.includes(data.type) ? data.type : "TASK";
  const actor = await actorOfLane(subProcessId, data.laneId);
  if (data.afterStepId && !(await assertStepInSubProcess(subProcessId, data.afterStepId))) return;

  const created = await db.processStep.create({
    data: { subProcessId, stepType: type, name: data.name.trim(), ...actor, sortOrder: 9999 },
  });

  const ids = (await orderedStepIds(subProcessId)).filter((id) => id !== created.id);
  const after = data.afterStepId
    ? await db.processStep.findUnique({ where: { id: data.afterStepId }, select: { stepType: true } })
    : null;
  if (data.afterStepId && after && isGateway(after.stepType)) {
    // Ny gren: læg den efter gatewayens sidste nuværende gren i rækkefølgen,
    // så grenene står i den orden de er oprettet.
    const branchTargets = await db.processFlow.findMany({
      where: { fromStepId: data.afterStepId },
      select: { toStepId: true },
    });
    const lastBranch = Math.max(ids.indexOf(data.afterStepId), ...branchTargets.map((b) => ids.indexOf(b.toStepId)));
    ids.splice(lastBranch + 1, 0, created.id);
    await db.processFlow.create({
      data: {
        subProcessId,
        fromStepId: data.afterStepId,
        toStepId: created.id,
        label: data.branchLabel?.trim() || null,
      },
    });
  } else if (data.afterStepId) {
    ids.splice(ids.indexOf(data.afterStepId) + 1, 0, created.id);
    if (type !== "START") {
      await db.processFlow.updateMany({
        where: { subProcessId, fromStepId: data.afterStepId },
        data: { fromStepId: created.id },
      });
      await db.processFlow.create({
        data: { subProcessId, fromStepId: data.afterStepId, toStepId: created.id },
      });
    }
  } else {
    // Uden placering: før den første sluthændelse, ellers til sidst.
    const all = await db.processStep.findMany({ where: { id: { in: ids } }, select: { id: true, stepType: true } });
    const typeOf = new Map(all.map((s) => [s.id, s.stepType]));
    const firstEnd = type === "END" ? -1 : ids.findIndex((id) => typeOf.get(id) === "END");
    if (type === "START") ids.unshift(created.id);
    else if (firstEnd >= 0) ids.splice(firstEnd, 0, created.id);
    else ids.push(created.id);
  }
  await resequence(ids);
  revalidatePath(path(processId, subProcessId));
  return created.id;
}

export async function updateStep(
  processId: string,
  subProcessId: string,
  stepId: string,
  data: { name?: string; type?: StepType },
) {
  await assertSubProcessOwnership(subProcessId);
  if (!(await assertStepInSubProcess(subProcessId, stepId))) return;
  await db.processStep.update({
    where: { id: stepId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.type && STEP_TYPES.includes(data.type) ? { stepType: data.type } : {}),
    },
  });
  revalidatePath(path(processId, subProcessId));
}

// Flytter et skridt: til en anden svimlane og/eller en anden plads i
// rækkefølgen. position er et indeks i den nye rækkefølge (uden skridtet
// selv); udeladt beholdes pladsen.
export async function moveStep(
  processId: string,
  subProcessId: string,
  stepId: string,
  data: { laneId?: string | null; position?: number },
) {
  await assertSubProcessOwnership(subProcessId);
  if (!(await assertStepInSubProcess(subProcessId, stepId))) return;

  if (data.laneId !== undefined) {
    const actor = await actorOfLane(subProcessId, data.laneId);
    await db.processStep.update({ where: { id: stepId }, data: actor });
    if (actor.actorSystemId) {
      await db.stepSystem.upsert({
        where: { stepId_systemId: { stepId, systemId: actor.actorSystemId } },
        update: {},
        create: { stepId, systemId: actor.actorSystemId, usage: "BOTH" },
      });
    }
  }
  if (data.position !== undefined) {
    const ids = (await orderedStepIds(subProcessId)).filter((id) => id !== stepId);
    const pos = Math.max(0, Math.min(ids.length, Math.round(data.position)));
    ids.splice(pos, 0, stepId);
    await resequence(ids);
  }
  revalidate(processId, subProcessId);
}

// Sletter et skridt og syr forløbet sammen igen: alle der pegede på det,
// peger nu på dem det pegede videre til (hvis der var nogen på begge sider).
export async function deleteStep(processId: string, subProcessId: string, stepId: string) {
  await assertSubProcessOwnership(subProcessId);
  if (!(await assertStepInSubProcess(subProcessId, stepId))) return;
  const [incoming, outgoing] = await Promise.all([
    db.processFlow.findMany({ where: { toStepId: stepId } }),
    db.processFlow.findMany({ where: { fromStepId: stepId } }),
  ]);
  for (const i of incoming) {
    for (const o of outgoing) {
      if (i.fromStepId === o.toStepId) continue;
      const exists = await db.processFlow.findFirst({ where: { fromStepId: i.fromStepId, toStepId: o.toStepId } });
      if (!exists) {
        await db.processFlow.create({
          data: { subProcessId, fromStepId: i.fromStepId, toStepId: o.toStepId, label: i.label },
        });
      }
    }
  }
  await db.processStep.delete({ where: { id: stepId } });
  await resequence(await orderedStepIds(subProcessId));
  revalidate(processId, subProcessId);
}

export async function addFlow(processId: string, subProcessId: string, fromStepId: string, toStepId: string) {
  if (fromStepId === toStepId) return;
  await assertSubProcessOwnership(subProcessId);
  if (!(await assertStepInSubProcess(subProcessId, fromStepId))) return;
  if (!(await assertStepInSubProcess(subProcessId, toStepId))) return;
  const exists = await db.processFlow.findFirst({ where: { fromStepId, toStepId } });
  if (!exists) await db.processFlow.create({ data: { subProcessId, fromStepId, toStepId } });
  revalidatePath(path(processId, subProcessId));
}

async function flowInSubProcess(subProcessId: string, fromStepId: string, toStepId: string) {
  const flow = await db.processFlow.findFirst({ where: { fromStepId, toStepId } });
  if (!flow || flow.subProcessId !== subProcessId) throw new Error("Ikke fundet.");
  return flow;
}

export async function updateFlow(
  processId: string,
  subProcessId: string,
  fromStepId: string,
  toStepId: string,
  data: { label?: string; kind?: "SEQUENCE" | "MESSAGE" },
) {
  await assertSubProcessOwnership(subProcessId);
  const flow = await flowInSubProcess(subProcessId, fromStepId, toStepId);
  await db.processFlow.update({
    where: { id: flow.id },
    data: {
      ...(data.label !== undefined ? { label: data.label.trim() || null } : {}),
      ...(data.kind ? { kind: data.kind === "MESSAGE" ? "MESSAGE" : "SEQUENCE" } : {}),
    },
  });
  revalidatePath(path(processId, subProcessId));
}

export async function deleteFlow(processId: string, subProcessId: string, fromStepId: string, toStepId: string) {
  await assertSubProcessOwnership(subProcessId);
  const flow = await flowInSubProcess(subProcessId, fromStepId, toStepId);
  await db.processFlow.delete({ where: { id: flow.id } });
  revalidatePath(path(processId, subProcessId));
}

// ------------------------------------------------------------ Noter på tegnefladen

async function assertNoteInSubProcess(subProcessId: string, noteId: string) {
  const n = await db.processNote.findUnique({ where: { id: noteId }, select: { subProcessId: true } });
  if (!n || n.subProcessId !== subProcessId) throw new Error("Ikke fundet.");
}

export async function addNote(processId: string, subProcessId: string, x: number, y: number) {
  await assertSubProcessOwnership(subProcessId);
  const note = await db.processNote.create({
    data: { subProcessId, x: Math.max(0, x), y: Math.max(0, y) },
  });
  revalidatePath(path(processId, subProcessId));
  return note.id;
}

export async function updateNote(
  processId: string,
  subProcessId: string,
  noteId: string,
  data: { text?: string; x?: number; y?: number },
) {
  await assertSubProcessOwnership(subProcessId);
  await assertNoteInSubProcess(subProcessId, noteId);
  await db.processNote.update({
    where: { id: noteId },
    data: {
      ...(data.text !== undefined ? { text: data.text } : {}),
      ...(data.x !== undefined ? { x: Math.max(0, data.x) } : {}),
      ...(data.y !== undefined ? { y: Math.max(0, data.y) } : {}),
    },
  });
  revalidatePath(path(processId, subProcessId));
}

export async function deleteNote(processId: string, subProcessId: string, noteId: string) {
  await assertSubProcessOwnership(subProcessId);
  await assertNoteInSubProcess(subProcessId, noteId);
  await db.processNote.delete({ where: { id: noteId } });
  revalidatePath(path(processId, subProcessId));
}

// ---------------------------------------------------------------- Analyse

const FINDING_KINDS = ["PROBLEM", "WISH", "IDEA"] as const;
type FindingKind = (typeof FINDING_KINDS)[number];

async function assertFindingInSubProcess(subProcessId: string, findingId: string) {
  const f = await db.processFinding.findUnique({ where: { id: findingId }, select: { subProcessId: true } });
  if (!f || f.subProcessId !== subProcessId) throw new Error("Ikke fundet.");
}

export async function addFinding(
  processId: string,
  subProcessId: string,
  kind: FindingKind,
  text: string,
  stepId: string | null,
) {
  if (!text.trim() || !FINDING_KINDS.includes(kind)) return;
  await assertSubProcessOwnership(subProcessId);
  if (stepId && !(await assertStepInSubProcess(subProcessId, stepId))) stepId = null;
  const last = await db.processFinding.findFirst({
    where: { subProcessId, kind },
    orderBy: { sortOrder: "desc" },
  });
  await db.processFinding.create({
    data: { subProcessId, kind, text: text.trim(), stepId, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  revalidatePath(path(processId, subProcessId));
}

export async function updateFinding(
  processId: string,
  subProcessId: string,
  findingId: string,
  data: { text?: string; stepId?: string | null },
) {
  await assertSubProcessOwnership(subProcessId);
  await assertFindingInSubProcess(subProcessId, findingId);
  let stepId = data.stepId;
  if (stepId && !(await assertStepInSubProcess(subProcessId, stepId))) stepId = null;
  await db.processFinding.update({
    where: { id: findingId },
    data: {
      ...(data.text?.trim() ? { text: data.text.trim() } : {}),
      ...(stepId !== undefined ? { stepId } : {}),
    },
  });
  revalidatePath(path(processId, subProcessId));
}

export async function deleteFinding(processId: string, subProcessId: string, findingId: string) {
  await assertSubProcessOwnership(subProcessId);
  await assertFindingInSubProcess(subProcessId, findingId);
  await db.processFinding.delete({ where: { id: findingId } });
  revalidatePath(path(processId, subProcessId));
}

/*
  Chatten under diagrammet: brugerens besked gemmes, agenten får hele
  processen som den ser ud nu og svarer med en besked og — hvis den skal
  ændres — den nye udgave, som anvendes på databasen. Svaret gemmes også, så
  samtalen kan læses igen næste gang.
*/
export async function sendProcessChat(processId: string, subProcessId: string, message: string) {
  if (!message.trim()) return { ok: false as const, error: "Tom besked." };
  await assertSubProcessOwnership(subProcessId);
  const user = await requireSessionUser();

  await db.processChatMessage.create({
    data: { subProcessId, role: "user", content: message.trim(), userName: user.name },
  });

  try {
    const result = await runProcessAgent(subProcessId);
    await db.processChatMessage.create({
      data: { subProcessId, role: "agent", content: result.reply },
    });
    revalidate(processId, subProcessId);
    return { ok: true as const, changed: result.changed };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.processChatMessage.create({
      data: { subProcessId, role: "agent", content: `Jeg kunne ikke gennemføre ændringen: ${error}` },
    });
    revalidatePath(path(processId, subProcessId));
    return { ok: false as const, error };
  }
}

export async function clearProcessChat(processId: string, subProcessId: string) {
  await assertSubProcessOwnership(subProcessId);
  await db.processChatMessage.deleteMany({ where: { subProcessId } });
  revalidatePath(path(processId, subProcessId));
}

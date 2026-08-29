"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { splitEvents, joinEvents } from "@/lib/domain";
import { ensureLoginCode } from "@/lib/interview-auth";
import { requireSessionUser } from "@/lib/session";
import { generateStepsFromInterview } from "@/lib/step-extraction";
import {
  assertDataObjectOwnership,
  assertExpertOwnership,
  assertRoleOwnership,
  assertSubProcessOwnership,
  assertSystemOwnership,
  assertUserInEngagement,
} from "@/lib/ownership";

function path(processId: string, subId: string) {
  return `/processes/${processId}/${subId}`;
}

// Underprocessen kan have flere "starter når"/"slutter når"-hændelser —
// gemt i samme fritekstfelt, adskilt af linjeskift (se splitEvents/joinEvents).
export async function addTrigger(
  processId: string,
  subProcessId: string,
  field: "startEvent" | "endEvent",
  value: string,
) {
  if (!value.trim()) return;
  await assertSubProcessOwnership(subProcessId);
  const sp = await db.subProcess.findUnique({
    where: { id: subProcessId },
    select: { startEvent: true, endEvent: true },
  });
  if (!sp) return;
  const events = splitEvents(sp[field]);
  events.push(value.trim());
  await db.subProcess.update({
    where: { id: subProcessId },
    data: { [field]: joinEvents(events) },
  });
  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

export async function removeTrigger(
  processId: string,
  subProcessId: string,
  field: "startEvent" | "endEvent",
  index: number,
) {
  await assertSubProcessOwnership(subProcessId);
  const sp = await db.subProcess.findUnique({
    where: { id: subProcessId },
    select: { startEvent: true, endEvent: true },
  });
  if (!sp) return;
  const events = splitEvents(sp[field]);
  events.splice(index, 1);
  await db.subProcess.update({
    where: { id: subProcessId },
    data: { [field]: joinEvents(events) },
  });
  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

// Titlen kan rettes direkte fra procesoversigten — man behøver ikke åbne
// underprocessens egen arbejdsflade for en simpel omdøbning.
export async function renameSubProcess(processId: string, subProcessId: string, name: string) {
  if (!name.trim()) return;
  await assertSubProcessOwnership(subProcessId);
  await db.subProcess.update({
    where: { id: subProcessId },
    data: { name: name.trim() },
  });
  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

// Sletter underprocessen og alt der hænger under den (skridt, interviews,
// validering — cascader via skemaet). Forbedringer der peger på den løsrives
// i stedet for at slettes med, samme forsigtighed som deleteProcess for hele
// e2e-processen (processes/actions.ts).
export async function deleteSubProcess(processId: string, subProcessId: string) {
  await assertSubProcessOwnership(subProcessId);
  await db.improvement.updateMany({
    where: { subProcessId },
    data: { subProcessId: null },
  });
  await db.subProcess.delete({ where: { id: subProcessId } });
  revalidatePath(`/processes/${processId}`);
  revalidatePath("/processes");
}

// Hvem der er tildelt til at blive interviewet — kan sættes både fra
// procesoversigten og inde fra underprocessens egen arbejdsflade.
export async function setAssignee(
  processId: string,
  subProcessId: string,
  userId: string | null,
) {
  await assertSubProcessOwnership(subProcessId);
  if (userId) await assertUserInEngagement(userId);
  await db.subProcess.update({
    where: { id: subProcessId },
    data: { assigneeId: userId || null },
  });
  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

// Hovedforløbet: næste skridt lægger sig altid i forlængelse af det forrige.
export async function addMainStep(
  processId: string,
  subProcessId: string,
  name: string,
  actorRoleId?: string,
  stepType?: string,
) {
  if (!name.trim()) return;
  await assertSubProcessOwnership(subProcessId);
  if (actorRoleId) await assertRoleOwnership(actorRoleId);
  const last = await db.processStep.findFirst({
    where: { subProcessId, lane: 0 },
    orderBy: { sortOrder: "desc" },
  });
  await db.processStep.create({
    data: {
      subProcessId,
      name: name.trim(),
      actorRoleId: actorRoleId || null,
      stepType: stepType === "DECISION" ? "DECISION" : "TASK",
      lane: 0,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath(path(processId, subProcessId));
}

// Et parallelt spor der forgrener fra et hovedskridt — kan enten smelte sammen
// med et andet hovedskridt bagefter, eller afslutte helt for sig selv.
export async function addBranchStep(
  processId: string,
  subProcessId: string,
  branchFromId: string,
  name: string,
  mergeIntoId: string | null,
  actorRoleId?: string,
) {
  if (!name.trim()) return;
  await assertSubProcessOwnership(subProcessId);
  if (actorRoleId) await assertRoleOwnership(actorRoleId);
  // branchFromId/mergeIntoId er ProcessStep-id'er valgt fra klienten — tjek de
  // rent faktisk hører til DENNE underproces, ikke en anden (evt. hos en
  // anden kunde), før de kobles på det nye skridt.
  const referenced = await db.processStep.findMany({
    where: { id: { in: [branchFromId, ...(mergeIntoId ? [mergeIntoId] : [])] }, subProcessId },
    select: { id: true },
  });
  if (!referenced.some((s) => s.id === branchFromId)) return;
  if (mergeIntoId && !referenced.some((s) => s.id === mergeIntoId)) return;

  const last = await db.processStep.findFirst({
    where: { subProcessId, branchFromId },
    orderBy: { sortOrder: "desc" },
  });
  await db.processStep.create({
    data: {
      subProcessId,
      name: name.trim(),
      actorRoleId: actorRoleId || null,
      lane: 1,
      branchFromId,
      mergeIntoId: mergeIntoId || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath(path(processId, subProcessId));
}

// bpmn-js's egne ID'er for vores skridt er "Task_<id>" / "Gateway_<id>" (se
// nid() i lib/bpmn.ts) — her strippes præfikset for at finde tilbage til
// ProcessStep-rækken. Figurer brugeren selv har tegnet har et andet ID-format
// og matcher intet — de behandles som nye skridt.
function stepIdFromNodeId(nodeId: string): string | null {
  const m = nodeId.match(/^(?:Task|Gateway)_(.+)$/);
  return m ? m[1] : null;
}

type DiagramNode = {
  id: string;
  name: string;
  type: "task" | "gateway";
  manual: boolean;
  laneId: string | null;
};

/*
  Gemmer et redigeret diagram. Brugeren tegner selv — sletter figurer, tilføjer
  nye, trækker pile om, trækker en figur hen over en svimlanegrænse — og her
  oversættes det tilbage til rigtige ProcessStep-rækker. Start- og
  slut-hændelsen rører vi aldrig: de kommer altid fra
  SubProcess.startEvent/endEvent, uanset hvad der står på figuren i editoren.

  node.laneId (se BpmnViewer.laneIdOf) er den svimlane figuren nu visuelt
  sidder i — trækkes den over i en anden svimlane, skal skridtets aktør
  ALTID følge med, ellers "springer" figuren stille og roligt tilbage til sin
  gamle lane ved næste gentegning (diagrammet er jo genereret af aktøren, se
  buildBpmnXml), hvilket er præcis den bug der skulle rettes her.
*/
export async function saveDiagram(
  processId: string,
  subProcessId: string,
  orderedNodes: DiagramNode[],
) {
  await assertSubProcessOwnership(subProcessId);
  const existing = await db.processStep.findMany({
    where: { subProcessId, lane: 0 },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((s) => s.id));
  const keptIds = new Set<string>();
  const lanes = await db.processLane.findMany({ where: { subProcessId } });
  const laneById = new Map(lanes.map((l) => [l.id, l]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [];
  // Node-index -> systemId, for den efterfølgende StepSystem-sikring — kan
  // først køres efter transaktionen, da nyoprettede skridt ikke har et id
  // før db.$transaction(ops) er kørt (se resultat-zip nedenfor).
  const systemLinksByIndex = new Map<number, string>();

  orderedNodes.forEach((node, index) => {
    const matchedId = stepIdFromNodeId(node.id);
    const stepType = node.type === "gateway" ? "DECISION" : "TASK";
    const lane = node.laneId ? laneById.get(node.laneId) : undefined;
    // Ukendt/manglende lane (fx en hånd-tegnet figur uden for enhver
    // svimlanes grænser) rører vi IKKE aktøren for — kun en genkendt lane må
    // ændre den, ellers nulstilles en gyldig aktør ved et uheld.
    const actorFields = lane
      ? { actorRoleId: lane.actorRoleId, actorSystemId: lane.actorSystemId }
      : {};
    if (lane?.actorSystemId) systemLinksByIndex.set(index, lane.actorSystemId);

    if (matchedId && existingIds.has(matchedId)) {
      keptIds.add(matchedId);
      ops.push(
        db.processStep.update({
          where: { id: matchedId },
          data: {
            name: node.name || "Unavngivet skridt",
            stepType,
            isManual: node.manual,
            sortOrder: index,
            ...actorFields,
          },
        }),
      );
    } else {
      ops.push(
        db.processStep.create({
          data: {
            subProcessId,
            name: node.name || "Unavngivet skridt",
            stepType,
            isManual: node.manual,
            lane: 0,
            sortOrder: index,
            ...actorFields,
          },
        }),
      );
    }
  });

  for (const id of existingIds) {
    if (!keptIds.has(id)) ops.push(db.processStep.delete({ where: { id } }));
  }

  const results = await db.$transaction(ops);

  // Samme StepSystem-sikring som setStepActor — svimlanens system-tilknytning
  // skal afspejles som et rigtigt datalink, ikke kun et visuelt navn, uanset
  // om aktøren blev sat via Aktør-vælgeren eller ved at trække figuren over i
  // system-svimlanen.
  if (systemLinksByIndex.size) {
    await Promise.all(
      Array.from(systemLinksByIndex, ([index, systemId]) => {
        const stepId = results[index]?.id as string | undefined;
        if (!stepId) return Promise.resolve();
        return db.stepSystem.upsert({
          where: { stepId_systemId: { stepId, systemId } },
          update: {},
          create: { stepId, systemId, usage: "BOTH" },
        });
      }),
    );
  }

  revalidatePath(path(processId, subProcessId));
}

// Hvem/hvad der udfører et skridt — enten en rolle fra /roles, eller et
// system fra /landscape (fx "CRM'et opretter selv ordrebekræftelsen"), valgt
// fra ægte lister i stedet for fritekst, så BPMN-lærredets svimlaner altid
// matcher. Præcis ét af actorRoleId/actorSystemId sættes, det andet ryddes.
// Vælges et system, oprettes/genbruges samtidig et StepSystem-link (usage
// BOTH som default) — swimlanen SKAL afspejles som et rigtigt datalink, ikke
// kun et visuelt navn. Fjernes aktøren igen bagefter, beholdes linket bevidst
// (afkobling er kun en eksplicit handling via Systemer-sektionen).
// Selvhelbredende: sikrer at der findes en ProcessLane-række for denne
// aktør i denne underproces, uden at oprette en dublet (se
// @@unique([subProcessId, actorRoleId, actorSystemId]) i schema.prisma) —
// kaldes både herfra (når et skridts aktør sættes) og fra createLane
// (når en svimlane oprettes direkte, uden endnu at have noget skridt).
// findFirst+create i stedet for upsert, fordi Prismas genererede type for et
// sammensat unikt nøgle-opslag ikke accepterer null for de nullable felter,
// selvom selve databaseindekset gør — se schema.prisma.
async function ensureLane(subProcessId: string, actor: { type: "role" | "system"; id: string }) {
  const where = {
    subProcessId,
    actorRoleId: actor.type === "role" ? actor.id : null,
    actorSystemId: actor.type === "system" ? actor.id : null,
  };
  const existing = await db.processLane.findFirst({ where });
  if (existing) return existing;
  return db.processLane.create({ data: where });
}

export async function setStepActor(
  processId: string,
  subProcessId: string,
  stepId: string,
  actor: { type: "role" | "system"; id: string } | null,
) {
  await assertSubProcessOwnership(subProcessId);
  const step = await db.processStep.findUnique({ where: { id: stepId }, select: { subProcessId: true } });
  if (!step || step.subProcessId !== subProcessId) return;

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

  // Svimlanen for denne aktør skal altid findes, uanset om brugeren satte
  // aktøren her fra Aktør-vælgeren eller den blev oprettet direkte som en
  // svimlane først — de to veje må aldrig kunne løbe fra hinanden.
  if (actor) await ensureLane(subProcessId, actor);

  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

// Svimlanerne er selvstændige objekter (ProcessLane) — der findes altid
// præcis én isDefault (ingen aktør, "Proces", oprettet sammen med
// underprocessen i createSubProcess), og brugeren bygger videre på den ved
// eksplicit at vælge en rolle eller et system, i stedet for at nye lanes
// stille og roligt dukker op af sig selv, så snart et skridt får en aktør.
export async function createLane(
  processId: string,
  subProcessId: string,
  actor: { type: "role" | "system"; id: string },
) {
  await assertSubProcessOwnership(subProcessId);
  if (actor.type === "role") await assertRoleOwnership(actor.id);
  else await assertSystemOwnership(actor.id);

  const lane = await ensureLane(subProcessId, actor);
  revalidatePath(path(processId, subProcessId));
  return lane;
}

// Skifter hvilken rolle/system en eksisterende svimlane repræsenterer — alle
// skridt der pt. sidder i lanen (dvs. har dens NUVÆRENDE aktør) flytter med,
// via samme setStepActor som Aktør-vælgeren bruger (så StepSystem-linket for
// et system-skifte oprettes helt ens, uanset hvilken vej man kom). Gælder
// også den grundlæggende svimlane — isDefault betyder kun "kan ikke slettes,
// findes altid", ikke "kan ikke have en aktør" (se deleteLane, som stadig
// nægter den).
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
  for (const s of steps) {
    await setStepActor(processId, subProcessId, s.id, actor);
  }

  await db.processLane.update({
    where: { id: laneId },
    data: {
      actorRoleId: actor.type === "role" ? actor.id : null,
      actorSystemId: actor.type === "system" ? actor.id : null,
    },
  });

  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

// Sletter en svimlane (aldrig den grundlæggende) — skridtene der sad i den
// mister deres aktør og falder tilbage i den grundlæggende lane, i stedet
// for at forsvinde eller efterlade et hængende id.
export async function deleteLane(processId: string, subProcessId: string, laneId: string) {
  await assertSubProcessOwnership(subProcessId);
  const lane = await db.processLane.findUnique({ where: { id: laneId } });
  if (!lane || lane.subProcessId !== subProcessId) return;
  if (lane.isDefault) throw new Error("Den grundlæggende svimlane kan ikke slettes.");

  const steps = await db.processStep.findMany({
    where: { subProcessId, actorRoleId: lane.actorRoleId, actorSystemId: lane.actorSystemId },
    select: { id: true },
  });
  for (const s of steps) {
    await setStepActor(processId, subProcessId, s.id, null);
  }

  await db.processLane.delete({ where: { id: laneId } });
  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

// Koblingen mellem et skridt og et IT-system det rører (læser/skriver data),
// valgt fra den eksisterende systemliste på /landscape eller nyoprettet
// samme sted fra (se StepDetailsPanel) — adskilt fra actorSystemId ovenfor,
// som er "systemet UDFØRER skridtet", ikke bare "rører data i det".
export async function linkStepSystem(
  processId: string,
  subProcessId: string,
  stepId: string,
  systemId: string,
  usage: "READ" | "WRITE" | "BOTH",
) {
  await assertSubProcessOwnership(subProcessId);
  await assertSystemOwnership(systemId);
  const step = await db.processStep.findUnique({ where: { id: stepId }, select: { subProcessId: true } });
  if (!step || step.subProcessId !== subProcessId) return;

  await db.stepSystem.upsert({
    where: { stepId_systemId: { stepId, systemId } },
    update: { usage },
    create: { stepId, systemId, usage },
  });
  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

export async function unlinkStepSystem(processId: string, subProcessId: string, stepSystemId: string) {
  await assertSubProcessOwnership(subProcessId);
  const link = await db.stepSystem.findUnique({
    where: { id: stepSystemId },
    select: { step: { select: { subProcessId: true } } },
  });
  if (!link || link.step.subProcessId !== subProcessId) return;

  await db.stepSystem.delete({ where: { id: stepSystemId } });
  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

// Koblingen mellem et skridt og et dataobjekt det bruger/producerer — samlet
// visuelt til "Input kontekst"/"Output kontekst" på lærredet (se lib/bpmn.ts),
// men hver enkelt kobling redigeres her enkeltvis.
export async function linkStepData(
  processId: string,
  subProcessId: string,
  stepId: string,
  dataObjectId: string,
  direction: "INPUT" | "OUTPUT" | "BOTH",
) {
  await assertSubProcessOwnership(subProcessId);
  await assertDataObjectOwnership(dataObjectId);
  const step = await db.processStep.findUnique({ where: { id: stepId }, select: { subProcessId: true } });
  if (!step || step.subProcessId !== subProcessId) return;

  await db.stepData.upsert({
    where: { stepId_dataObjectId: { stepId, dataObjectId } },
    update: { direction },
    create: { stepId, dataObjectId, direction },
  });
  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

export async function unlinkStepData(processId: string, subProcessId: string, stepDataId: string) {
  await assertSubProcessOwnership(subProcessId);
  const link = await db.stepData.findUnique({
    where: { id: stepDataId },
    select: { step: { select: { subProcessId: true } } },
  });
  if (!link || link.step.subProcessId !== subProcessId) return;

  await db.stepData.delete({ where: { id: stepDataId } });
  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

// De øvrige feltler pr. skridt — frekvens, varighed, smertepunkt,
// beslutningsgrundlag og resultat. Samlet i ét gem-kald (som
// ProposalReportEditor) i stedet for felt-for-felt, da de redigeres sammen i
// samme udfoldede skridt i "Skridtdetaljer"-panelet.
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
  const step = await db.processStep.findUnique({ where: { id: stepId }, select: { subProcessId: true } });
  if (!step || step.subProcessId !== subProcessId) return;

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

// Procesekspert (respondent) valgt fra organisationens brugerliste (samme
// liste som Kontrolpanelets Brugere) frem for fritekst.
export async function addExpertFromUser(
  processId: string,
  subProcessId: string,
  userId: string,
) {
  await assertSubProcessOwnership(subProcessId);
  await assertUserInEngagement(userId);
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await db.subProcessExpert.create({
    data: { subProcessId, name: user.name, email: user.email },
  });
  revalidatePath(path(processId, subProcessId));
}

// Godkendelse eller anmodning om rettelser fra procesejer/medarbejder.
// validatorRole udledes af den valgte brugers rolle i stedet for at blive
// spurgt separat — der er kun to gyldige værdier i Validation-modellen, så
// alt der ikke er PROCESS_OWNER falder ind under EMPLOYEE. En godkendelse
// flytter underprocessen til VALIDATED, en anmodning om rettelser til
// NEEDS_UPDATE, så statussen på procesoversigten altid afspejler seneste ord.
export async function submitValidation(
  processId: string,
  subProcessId: string,
  validatorUserId: string,
  verdict: "APPROVED" | "CHANGES_REQUESTED",
  comment?: string,
) {
  await assertSubProcessOwnership(subProcessId);
  await assertUserInEngagement(validatorUserId);
  const user = await db.user.findUnique({ where: { id: validatorUserId } });
  if (!user) return;

  const validatorRole = user.role === "PROCESS_OWNER" ? "PROCESS_OWNER" : "EMPLOYEE";

  await db.validation.create({
    data: {
      subProcessId,
      validatorId: user.id,
      validatorRole,
      verdict,
      comment: comment?.trim() || null,
    },
  });

  await db.subProcess.update({
    where: { id: subProcessId },
    data: { status: verdict === "APPROVED" ? "VALIDATED" : "NEEDS_UPDATE" },
  });

  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

// Der er ikke koblet en rigtig mailudbyder på endnu — vi markerer invitationen
// som sendt og logger den, så flowet kan testes uden SMTP-nøgler. Linket er
// det samme for alle, så koden er det der bekræfter hvem der svarer.
export async function sendInvite(processId: string, subProcessId: string, expertId: string) {
  await assertSubProcessOwnership(subProcessId);
  await assertExpertOwnership(expertId);
  const expert = await db.subProcessExpert.update({
    where: { id: expertId },
    data: { invitedAt: new Date() },
  });
  const code = await ensureLoginCode(expert.email);
  console.log(
    `[interview-invite] Til: ${expert.email} — "Du er inviteret til et interview." Link: /interviews/login — Kode: ${code ?? "(ingen bruger med den mail)"}`,
  );
  revalidatePath(path(processId, subProcessId));
}

// Løbende forbedringslogging — adskilt fra submitImprovementLog i
// interviews/actions.ts (som kun kan nås midt i en interview-session af en
// respondent). Denne kan kaldes af enhver logget-ind medarbejder når som
// helst de kigger på underprocessen, ikke kun mens de bliver interviewet.
// submittedBy læses fra sessionen, ikke et navn klienten selv sender ind.
export async function submitOwnImprovementLog(
  processId: string,
  subProcessId: string,
  content: string,
) {
  if (!content.trim()) return;
  await assertSubProcessOwnership(subProcessId);
  const user = await requireSessionUser();
  const sp = await db.subProcess.findUnique({
    where: { id: subProcessId },
    select: { process: { select: { engagementId: true } } },
  });
  if (!sp) return;

  await db.improvementLog.create({
    data: {
      engagementId: sp.process.engagementId,
      subProcessId,
      submittedBy: user.name,
      content: content.trim(),
    },
  });
  revalidatePath(path(processId, subProcessId));
}

// Statusskiftet der manglede: uden dette blev en logget idé liggende som
// "Ny" for evigt. Kun de fire gyldige værdier fra ImprovementLog.status.
export async function setImprovementLogStatus(
  processId: string,
  subProcessId: string,
  logId: string,
  status: "NEW" | "REVIEWED" | "CONVERTED" | "CLOSED",
) {
  await assertSubProcessOwnership(subProcessId);
  const log = await db.improvementLog.findUnique({ where: { id: logId }, select: { subProcessId: true } });
  if (!log || log.subProcessId !== subProcessId) return;

  await db.improvementLog.update({ where: { id: logId }, data: { status } });
  revalidatePath(path(processId, subProcessId));
}

// Bygger broen mellem interviewet og BPMN-kortlægningen: agenten læser
// transskriptionen og udleder de konkrete skridt, i stedet for at
// underprocesejeren skal tegne dem fra bunden af hukommelsen. Kun tilladt
// når lærredet er tomt — det skal aldrig kunne overskrive skridt nogen
// allerede har tegnet/redigeret i hånden.
export async function generateStepsFromInterviewAction(processId: string, subProcessId: string) {
  await assertSubProcessOwnership(subProcessId);
  const existing = await db.processStep.count({ where: { subProcessId, lane: 0 } });
  if (existing > 0) throw new Error("Underprocessen har allerede kortlagte skridt.");

  await generateStepsFromInterview(subProcessId);
  revalidatePath(path(processId, subProcessId));
}

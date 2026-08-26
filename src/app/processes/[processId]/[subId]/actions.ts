"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { splitEvents, joinEvents } from "@/lib/domain";
import { ensureLoginCode } from "@/lib/interview-auth";

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
  await db.subProcess.update({
    where: { id: subProcessId },
    data: { name: name.trim() },
  });
  revalidatePath(path(processId, subProcessId));
  revalidatePath(`/processes/${processId}`);
}

// Hvem der er tildelt til at blive interviewet — kan sættes både fra
// procesoversigten og inde fra underprocessens egen arbejdsflade.
export async function setAssignee(
  processId: string,
  subProcessId: string,
  userId: string | null,
) {
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
  actorRole?: string,
  stepType?: string,
) {
  if (!name.trim()) return;
  const last = await db.processStep.findFirst({
    where: { subProcessId, lane: 0 },
    orderBy: { sortOrder: "desc" },
  });
  await db.processStep.create({
    data: {
      subProcessId,
      name: name.trim(),
      actorRole: actorRole?.trim() || null,
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
  actorRole?: string,
) {
  if (!name.trim()) return;
  const last = await db.processStep.findFirst({
    where: { subProcessId, branchFromId },
    orderBy: { sortOrder: "desc" },
  });
  await db.processStep.create({
    data: {
      subProcessId,
      name: name.trim(),
      actorRole: actorRole?.trim() || null,
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

type DiagramNode = { id: string; name: string; type: "task" | "gateway"; manual: boolean };

/*
  Gemmer et redigeret diagram. Brugeren tegner selv — sletter figurer, tilføjer
  nye, trækker pile om — og her oversættes den rækkefølge tilbage til rigtige
  ProcessStep-rækker. Start- og slut-hændelsen rører vi aldrig: de kommer altid
  fra SubProcess.startEvent/endEvent, uanset hvad der står på figuren i editoren.
*/
export async function saveDiagram(
  processId: string,
  subProcessId: string,
  orderedNodes: DiagramNode[],
) {
  const existing = await db.processStep.findMany({
    where: { subProcessId, lane: 0 },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((s) => s.id));
  const keptIds = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ops: any[] = [];

  orderedNodes.forEach((node, index) => {
    const matchedId = stepIdFromNodeId(node.id);
    const stepType = node.type === "gateway" ? "DECISION" : "TASK";

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
          },
        }),
      );
    }
  });

  for (const id of existingIds) {
    if (!keptIds.has(id)) ops.push(db.processStep.delete({ where: { id } }));
  }

  await db.$transaction(ops);
  revalidatePath(path(processId, subProcessId));
}

// Procesekspert valgt fra organisationens brugerliste (samme liste som
// Kontrolpanelets respondenter) frem for fritekst.
export async function addExpertFromUser(
  processId: string,
  subProcessId: string,
  userId: string,
) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;
  await db.subProcessExpert.create({
    data: { subProcessId, name: user.name, email: user.email },
  });
  revalidatePath(path(processId, subProcessId));
}

// Der er ikke koblet en rigtig mailudbyder på endnu — vi markerer invitationen
// som sendt og logger den, så flowet kan testes uden SMTP-nøgler. Linket er
// det samme for alle, så koden er det der bekræfter hvem der svarer.
export async function sendInvite(processId: string, subProcessId: string, expertId: string) {
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

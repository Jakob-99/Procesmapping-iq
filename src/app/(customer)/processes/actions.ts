"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { assertProcessOwnership, assertUserInEngagement } from "@/lib/ownership";
import { splitEvents } from "@/lib/domain";

// Procesejeren opretter en ny end-to-end proces i procesmodellen — kerne eller støtte.
export async function createProcess(name: string, category: "CORE" | "SUPPORT") {
  if (!name.trim()) return;
  const engagement = await requireEngagement();
  const last = await db.process.findFirst({
    where: { engagementId: engagement.id },
    orderBy: { sortOrder: "desc" },
  });
  await db.process.create({
    data: {
      engagementId: engagement.id,
      name: name.trim(),
      category,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/processes");
}

// Procesejeren opretter underprocessen med start og slut — de bliver til
// start-/sluthændelser i diagrammet, forbundet af én pil. Resten (skridt,
// svimlaner) bygges bagefter i chatten under diagrammet.
export async function createSubProcess(
  processId: string,
  name: string,
  startEvent?: string,
  endEvent?: string,
  groupId?: string | null,
) {
  if (!name.trim()) return;
  await assertProcessOwnership(processId);
  if (groupId) await assertGroupInProcess(processId, groupId);
  const last = await db.subProcess.findFirst({
    where: { processId },
    orderBy: { sortOrder: "desc" },
  });
  const sp = await db.subProcess.create({
    data: {
      processId,
      groupId: groupId || null,
      name: name.trim(),
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  // Den grundlæggende svimlane — findes altid, kan ikke slettes eller
  // tildeles en aktør, se ProcessLane i schema.prisma.
  await db.processLane.create({ data: { subProcessId: sp.id, isDefault: true } });

  const starts = splitEvents(startEvent ?? null);
  const ends = splitEvents(endEvent ?? null);
  let order = 0;
  const startSteps = [];
  for (const s of starts.length ? starts : ["Start"]) {
    startSteps.push(
      await db.processStep.create({
        data: { subProcessId: sp.id, stepType: "START", name: s, sortOrder: order++ },
      }),
    );
  }
  const endSteps = [];
  for (const e of ends.length ? ends : ["Slut"]) {
    endSteps.push(
      await db.processStep.create({
        data: { subProcessId: sp.id, stepType: "END", name: e, sortOrder: order++ },
      }),
    );
  }
  for (const s of startSteps) {
    await db.processFlow.create({
      data: { subProcessId: sp.id, fromStepId: s.id, toStepId: endSteps[0].id },
    });
  }
  revalidatePath(`/processes`);
  revalidatePath(`/processes/${processId}`);
}

// Procesejeren trækker selv rundt på kortene i procesmodellen — rækkefølgen
// (og dermed venstre/højre, top/bund i grid'et) er bare sortOrder.
export async function reorderProcesses(ids: string[]) {
  const engagement = await requireEngagement();
  const owned = await db.process.count({ where: { id: { in: ids }, engagementId: engagement.id } });
  if (owned !== ids.length) throw new Error("Ikke fundet.");

  await db.$transaction(
    ids.map((id, index) => db.process.update({ where: { id }, data: { sortOrder: index } })),
  );
  revalidatePath("/processes");
}

// Sletter en e2e-proces og alle dens underprocesser, skridt og svimlaner
// (cascader via schemaet).
export async function deleteProcess(processId: string) {
  await assertProcessOwnership(processId);
  await db.process.delete({ where: { id: processId } });
  revalidatePath("/processes");
}

// Procesejer og navn på procesområdet — vises som "Områdeejer" i sidehovedet.
export async function updateProcess(
  processId: string,
  data: { name?: string; ownerId?: string | null },
) {
  await assertProcessOwnership(processId);
  if (data.ownerId) await assertUserInEngagement(data.ownerId);
  await db.process.update({
    where: { id: processId },
    data: {
      ...(data.name?.trim() ? { name: data.name.trim() } : {}),
      ...(data.ownerId !== undefined ? { ownerId: data.ownerId || null } : {}),
    },
  });
  revalidatePath("/processes");
  revalidatePath(`/processes/${processId}`);
}

// ------------------------------------------------------------------ Grupper

async function assertGroupInProcess(processId: string, groupId: string) {
  const group = await db.subProcessGroup.findUnique({ where: { id: groupId }, select: { processId: true } });
  if (!group || group.processId !== processId) throw new Error("Ikke fundet.");
}

export async function createSubProcessGroup(processId: string, name: string) {
  if (!name.trim()) return;
  await assertProcessOwnership(processId);
  const last = await db.subProcessGroup.findFirst({ where: { processId }, orderBy: { sortOrder: "desc" } });
  await db.subProcessGroup.create({
    data: { processId, name: name.trim(), sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  revalidatePath(`/processes/${processId}`);
}

export async function renameSubProcessGroup(processId: string, groupId: string, name: string) {
  if (!name.trim()) return;
  await assertProcessOwnership(processId);
  await assertGroupInProcess(processId, groupId);
  await db.subProcessGroup.update({ where: { id: groupId }, data: { name: name.trim() } });
  revalidatePath(`/processes/${processId}`);
}

// Sletter kun gruppen — underprocesserne i den flytter op i den
// unavngivne gruppe i stedet for at forsvinde.
export async function deleteSubProcessGroup(processId: string, groupId: string) {
  await assertProcessOwnership(processId);
  await assertGroupInProcess(processId, groupId);
  await db.subProcessGroup.delete({ where: { id: groupId } });
  revalidatePath(`/processes/${processId}`);
}

export async function moveSubProcessToGroup(processId: string, subProcessId: string, groupId: string | null) {
  await assertProcessOwnership(processId);
  if (groupId) await assertGroupInProcess(processId, groupId);
  const sp = await db.subProcess.findUnique({ where: { id: subProcessId }, select: { processId: true } });
  if (!sp || sp.processId !== processId) throw new Error("Ikke fundet.");
  await db.subProcess.update({ where: { id: subProcessId }, data: { groupId } });
  revalidatePath(`/processes/${processId}`);
}

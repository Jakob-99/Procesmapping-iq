"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { ensureLoginCode } from "@/lib/interview-auth";
import { assertProcessOwnership } from "@/lib/ownership";

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

// Procesejeren opretter underprocessen med start og slut — resten (skridt,
// interview) kommer først bagefter, når medarbejderen er interviewet.
export async function createSubProcess(
  processId: string,
  name: string,
  startEvent?: string,
  endEvent?: string,
) {
  if (!name.trim()) return;
  await assertProcessOwnership(processId);
  const last = await db.subProcess.findFirst({
    where: { processId },
    orderBy: { sortOrder: "desc" },
  });
  const sp = await db.subProcess.create({
    data: {
      processId,
      name: name.trim(),
      startEvent: startEvent?.trim() || null,
      endEvent: endEvent?.trim() || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  // Den grundlæggende svimlane — findes altid, kan ikke slettes eller
  // tildeles en aktør, se ProcessLane i schema.prisma. Andre svimlaner bygges
  // op oven på den via createLane/setStepActor.
  await db.processLane.create({ data: { subProcessId: sp.id, isDefault: true } });
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

// Sletter en e2e-proces og alle dens underprocesser, skridt, interviews m.v.
// (cascader via schemaet). Forbedringer der peger på processen eller dens
// underprocesser har ingen cascade — de løsrives i stedet for at slettes med,
// så forbedringslogikken ikke mister historik ved en fejl.
export async function deleteProcess(processId: string) {
  await assertProcessOwnership(processId);
  const subProcesses = await db.subProcess.findMany({
    where: { processId },
    select: { id: true },
  });
  const subIds = subProcesses.map((s) => s.id);

  await db.improvement.updateMany({
    where: { OR: [{ processId }, { subProcessId: { in: subIds } }] },
    data: { processId: null, subProcessId: null },
  });

  await db.process.delete({ where: { id: processId } });
  revalidatePath("/processes");
}

// Sender interview-invitationen til procesksperterne på de underprocesser
// brugeren har valgt i "Send interview"-popup'en — ikke nødvendigvis alle
// underprocesser i e2e-processen, da man kan fravælge nogen der.
export async function sendInterviewToSubProcesses(processId: string, subProcessIds: string[]) {
  await assertProcessOwnership(processId);
  const experts = await db.subProcessExpert.findMany({
    where: { subProcessId: { in: subProcessIds }, subProcess: { processId } },
  });

  await db.subProcessExpert.updateMany({
    where: { id: { in: experts.map((e) => e.id) } },
    data: { invitedAt: new Date() },
  });

  // Samme mail kan optræde flere gange (ekspert på flere underprocesser) —
  // koden er den samme for personen på tværs, så vi genbruger den pr. mail.
  const codeByEmail = new Map<string, string | null>();
  for (const e of experts) {
    if (!codeByEmail.has(e.email)) {
      codeByEmail.set(e.email, await ensureLoginCode(e.email));
    }
    console.log(
      `[interview-invite] Til: ${e.email} — "Du er inviteret til et interview." Link: /interviews/login — Kode: ${codeByEmail.get(e.email) ?? "(ingen bruger med den mail)"}`,
    );
  }

  revalidatePath(`/processes`);
  revalidatePath(`/processes/${processId}`);
  return experts.length;
}

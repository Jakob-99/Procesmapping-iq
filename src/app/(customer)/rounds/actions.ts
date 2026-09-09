"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { assertInterviewRoundOwnership } from "@/lib/ownership";

// Runder er en funktion under /interviews, ikke sin egen side — se
// RoundCreator/RoundRow i src/app/(customer)/interviews/page.tsx.

export async function createRound(name: string) {
  if (!name.trim()) return null;
  const engagement = await requireEngagement();
  const round = await db.interviewRound.create({
    data: { engagementId: engagement.id, name: name.trim() },
  });
  revalidatePath("/interviews");
  return round;
}

export async function renameRound(id: string, name: string) {
  await assertInterviewRoundOwnership(id);
  if (!name.trim()) return;
  await db.interviewRound.update({ where: { id }, data: { name: name.trim() } });
  revalidatePath("/interviews");
}

export async function deleteRound(id: string) {
  await assertInterviewRoundOwnership(id);
  await db.interviewRound.delete({ where: { id } });
  revalidatePath("/interviews");
}

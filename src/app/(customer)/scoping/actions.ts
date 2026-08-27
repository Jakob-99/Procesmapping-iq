"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";

function splitGoals(text: string | null) {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\d+\)\s*/, ""));
}

export async function addStrategicGoal(goal: string) {
  if (!goal.trim()) return;
  const engagement = await requireEngagement();
  const goals = splitGoals(engagement.strategicGoals);
  goals.push(goal.trim());
  await db.engagement.update({
    where: { id: engagement.id },
    data: { strategicGoals: goals.join("\n") },
  });
  revalidatePath("/scoping");
}

export async function removeStrategicGoal(index: number) {
  const engagement = await requireEngagement();
  const goals = splitGoals(engagement.strategicGoals);
  goals.splice(index, 1);
  await db.engagement.update({
    where: { id: engagement.id },
    data: { strategicGoals: goals.join("\n") },
  });
  revalidatePath("/scoping");
}

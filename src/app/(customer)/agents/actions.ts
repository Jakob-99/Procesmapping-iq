"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { assertInterviewAgentOwnership } from "@/lib/ownership";

export async function createAgent(name: string, goal: string) {
  if (!name.trim() || !goal.trim()) return null;
  const engagement = await requireEngagement();
  const agent = await db.interviewAgent.create({
    data: {
      engagementId: engagement.id,
      name: name.trim(),
      goal: goal.trim(),
    },
  });
  revalidatePath("/agents");
  return agent;
}

export async function updateAgent(id: string, name: string, goal: string, instructions: string) {
  await assertInterviewAgentOwnership(id);
  if (!name.trim() || !goal.trim()) return;
  await db.interviewAgent.update({
    where: { id },
    data: {
      name: name.trim(),
      goal: goal.trim(),
      instructions: instructions.trim() || null,
    },
  });
  revalidatePath("/agents");
  revalidatePath(`/agents/${id}`);
}

export async function deleteAgent(id: string) {
  await assertInterviewAgentOwnership(id);
  await db.interviewAgent.delete({ where: { id } });
  revalidatePath("/agents");
}

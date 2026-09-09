"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import {
  assertInterviewAgentOwnership,
  assertInterviewRoundOwnership,
  assertQuantQuestionOwnership,
} from "@/lib/ownership";
import { randomUUID } from "crypto";

export type AgentInput = {
  name: string;
  purpose: string;
  prequalification: string;
  investigate: string;
  followUpLevel: number;
  formalityLevel: number;
  questionLengthLevel: number;
};

function clampLevel(n: number): number {
  return Math.min(Math.max(Math.round(n), 1), 5);
}

export async function createAgent(input: AgentInput) {
  if (!input.name.trim() || !input.purpose.trim()) return null;
  const engagement = await requireEngagement();
  const agent = await db.interviewAgent.create({
    data: {
      engagementId: engagement.id,
      name: input.name.trim(),
      purpose: input.purpose.trim(),
      prequalification: input.prequalification.trim() || null,
      investigate: input.investigate.trim() || null,
      followUpLevel: clampLevel(input.followUpLevel),
      formalityLevel: clampLevel(input.formalityLevel),
      questionLengthLevel: clampLevel(input.questionLengthLevel),
    },
  });
  revalidatePath("/agents");
  return agent;
}

export async function updateAgent(id: string, input: AgentInput) {
  await assertInterviewAgentOwnership(id);
  if (!input.name.trim() || !input.purpose.trim()) return;
  await db.interviewAgent.update({
    where: { id },
    data: {
      name: input.name.trim(),
      purpose: input.purpose.trim(),
      prequalification: input.prequalification.trim() || null,
      investigate: input.investigate.trim() || null,
      followUpLevel: clampLevel(input.followUpLevel),
      formalityLevel: clampLevel(input.formalityLevel),
      questionLengthLevel: clampLevel(input.questionLengthLevel),
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

export async function createQuantQuestion(
  agentId: string,
  prompt: string,
  type: "CHOICE" | "SCALE",
  options: string[],
) {
  await assertInterviewAgentOwnership(agentId);
  if (!prompt.trim()) return;
  const count = await db.quantQuestion.count({ where: { interviewAgentId: agentId } });
  await db.quantQuestion.create({
    data: {
      interviewAgentId: agentId,
      prompt: prompt.trim(),
      type,
      options: type === "CHOICE" ? JSON.stringify(options.filter((o) => o.trim())) : null,
      sortOrder: count,
    },
  });
  revalidatePath(`/agents/${agentId}`);
}

export async function deleteQuantQuestion(id: string) {
  const question = await db.quantQuestion.findUnique({ where: { id }, select: { interviewAgentId: true } });
  await assertQuantQuestionOwnership(id);
  await db.quantQuestion.delete({ where: { id } });
  if (question) revalidatePath(`/agents/${question.interviewAgentId}`);
}

// Genererer (eller genbruger) et offentligt join-slug og tænder/slukker det.
// Skal have en runde at samle de selv-oprettede interviews i, ligesom en
// almindelig afsendelse — roundId er derfor krævet når enabled er sandt.
export async function setPublicJoin(agentId: string, enabled: boolean, roundId?: string) {
  await assertInterviewAgentOwnership(agentId);
  if (enabled) {
    if (!roundId) throw new Error("Vælg en runde for det offentlige link.");
    await assertInterviewRoundOwnership(roundId);
  }
  const agent = await db.interviewAgent.findUniqueOrThrow({ where: { id: agentId } });
  await db.interviewAgent.update({
    where: { id: agentId },
    data: {
      publicJoinEnabled: enabled,
      publicJoinSlug: agent.publicJoinSlug ?? (enabled ? randomUUID().slice(0, 8) : null),
      publicJoinRoundId: enabled ? roundId : null,
    },
  });
  revalidatePath(`/agents/${agentId}`);
}

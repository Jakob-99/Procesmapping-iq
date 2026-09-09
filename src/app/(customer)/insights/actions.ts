"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import {
  assertInterviewAgentOwnership,
  assertInterviewOwnership,
  assertQuoteOwnership,
} from "@/lib/ownership";
import { generateThemeClusters } from "@/lib/theme-analysis";
import { answerCrossQuery, type CrossQueryResult } from "@/lib/cross-query";

export async function generateThemes(
  agentId: string,
): Promise<{ error: string } | { count: number }> {
  await assertInterviewAgentOwnership(agentId);
  try {
    const count = await generateThemeClusters(agentId);
    revalidatePath(`/insights/${agentId}`);
    return { count };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function askCrossQuery(
  agentId: string,
  question: string,
): Promise<{ error: string } | CrossQueryResult> {
  await assertInterviewAgentOwnership(agentId);
  try {
    return await answerCrossQuery(agentId, question);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveQuote(
  interviewId: string,
  messageId: string | null,
  text: string,
  tag?: string,
) {
  const engagement = await requireEngagement();
  await assertInterviewOwnership(interviewId);
  if (!text.trim()) return;
  await db.quote.create({
    data: {
      engagementId: engagement.id,
      interviewId,
      messageId,
      text: text.trim(),
      tag: tag?.trim() || null,
    },
  });
  revalidatePath("/insights", "layout");
}

export async function deleteQuote(id: string) {
  await assertQuoteOwnership(id);
  await db.quote.delete({ where: { id } });
  revalidatePath("/insights", "layout");
}

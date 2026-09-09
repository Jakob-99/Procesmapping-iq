"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { assertInterviewOwnership, assertQuoteOwnership } from "@/lib/ownership";
import { generateThemeClusters } from "@/lib/theme-analysis";
import { answerCrossQuery, type CrossQueryResult } from "@/lib/cross-query";

export async function generateThemes(): Promise<{ error: string } | { count: number }> {
  const engagement = await requireEngagement();
  try {
    const count = await generateThemeClusters(engagement.id);
    revalidatePath("/insights");
    return { count };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export async function askCrossQuery(
  question: string,
): Promise<{ error: string } | CrossQueryResult> {
  const engagement = await requireEngagement();
  try {
    return await answerCrossQuery(engagement.id, question);
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
  revalidatePath("/insights/quotes");
}

export async function deleteQuote(id: string) {
  await assertQuoteOwnership(id);
  await db.quote.delete({ where: { id } });
  revalidatePath("/insights/quotes");
}

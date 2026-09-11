"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { requireSessionUser } from "@/lib/session";
import { sendInterviewInviteEmail } from "@/lib/mail";
import {
  assertInterviewAgentOwnership,
  assertRespondentOwnership,
  assertInterviewOwnership,
  assertInterviewRoundOwnership,
} from "@/lib/ownership";

// Sender ét interview pr. valgt respondent, ind i en eksisterende runde
// (oprettet på forhånd under /rounds), og mailer hver respondent et link
// til /respond/login (se lib/mail.ts) — uden Resend sat op modtager de
// ingen mail og skal selv vide at gå derhen med deres mailadresse.
export async function sendInterview(
  agentId: string,
  respondentIds: string[],
  roundId: string,
): Promise<{ sentCount: number; mailedCount: number }> {
  const engagement = await requireEngagement();
  const user = await requireSessionUser();
  await assertInterviewAgentOwnership(agentId);
  await assertInterviewRoundOwnership(roundId);
  await Promise.all(respondentIds.map((id) => assertRespondentOwnership(id)));

  const [agentRecord, respondents] = await Promise.all([
    db.interviewAgent.findUniqueOrThrow({ where: { id: agentId }, select: { name: true } }),
    db.respondent.findMany({
      where: { id: { in: respondentIds } },
      select: { id: true, name: true, email: true },
    }),
  ]);

  await db.interview.createMany({
    data: respondentIds.map((respondentId) => ({
      engagementId: engagement.id,
      interviewAgentId: agentId,
      interviewRoundId: roundId,
      respondentId,
      sentById: user.id,
    })),
  });
  revalidatePath("/interviews");

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const loginUrl = `${proto}://${host}/respond/login`;

  const results = await Promise.all(
    respondents.map((r) => sendInterviewInviteEmail(r.email, r.name, agentRecord.name, loginUrl)),
  );

  return { sentCount: respondentIds.length, mailedCount: results.filter(Boolean).length };
}

export async function deleteInterview(id: string) {
  await assertInterviewOwnership(id);
  await db.interview.delete({ where: { id } });
  revalidatePath("/interviews");
}

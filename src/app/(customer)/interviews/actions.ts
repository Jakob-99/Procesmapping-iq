"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { requireSessionUser } from "@/lib/session";
import {
  assertInterviewAgentOwnership,
  assertRespondentOwnership,
  assertInterviewOwnership,
  assertInterviewRoundOwnership,
} from "@/lib/ownership";

// Sender ét interview pr. valgt respondent, ind i en eksisterende runde
// (oprettet på forhånd under /rounds). Ingen rigtig mailudsendelse endnu
// (samme mønster som resten af appens invite-flows) — respondenten logger
// ind på /respond/login med sin mail og får en kode dér.
export async function sendInterview(agentId: string, respondentIds: string[], roundId: string) {
  const engagement = await requireEngagement();
  const user = await requireSessionUser();
  await assertInterviewAgentOwnership(agentId);
  await assertInterviewRoundOwnership(roundId);
  await Promise.all(respondentIds.map((id) => assertRespondentOwnership(id)));

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
}

export async function deleteInterview(id: string) {
  await assertInterviewOwnership(id);
  await db.interview.delete({ where: { id } });
  revalidatePath("/interviews");
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { requireSessionUser } from "@/lib/session";
import { assertInterviewAgentOwnership, assertRespondentOwnership, assertInterviewOwnership } from "@/lib/ownership";

// Sender ét interview pr. valgt respondent. Ingen rigtig mailudsendelse endnu
// (samme mønster som resten af appens invite-flows) — respondenten logger
// ind på /respond/login med sin mail og får en kode dér.
export async function sendInterview(agentId: string, respondentIds: string[]) {
  const engagement = await requireEngagement();
  const user = await requireSessionUser();
  await assertInterviewAgentOwnership(agentId);
  await Promise.all(respondentIds.map((id) => assertRespondentOwnership(id)));

  await db.interview.createMany({
    data: respondentIds.map((respondentId) => ({
      engagementId: engagement.id,
      interviewAgentId: agentId,
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

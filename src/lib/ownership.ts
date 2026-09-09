import { db } from "./db";
import { requireEngagement } from "./engagement";

// Enhver server action der tager et id fra klienten skal tjekke at rækken
// rent faktisk hører til den indloggede brugers engagement, ikke en
// tilfældig anden kundes — ellers kan man mutere data på tværs af kunder ved
// at kende/gætte et cuid. Kaster ved mismatch/manglende række — det er en
// tamper-vej, ikke noget der sker ved normal brug.
async function assertEngagementId(engagementId: string | null | undefined) {
  const engagement = await requireEngagement();
  if (engagementId !== engagement.id) throw new Error("Ikke fundet.");
  return engagement;
}

export async function assertRespondentOwnership(respondentId: string) {
  const respondent = await db.respondent.findUnique({
    where: { id: respondentId },
    select: { engagementId: true },
  });
  return assertEngagementId(respondent?.engagementId);
}

export async function assertInterviewAgentOwnership(agentId: string) {
  const agent = await db.interviewAgent.findUnique({
    where: { id: agentId },
    select: { engagementId: true },
  });
  return assertEngagementId(agent?.engagementId);
}

export async function assertInterviewOwnership(interviewId: string) {
  const interview = await db.interview.findUnique({
    where: { id: interviewId },
    select: { engagementId: true },
  });
  return assertEngagementId(interview?.engagementId);
}

export async function assertQuoteOwnership(quoteId: string) {
  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: { engagementId: true },
  });
  return assertEngagementId(quote?.engagementId);
}

export async function assertQuantQuestionOwnership(quantQuestionId: string) {
  const question = await db.quantQuestion.findUnique({
    where: { id: quantQuestionId },
    select: { interviewAgent: { select: { engagementId: true } } },
  });
  return assertEngagementId(question?.interviewAgent.engagementId);
}

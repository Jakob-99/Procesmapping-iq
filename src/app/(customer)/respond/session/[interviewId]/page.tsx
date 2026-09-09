import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getRespondent } from "@/lib/respondent-session";
import { InterviewSession } from "@/components/InterviewSession";

export const dynamic = "force-dynamic";

export default async function RespondentSessionPage({
  params,
}: {
  params: Promise<{ interviewId: string }>;
}) {
  const { interviewId } = await params;
  const respondent = await getRespondent();
  if (!respondent) redirect("/respond/login");

  const interview = await db.interview.findUnique({
    where: { id: interviewId },
    include: { interviewAgent: true },
  });
  if (!interview) notFound();

  // Beskytter mod at gætte på en URL — man må kun svare på sit eget interview.
  if (interview.respondentId !== respondent.id) redirect("/respond/select");

  return (
    <InterviewSession
      interviewId={interview.id}
      agentName={interview.interviewAgent.name}
      respondentName={respondent.name}
    />
  );
}

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
    include: {
      interviewAgent: { include: { images: { orderBy: { sortOrder: "asc" } } } },
      messages: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!interview) notFound();

  // Beskytter mod at gætte på en URL — man må kun svare på sit eget interview.
  if (interview.respondentId !== respondent.id) redirect("/respond/select");

  return (
    <InterviewSession
      interviewId={interview.id}
      agentName={interview.interviewAgent.name}
      respondentName={respondent.name}
      agentImages={interview.interviewAgent.images.map((img) => ({ label: img.label, data: img.data }))}
      initialTurns={interview.messages.map((m) => ({
        role: m.role === "agent" ? "agent" : "user",
        content: m.content,
        showImage: m.imageLabel,
      }))}
      initialNotes={interview.notes.map((n) => ({ category: n.category, content: n.content }))}
      initialDone={interview.status === "COMPLETED"}
    />
  );
}

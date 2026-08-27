import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getInterviewUser } from "@/lib/interview-session";
import { InterviewSession } from "@/components/InterviewSession";

export const dynamic = "force-dynamic";

export default async function InterviewRealSessionPage({
  params,
}: {
  params: Promise<{ subId: string }>;
}) {
  const { subId } = await params;
  const user = await getInterviewUser();
  if (!user) redirect("/interviews/login");

  const sp = await db.subProcess.findUnique({ where: { id: subId } });
  if (!sp) notFound();

  // Beskytter mod at gætte på en URL — man må kun interviewes om det, man
  // rent faktisk er sat på som procesekspert.
  const isExpert = await db.subProcessExpert.findFirst({
    where: { subProcessId: subId, email: user.email },
  });
  if (!isExpert) redirect("/interviews/select");

  return (
    <InterviewSession
      subProcessId={sp.id}
      subProcessName={sp.name}
      employeeName={user.name}
      userId={user.id}
    />
  );
}

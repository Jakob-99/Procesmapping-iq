"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { verifyLoginCode } from "@/lib/interview-auth";

const COOKIE = "interview_uid";

export async function loginWithCode(code: string): Promise<{ error: string } | never> {
  const userId = await verifyLoginCode(code);
  if (!userId) {
    return { error: "Forkert eller udløbet kode." };
  }

  const jar = await cookies();
  jar.set(COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  redirect("/interviews/select");
}

export async function logoutInterview() {
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect("/interviews/login");
}

// Genoptager et åbent interview for den samme person/underproces frem for at
// starte forfra, hvis de har lukket vinduet midt i.
export async function startInterview(subProcessId: string, userId: string) {
  const existing = await db.interview.findFirst({
    where: { subProcessId, userId, status: "OPEN" },
  });
  if (existing) return existing.id;

  const created = await db.interview.create({
    data: { subProcessId, userId },
  });
  return created.id;
}

export async function saveInterviewMessage(
  interviewId: string,
  role: "agent" | "user",
  content: string,
) {
  if (!content.trim()) return;
  await db.interviewMessage.create({
    data: { interviewId, role, content },
  });
}

export async function saveInterviewNote(
  interviewId: string,
  category: string,
  content: string,
) {
  await db.interviewNote.create({
    data: { interviewId, category, content },
  });
}

export async function completeInterview(interviewId: string) {
  await db.interview.update({
    where: { id: interviewId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
}

// Medarbejderen kan løbende melde et forbedringsønske ind fra interviewsiden —
// vises samme sted som resten af underprocessens indsigter (InsightsPanel),
// ikke gemt væk i en separat driftslog.
export async function submitImprovementLog(
  subProcessId: string,
  submittedBy: string,
  content: string,
) {
  if (!content.trim()) return;
  const sp = await db.subProcess.findUnique({
    where: { id: subProcessId },
    select: { processId: true, process: { select: { engagementId: true } } },
  });
  if (!sp) return;

  await db.improvementLog.create({
    data: {
      engagementId: sp.process.engagementId,
      subProcessId,
      submittedBy,
      content: content.trim(),
    },
  });
  revalidatePath(`/processes/${sp.processId}/${subProcessId}`);
}

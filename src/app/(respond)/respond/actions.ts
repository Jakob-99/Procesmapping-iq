"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ensureRespondentLoginCode, verifyRespondentLoginCode } from "@/lib/respondent-auth";

const COOKIE = "respondent_id";

export async function requestRespondentCode(
  email: string,
): Promise<{ code: string } | { error: string }> {
  const code = await ensureRespondentLoginCode(email);
  if (!code) return { error: "Ingen respondent er registreret med den mail." };
  return { code };
}

export async function loginWithRespondentCode(code: string): Promise<{ error: string } | never> {
  const respondentId = await verifyRespondentLoginCode(code);
  if (!respondentId) {
    return { error: "Forkert eller udløbet kode." };
  }

  const jar = await cookies();
  jar.set(COOKIE, respondentId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  redirect("/respond/select");
}

export async function logoutRespondent() {
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect("/respond/login");
}

export async function saveInterviewMessage(
  interviewId: string,
  role: "agent" | "user",
  content: string,
  imageLabel?: string | null,
) {
  if (!content.trim()) return;
  await db.interviewMessage.create({
    data: { interviewId, role, content, imageLabel: imageLabel || null },
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

export async function saveQuantAnswers(
  interviewId: string,
  answers: { quantQuestionId: string; value: string }[],
) {
  for (const a of answers) {
    await db.quantAnswer.upsert({
      where: { quantQuestionId_interviewId: { quantQuestionId: a.quantQuestionId, interviewId } },
      update: { value: a.value },
      create: { quantQuestionId: a.quantQuestionId, interviewId, value: a.value },
    });
  }
}

// Offentligt selvbetjenings-link/QR — ingen session eller engagement krævet.
// Respondenten opretter sig selv (eller genbruges hvis mailen allerede
// findes) og logges direkte ind, uden magic-kode, da de lige har tastet
// mailen ind i samme request.
export async function joinPublicInterview(
  slug: string,
  name: string,
  email: string,
): Promise<{ error: string } | never> {
  const agent = await db.interviewAgent.findUnique({
    where: { publicJoinSlug: slug },
  });
  if (!agent || !agent.publicJoinEnabled || !agent.publicJoinRoundId) {
    return { error: "Linket er ikke længere aktivt." };
  }
  if (!name.trim() || !email.trim()) {
    return { error: "Udfyld navn og mail." };
  }

  const respondent = await db.respondent.upsert({
    where: { engagementId_email: { engagementId: agent.engagementId, email: email.trim() } },
    update: {},
    create: { engagementId: agent.engagementId, name: name.trim(), email: email.trim() },
  });

  const interview = await db.interview.create({
    data: {
      engagementId: agent.engagementId,
      interviewAgentId: agent.id,
      interviewRoundId: agent.publicJoinRoundId,
      respondentId: respondent.id,
    },
  });

  const jar = await cookies();
  jar.set(COOKIE, respondent.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  redirect(`/respond/session/${interview.id}`);
}

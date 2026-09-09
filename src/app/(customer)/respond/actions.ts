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

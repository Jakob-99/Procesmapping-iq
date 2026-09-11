"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureLoginCode, verifyLoginCode } from "@/lib/interview-auth";
import { sendLoginCodeEmail } from "@/lib/mail";
import { SESSION_COOKIE } from "@/lib/session";

// Sender koden på mail når Resend er sat op (se lib/mail.ts) — er den ikke
// konfigureret endnu, eller fejler afsendelsen, falder vi tilbage til at
// vise koden direkte på skærmen, så login ikke går i stå.
export async function requestLoginCode(
  email: string,
): Promise<{ sent: true } | { code: string } | { error: string }> {
  const trimmed = email.trim().toLowerCase();
  const code = await ensureLoginCode(trimmed);
  if (!code) return { error: "Ingen bruger fundet med den mail." };

  const sent = await sendLoginCodeEmail(trimmed, code, "Corner IQ");
  return sent ? { sent: true } : { code };
}

export async function loginWithMainCode(code: string): Promise<{ error: string } | never> {
  const userId = await verifyLoginCode(code);
  if (!userId) return { error: "Forkert eller udløbet kode." };

  const jar = await cookies();
  jar.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

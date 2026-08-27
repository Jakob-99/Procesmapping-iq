"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureLoginCode, verifyLoginCode } from "@/lib/interview-auth";
import { SESSION_COOKIE } from "@/lib/session";

// Ingen mailudbyder koblet på endnu (samme situation som interview-invitationerne,
// se sendInvite i app/processes/[processId]/[subId]/actions.ts) — koden vises
// derfor direkte på skærmen i stedet for at blive sendt, indtil SMTP er sat op.
export async function requestLoginCode(email: string): Promise<{ code: string } | { error: string }> {
  const code = await ensureLoginCode(email.trim().toLowerCase());
  if (!code) return { error: "Ingen bruger fundet med den mail." };
  return { code };
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

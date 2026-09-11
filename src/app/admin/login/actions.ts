"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureConsultantLoginCode, verifyConsultantLoginCode } from "@/lib/consultant-auth";
import { sendLoginCodeEmail } from "@/lib/mail";
import { ADMIN_COOKIE } from "@/lib/consultant-session";

// Samme mail/fallback-mønster som kundens login (se (customer)/login/actions.ts).
export async function requestAdminCode(
  email: string,
): Promise<{ sent: true } | { code: string } | { error: string }> {
  const trimmed = email.trim().toLowerCase();
  const code = await ensureConsultantLoginCode(trimmed);
  if (!code) return { error: "Ingen konsulentkonto fundet med den mail." };

  const sent = await sendLoginCodeEmail(trimmed, code, "Corner IQ admin");
  return sent ? { sent: true } : { code };
}

export async function loginWithAdminCode(code: string): Promise<{ error: string } | never> {
  const consultantId = await verifyConsultantLoginCode(code);
  if (!consultantId) return { error: "Forkert eller udløbet kode." };

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, consultantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  redirect("/admin");
}

export async function logoutAdmin() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

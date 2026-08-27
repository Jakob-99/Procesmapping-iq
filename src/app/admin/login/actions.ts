"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureConsultantLoginCode, verifyConsultantLoginCode } from "@/lib/consultant-auth";
import { ADMIN_COOKIE } from "@/lib/consultant-session";

// Samme "ingen SMTP endnu"-situation som kundens login (se app/login/actions.ts)
// — koden vises direkte på skærmen i stedet for at blive sendt.
export async function requestAdminCode(email: string): Promise<{ code: string } | { error: string }> {
  const code = await ensureConsultantLoginCode(email.trim().toLowerCase());
  if (!code) return { error: "Ingen konsulentkonto fundet med den mail." };
  return { code };
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

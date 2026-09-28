"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureLoginCode, verifyLoginCode } from "@/lib/interview-auth";
import { sendLoginCodeEmail } from "@/lib/mail";
import { SESSION_COOKIE } from "@/lib/session";
import { db } from "@/lib/db";

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

// Samme mail kan være bruger i flere virksomheder (fx en konsulent der er
// med både hos en kunde og i Cornerstones' egen). Er det tilfældet, svarer
// vi med listen, og brugeren vælger — det valgte bruger-id tjekkes igen op
// mod koden (samme mail som kodens bruger), så man ikke kan vælge sig ind
// hos en virksomhed man ikke er bruger i.
export async function loginWithMainCode(
  code: string,
  chosenUserId?: string,
): Promise<{ error: string } | { choose: { userId: string; organization: string }[] } | never> {
  const tokenUserId = await verifyLoginCode(code);
  if (!tokenUserId) return { error: "Forkert eller udløbet kode." };

  const tokenUser = await db.user.findUnique({ where: { id: tokenUserId }, select: { email: true } });
  if (!tokenUser) return { error: "Forkert eller udløbet kode." };
  const candidates = await db.user.findMany({
    where: { email: tokenUser.email, consultantAccountId: null },
    select: { id: true, organization: { select: { name: true } } },
    orderBy: { organization: { name: "asc" } },
  });

  let userId = tokenUserId;
  if (candidates.length > 1) {
    if (!chosenUserId) {
      return { choose: candidates.map((c) => ({ userId: c.id, organization: c.organization.name })) };
    }
    if (!candidates.some((c) => c.id === chosenUserId)) return { error: "Ugyldigt valg." };
    userId = chosenUserId;
  }

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

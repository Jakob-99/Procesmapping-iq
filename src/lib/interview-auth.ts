import { db } from "./db";

/*
  Interview-linket er det samme for alle — derfor skal man bekræfte hvem man
  er med en kort kode, før man kan vælge proces og starte. Vi genbruger
  LoginToken-modellen (den var tænkt til et magic-link), men lægger en kort
  6-cifret kode i token-feltet i stedet for et langt, opaque link.
*/
export async function ensureLoginCode(email: string): Promise<string | null> {
  // consultantAccountId: null udelukker konsulenters egne kunde-sæder (se
  // openCustomerAsConsultant i app/admin/actions.ts) — de logger ind via
  // admin-panelet, ikke via denne mail-kode-flow.
  const user = await db.user.findFirst({ where: { email, consultantAccountId: null } });
  if (!user) return null;

  const existing = await db.loginToken.findFirst({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing.token;

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db.loginToken.create({
    data: {
      userId: user.id,
      token: code,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    },
  });
  return code;
}

// Delt af begge login-flows (interview-koden og hovedappens login) — slår
// koden op og returnerer hvilken bruger den hører til, uden at kende noget
// til cookies eller hvor man skal sendes hen bagefter.
export async function verifyLoginCode(code: string): Promise<string | null> {
  const token = await db.loginToken.findFirst({
    where: { token: code.trim(), expiresAt: { gt: new Date() } },
  });
  return token?.userId ?? null;
}

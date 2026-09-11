import { db } from "./db";

/*
  Samme 6-cifrede magic-kode-mønster som lib/interview-auth.ts (org-brugernes
  login), men på Respondent/RespondentLoginToken i stedet for User/LoginToken
  — respondenter har ikke nødvendigvis nogen login-konto til appen.
*/
export async function ensureRespondentLoginCode(email: string): Promise<string | null> {
  // Samme forenkling som ensureLoginCode i interview-auth.ts: mailen er kun
  // garanteret unik pr. engagement, ikke globalt — tager første match.
  const respondent = await db.respondent.findFirst({ where: { email } });
  if (!respondent) return null;

  const existing = await db.respondentLoginToken.findFirst({
    where: { respondentId: respondent.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing.token;

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db.respondentLoginToken.create({
    data: {
      respondentId: respondent.id,
      token: code,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    },
  });
  return code;
}

export async function verifyRespondentLoginCode(code: string): Promise<string | null> {
  const token = await db.respondentLoginToken.findFirst({
    where: { token: code.trim(), expiresAt: { gt: new Date() } },
  });
  return token?.respondentId ?? null;
}

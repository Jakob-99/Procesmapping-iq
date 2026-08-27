import { db } from "./db";

/*
  Samme magic-kode-mønster som lib/interview-auth.ts (LoginToken/User), men
  for ConsultantAccount — helt adskilt model, så en kompromitteret
  kunde-konto aldrig giver vej ind i admin-panelet.
*/
export async function ensureConsultantLoginCode(email: string): Promise<string | null> {
  const consultant = await db.consultantAccount.findUnique({ where: { email } });
  if (!consultant) return null;

  const existing = await db.consultantLoginToken.findFirst({
    where: { consultantId: consultant.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing.token;

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db.consultantLoginToken.create({
    data: {
      consultantId: consultant.id,
      token: code,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    },
  });
  return code;
}

export async function verifyConsultantLoginCode(code: string): Promise<string | null> {
  const token = await db.consultantLoginToken.findFirst({
    where: { token: code.trim(), expiresAt: { gt: new Date() } },
  });
  return token?.consultantId ?? null;
}

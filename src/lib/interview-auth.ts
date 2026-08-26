import { db } from "./db";

/*
  Interview-linket er det samme for alle — derfor skal man bekræfte hvem man
  er med en kort kode, før man kan vælge proces og starte. Vi genbruger
  LoginToken-modellen (den var tænkt til et magic-link), men lægger en kort
  6-cifret kode i token-feltet i stedet for et langt, opaque link.
*/
export async function ensureLoginCode(email: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { email } });
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

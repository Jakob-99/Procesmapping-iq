import { db } from "./db";

// MVP: ét aktivt engagement. Bliver til et rigtigt valg, når vi har flere kunder.
export async function activeEngagement() {
  return db.engagement.findFirst({
    orderBy: { createdAt: "asc" },
    include: { organization: true },
  });
}

export async function requireEngagement() {
  const e = await activeEngagement();
  if (!e) throw new Error("Intet engagement fundet — kør `npm run db:seed`.");
  return e;
}

import { db } from "./db";

/*
  Sikrer at der findes en ProcessLane-række for en aktør i en underproces,
  uden at oprette en dublet. Kaldes både når et skridt får en aktør og når
  en svimlane oprettes direkte, så de to veje aldrig løber fra hinanden.

  findFirst+create i stedet for upsert: Prismas genererede type for det
  sammensatte unikke opslag accepterer ikke null for de nullable felter,
  selvom selve databaseindekset gør.
*/
export async function ensureLane(
  subProcessId: string,
  actor: { type: "role" | "system"; id: string },
  poolId: string | null = null,
) {
  const where = {
    subProcessId,
    actorRoleId: actor.type === "role" ? actor.id : null,
    actorSystemId: actor.type === "system" ? actor.id : null,
  };
  const existing = await db.processLane.findFirst({ where });
  if (existing) return existing;
  const last = await db.processLane.findFirst({
    where: { subProcessId },
    orderBy: { sortOrder: "desc" },
  });
  return db.processLane.create({ data: { ...where, poolId, sortOrder: (last?.sortOrder ?? 0) + 1 } });
}

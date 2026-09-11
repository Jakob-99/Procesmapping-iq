import { cookies } from "next/headers";
import { db } from "./db";

// Læses fra server-komponenter under /respond for at finde ud af hvem der er
// logget ind med koden — se loginWithRespondentCode i (respond)/respond/actions.ts.
export async function getRespondent() {
  const id = (await cookies()).get("respondent_id")?.value;
  if (!id) return null;
  return db.respondent.findUnique({ where: { id } });
}

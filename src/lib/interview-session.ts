import { cookies } from "next/headers";
import { db } from "./db";

// Læses fra server-komponenter (siderne under /interviews) for at finde ud
// af hvem der er logget ind med koden — se loginWithCode i app/interviews/actions.ts.
export async function getInterviewUser() {
  const uid = (await cookies()).get("interview_uid")?.value;
  if (!uid) return null;
  return db.user.findUnique({ where: { id: uid } });
}

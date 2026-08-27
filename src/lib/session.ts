import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

export const SESSION_COOKIE = "session_uid";

// Læses af sider/lag der skal virke uanset om nogen er logget ind (fx
// RootLayout, som også skal kunne rendere selve /login-siden).
export async function getSessionUser() {
  const uid = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!uid) return null;
  return db.user.findUnique({ where: { id: uid } });
}

// Bruges af beskyttede sider uden eget engagement-opslag (fx /hitl,
// /transformation) — sender til /login hvis ingen session.
export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";

export const ADMIN_COOKIE = "admin_cid";

// Ikke-redirectende — bruges af admin/layout.tsx, som også render /admin/login.
export async function getConsultantSession() {
  const cid = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!cid) return null;
  return db.consultantAccount.findUnique({ where: { id: cid } });
}

// Bruges af alle beskyttede /admin-sider — sender til /admin/login hvis ingen session.
export async function requireConsultant() {
  const consultant = await getConsultantSession();
  if (!consultant) redirect("/admin/login");
  return consultant;
}

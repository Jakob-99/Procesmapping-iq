import { redirect } from "next/navigation";
import { db } from "./db";
import { getSessionUser } from "./session";

// Det aktive engagement er nu organisationen bag den indloggede bruger, ikke
// længere "den første i DB" — flere kunder kan være logget ind samtidig.
// Sender til /login hvis ingen session, så alle kaldere (sider/actions) får
// gratis login-beskyttelse ved bare at kalde denne.
export async function activeEngagement() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return db.engagement.findFirst({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "asc" },
    include: { organization: true },
  });
}

export async function requireEngagement() {
  const e = await activeEngagement();
  if (!e) throw new Error("Intet engagement fundet for denne organisation endnu.");
  return e;
}

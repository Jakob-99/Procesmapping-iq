"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireConsultant } from "@/lib/consultant-session";
import { SESSION_COOKIE } from "@/lib/session";
import { logAdminAction } from "@/lib/audit";

// Opretter en ny kunde i én omgang: organisation + første engagement + første
// bruger (typisk kundeansvarlig/procesejer), og giver den oprettende
// konsulent adgang med det samme — ellers ville kunden findes, men ingen
// konsulent kunne se den under "Mine kunder".
export async function createCustomer(input: {
  orgName: string;
  industry: string;
  engagementName: string;
  contactName: string;
  contactEmail: string;
  contactRole: string;
}): Promise<{ error: string } | never> {
  const consultant = await requireConsultant();

  const orgName = input.orgName.trim();
  const engagementName = input.engagementName.trim();
  const contactName = input.contactName.trim();
  const contactEmail = input.contactEmail.trim().toLowerCase();

  if (!orgName || !engagementName || !contactName || !contactEmail) {
    return { error: "Udfyld virksomhed, engagement, navn og mail." };
  }

  const existing = await db.user.findUnique({ where: { email: contactEmail } });
  if (existing) {
    return { error: "Der findes allerede en bruger med den mail." };
  }

  const engagement = await db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { name: orgName, industry: input.industry.trim() || null },
    });
    await tx.user.create({
      data: {
        organizationId: org.id,
        name: contactName,
        email: contactEmail,
        role: input.contactRole,
      },
    });
    const eng = await tx.engagement.create({
      data: { organizationId: org.id, name: engagementName },
    });
    await tx.consultantEngagementAccess.create({
      data: { consultantId: consultant.id, engagementId: eng.id },
    });
    return eng;
  });

  await logAdminAction(consultant.id, "CREATE_CUSTOMER", {
    targetType: "Engagement",
    targetId: engagement.id,
    detail: orgName,
  });

  revalidatePath("/admin");
  redirect(`/admin/customers/${engagement.id}`);
}

// Kun en konsulent der SELV allerede har adgang til engagementet kan give en
// anden konsulent adgang — ellers kunne enhver logget-ind konsulent give sig
// selv/andre adgang til en vilkårlig kunde blot ved at kende dens id.
async function assertOwnAccess(consultantId: string, engagementId: string) {
  const access = await db.consultantEngagementAccess.findUnique({
    where: { consultantId_engagementId: { consultantId, engagementId } },
  });
  if (!access) throw new Error("Ingen adgang til dette engagement.");
}

export async function grantAccess(engagementId: string, targetConsultantId: string) {
  const consultant = await requireConsultant();
  await assertOwnAccess(consultant.id, engagementId);

  await db.consultantEngagementAccess.upsert({
    where: { consultantId_engagementId: { consultantId: targetConsultantId, engagementId } },
    update: {},
    create: { consultantId: targetConsultantId, engagementId },
  });

  await logAdminAction(consultant.id, "GRANT_ACCESS", {
    targetType: "Engagement",
    targetId: engagementId,
    detail: `til konsulent ${targetConsultantId}`,
  });
  revalidatePath(`/admin/customers/${engagementId}`);
}

export async function revokeAccess(engagementId: string, targetConsultantId: string) {
  const consultant = await requireConsultant();
  await assertOwnAccess(consultant.id, engagementId);

  if (targetConsultantId === consultant.id) {
    throw new Error("Du kan ikke fjerne din egen adgang herfra.");
  }

  await db.consultantEngagementAccess.deleteMany({
    where: { consultantId: targetConsultantId, engagementId },
  });

  await logAdminAction(consultant.id, "REVOKE_ACCESS", {
    targetType: "Engagement",
    targetId: engagementId,
    detail: `fra konsulent ${targetConsultantId}`,
  });
  revalidatePath(`/admin/customers/${engagementId}`);
}

// Sætter kundens session_uid-cookie til den valgte bruger, så konsulenten
// reelt "bliver" den kunde i kundefladen — den funktion Jakob bad om helt
// oprindeligt ("tilgå systemer som man som konsulent har fået adgang til").
export async function impersonateUser(userId: string): Promise<never> {
  const consultant = await requireConsultant();

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("Bruger findes ikke.");

  const hasAccess = await db.consultantEngagementAccess.findFirst({
    where: { consultantId: consultant.id, engagement: { organizationId: user.organizationId } },
  });
  if (!hasAccess) throw new Error("Ingen adgang til denne kundes organisation.");

  await logAdminAction(consultant.id, "IMPERSONATE", {
    targetType: "User",
    targetId: user.id,
    detail: user.email,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  redirect("/");
}

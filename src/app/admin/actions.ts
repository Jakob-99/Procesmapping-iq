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

  await db.consultantEngagementAccess.deleteMany({
    where: { consultantId: targetConsultantId, engagementId },
  });

  await logAdminAction(consultant.id, "REVOKE_ACCESS", {
    targetType: "Engagement",
    targetId: engagementId,
    detail: `fra konsulent ${targetConsultantId}`,
  });

  // Fjernede man sin egen adgang, kan man ikke længere se denne kundes
  // sider (requireCustomerAccess ville give 404) — send i stedet direkte
  // tilbage til kundelisten i stedet for at lande på en 404-side.
  if (targetConsultantId === consultant.id) {
    revalidatePath("/admin/customers");
    redirect("/admin/customers");
  }

  revalidatePath(`/admin/customers/${engagementId}`);
}

// Personlige indstillinger for konsulenten selv — mirror af kundens
// updateOwnProfile (src/app/actions/profile.ts). Læser id'et fra sessionen,
// aldrig fra klienten, så man ikke kan redigere en anden konsulents profil.
export async function updateOwnConsultantProfile(name: string, title: string) {
  const consultant = await requireConsultant();
  if (!name.trim()) return;

  await db.consultantAccount.update({
    where: { id: consultant.id },
    data: { name: name.trim(), title: title.trim() || null },
  });
  revalidatePath("/admin", "layout");
}

// Sætter kundens session_uid-cookie til konsulentens EGET sæde hos kunden,
// så konsulenten reelt "bliver" kunden i kundefladen — den funktion Jakob bad
// om helt oprindeligt ("tilgå systemer som man som konsulent har fået adgang
// til"). Sædet (en User-række med consultantAccountId sat) oprettes/genbruges
// automatisk her — konsulenten skal IKKE længere selv oprette sig i
// Brugere-listen først, og enhver konsulent med adgang til engagementet kan
// bruge den, uanset egen rolle. Bevidst umuligt at åbne som en navngiven
// medarbejder (fx Mette/Anders): funktionen tager slet ikke imod et
// bruger-id, kun engagementId — mailen er altid konsulentens egen.
export async function openCustomerAsConsultant(engagementId: string): Promise<never> {
  const consultant = await requireConsultant();

  const access = await db.consultantEngagementAccess.findFirst({
    where: { consultantId: consultant.id, engagementId },
    include: { engagement: true },
  });
  if (!access) throw new Error("Ingen adgang til denne kundes organisation.");

  const seat = await db.user.upsert({
    where: {
      organizationId_email: {
        organizationId: access.engagement.organizationId,
        email: consultant.email,
      },
    },
    update: { name: consultant.name },
    create: {
      organizationId: access.engagement.organizationId,
      email: consultant.email,
      name: consultant.name,
      role: "FDE",
      consultantAccountId: consultant.id,
    },
  });

  await logAdminAction(consultant.id, "IMPERSONATE", {
    targetType: "User",
    targetId: seat.id,
    detail: seat.email,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, seat.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  redirect("/");
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireConsultant } from "@/lib/consultant-session";
import { logAdminAction } from "@/lib/audit";
import type { ConsultantRole } from "@/lib/consultant-roles";

export async function inviteConsultant(
  name: string,
  email: string,
): Promise<{ error: string } | void> {
  const consultant = await requireConsultant();

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedName || !trimmedEmail) return { error: "Udfyld navn og mail." };

  const existing = await db.consultantAccount.findUnique({ where: { email: trimmedEmail } });
  if (existing) return { error: "Der findes allerede en konsulent med den mail." };

  // Nye konsulenter starter som almindelig konsulent — kun en eksisterende
  // admin kan siden gøre dem til co-leder eller admin, se updateConsultantRole.
  const created = await db.consultantAccount.create({
    data: { name: trimmedName, email: trimmedEmail, role: "CONSULTANT" },
  });

  await logAdminAction(consultant.id, "INVITE_CONSULTANT", {
    targetType: "ConsultantAccount",
    targetId: created.id,
    detail: trimmedEmail,
  });
  revalidatePath("/admin/consultants");
}

// Plukker en tilfældig konsulent med den givne rolle — bruges til
// automatisk admin-succession, se ensureAdminExists.
async function pickRandomWithRole(role: ConsultantRole) {
  const candidates = await db.consultantAccount.findMany({ where: { role } });
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Sikrer at der altid findes mindst én admin. Kaldes efter en admin er
// fjernet — først forsøges en tilfældig co-leder forfremmet, ellers en
// tilfældig almindelig konsulent. Er der slet ingen konsulenter tilbage,
// er der ingen at forfremme, og admin-panelet står uden admin indtil en
// oprettes igen.
async function ensureAdminExists() {
  const adminCount = await db.consultantAccount.count({ where: { role: "ADMIN" } });
  if (adminCount > 0) return null;

  const promoted =
    (await pickRandomWithRole("CO_LEADER")) ?? (await pickRandomWithRole("CONSULTANT"));
  if (!promoted) return null;

  await db.consultantAccount.update({ where: { id: promoted.id }, data: { role: "ADMIN" } });
  return promoted;
}

export async function removeConsultant(targetId: string) {
  const consultant = await requireConsultant();
  if (targetId === consultant.id) throw new Error("Du kan ikke fjerne din egen konto herfra.");

  const target = await db.consultantAccount.delete({ where: { id: targetId } });

  await logAdminAction(consultant.id, "REMOVE_CONSULTANT", {
    targetType: "ConsultantAccount",
    targetId,
    detail: target.email,
  });

  if (target.role === "ADMIN") {
    const promoted = await ensureAdminExists();
    if (promoted) {
      await logAdminAction(consultant.id, "PROMOTE_ADMIN", {
        targetType: "ConsultantAccount",
        targetId: promoted.id,
        detail: `Automatisk forfremmet til admin efter ${target.email} blev fjernet`,
      });
    }
  }

  revalidatePath("/admin/consultants");
}

// Kun en admin kan ændre roller — herunder gøre andre til admin. En admin
// kan ikke fjerne sin egen (eller en anden admins) rolle hvis det ville
// efterlade nul admins, så panelet aldrig ender uden nogen der kan styre
// rettigheder.
export async function updateConsultantRole(
  targetId: string,
  role: ConsultantRole,
): Promise<{ error: string } | void> {
  const consultant = await requireConsultant();
  if (consultant.role !== "ADMIN") {
    return { error: "Kun admins kan ændre roller." };
  }

  const target = await db.consultantAccount.findUnique({ where: { id: targetId } });
  if (!target) return { error: "Konsulenten findes ikke." };

  if (target.role === "ADMIN" && role !== "ADMIN") {
    const adminCount = await db.consultantAccount.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return { error: "Der skal altid være mindst én admin." };
    }
  }

  await db.consultantAccount.update({ where: { id: targetId }, data: { role } });

  await logAdminAction(consultant.id, "CHANGE_ROLE", {
    targetType: "ConsultantAccount",
    targetId,
    detail: `${target.email}: ${target.role} → ${role}`,
  });
  revalidatePath("/admin/consultants");
}

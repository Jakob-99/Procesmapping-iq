"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireConsultant } from "@/lib/consultant-session";
import { logAdminAction } from "@/lib/audit";

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

  const created = await db.consultantAccount.create({
    data: { name: trimmedName, email: trimmedEmail },
  });

  await logAdminAction(consultant.id, "INVITE_CONSULTANT", {
    targetType: "ConsultantAccount",
    targetId: created.id,
    detail: trimmedEmail,
  });
  revalidatePath("/admin/consultants");
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
  revalidatePath("/admin/consultants");
}

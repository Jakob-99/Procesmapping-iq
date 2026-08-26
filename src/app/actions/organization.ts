"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

// Kontrolpanelet redigerer organisationens navn og hvem der er brugere
// (respondenter) på tværs af hele appen — derfor revalideres roden, ikke en
// enkelt underside.
export async function updateOrganizationName(organizationId: string, name: string) {
  if (!name.trim()) return;
  await db.organization.update({
    where: { id: organizationId },
    data: { name: name.trim() },
  });
  revalidatePath("/", "layout");
}

export async function createUser(
  organizationId: string,
  name: string,
  email: string,
  role: string,
) {
  if (!name.trim() || !email.trim()) return;
  await db.user.create({
    data: {
      organizationId,
      name: name.trim(),
      email: email.trim(),
      role,
    },
  });
  revalidatePath("/", "layout");
}

export async function updateUser(
  userId: string,
  name: string,
  email: string,
  role: string,
) {
  if (!name.trim() || !email.trim()) return;
  await db.user.update({
    where: { id: userId },
    data: { name: name.trim(), email: email.trim(), role },
  });
  revalidatePath("/", "layout");
}

export async function deleteUser(userId: string) {
  await db.user.delete({ where: { id: userId } });
  revalidatePath("/", "layout");
}

"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

function isDuplicateEmailError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    (error.meta?.target as string[] | undefined)?.includes("email")
  );
}

// Kontrolpanelet redigerer organisationens navn og hvem der er brugere
// (dem der kan logge ind og bruge systemet — ikke Respondenter, se
// /respondents) på tværs af hele appen — derfor revalideres roden, ikke en
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
  if (!name.trim() || !email.trim()) return { error: null };
  try {
    await db.user.create({
      data: {
        organizationId,
        name: name.trim(),
        email: email.trim(),
        role,
      },
    });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      return { error: "En bruger med denne mail findes allerede." };
    }
    throw error;
  }
  revalidatePath("/", "layout");
  return { error: null };
}

export async function updateUser(
  userId: string,
  name: string,
  email: string,
  role: string,
) {
  if (!name.trim() || !email.trim()) return { error: null };
  try {
    await db.user.update({
      where: { id: userId },
      data: { name: name.trim(), email: email.trim(), role },
    });
  } catch (error) {
    if (isDuplicateEmailError(error)) {
      return { error: "En bruger med denne mail findes allerede." };
    }
    throw error;
  }
  revalidatePath("/", "layout");
  return { error: null };
}

export async function deleteUser(userId: string) {
  await db.user.delete({ where: { id: userId } });
  revalidatePath("/", "layout");
}

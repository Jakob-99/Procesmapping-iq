"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { assertRoleOwnership } from "@/lib/ownership";

export async function createRole(name: string, description?: string) {
  if (!name.trim()) return null;
  const engagement = await requireEngagement();
  const role = await db.businessRole.create({
    data: {
      engagementId: engagement.id,
      name: name.trim(),
      description: description?.trim() || null,
    },
  });
  revalidatePath("/roles");
  return role;
}

export async function deleteRole(id: string) {
  await assertRoleOwnership(id);
  await db.businessRole.delete({ where: { id } });
  revalidatePath("/roles");
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";

export async function createRole(name: string, description?: string) {
  if (!name.trim()) return;
  const engagement = await requireEngagement();
  await db.businessRole.create({
    data: {
      engagementId: engagement.id,
      name: name.trim(),
      description: description?.trim() || null,
    },
  });
  revalidatePath("/roles");
}

export async function deleteRole(id: string) {
  await db.businessRole.delete({ where: { id } });
  revalidatePath("/roles");
}

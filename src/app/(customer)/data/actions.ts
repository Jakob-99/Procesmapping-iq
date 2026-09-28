"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { assertDataObjectOwnership } from "@/lib/ownership";

// Master data sættes ikke ved oprettelsen — det er en vurdering der kommer
// senere i kortlægningen, ikke noget man kan afgøre i samme åndedrag som at
// navngive objektet.
export async function createDataObject(
  name: string,
  description?: string,
  ownerSystemId?: string,
) {
  if (!name.trim()) return null;
  const engagement = await requireEngagement();
  const dataObject = await db.dataObject.create({
    data: {
      engagementId: engagement.id,
      name: name.trim(),
      description: description?.trim() || null,
      ownerSystemId: ownerSystemId || null,
    },
  });
  revalidatePath("/data");
  return dataObject;
}

export async function deleteDataObject(id: string) {
  await assertDataObjectOwnership(id);
  await db.dataObject.delete({ where: { id } });
  revalidatePath("/data");
}

"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";

export async function createSystem(
  name: string,
  category?: string,
  canAgentConnect?: boolean,
  isMasterData?: boolean,
  notes?: string,
) {
  if (!name.trim()) return;
  const engagement = await requireEngagement();
  await db.systemRef.create({
    data: {
      engagementId: engagement.id,
      name: name.trim(),
      category: category?.trim() || null,
      canAgentConnect: !!canAgentConnect,
      isMasterData: !!isMasterData,
      notes: notes?.trim() || null,
    },
  });
  revalidatePath("/landscape");
}

export async function deleteSystem(id: string) {
  // DataObject.ownerSystemId har ingen cascade — ryd referencen først.
  await db.dataObject.updateMany({
    where: { ownerSystemId: id },
    data: { ownerSystemId: null },
  });
  await db.systemRef.delete({ where: { id } });
  revalidatePath("/landscape");
  revalidatePath("/data");
}

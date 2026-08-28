"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { assertSystemOwnership } from "@/lib/ownership";

export async function createSystem(
  name: string,
  category?: string,
  canAgentConnect?: boolean,
  isMasterData?: boolean,
  notes?: string,
) {
  if (!name.trim()) return null;
  const engagement = await requireEngagement();
  const system = await db.systemRef.create({
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
  return system;
}

// AI-parathedsrapportens grundlag pr. system — redigeres fra /landscape/readiness.
export async function updateSystemReadiness(
  id: string,
  data: {
    hasOpenApi: boolean;
    masterDataQuality: "GOOD" | "PARTIAL" | "POOR" | "";
    processesUpToDate: boolean;
    readinessNotes: string;
  },
) {
  await assertSystemOwnership(id);
  await db.systemRef.update({
    where: { id },
    data: {
      hasOpenApi: data.hasOpenApi,
      masterDataQuality: data.masterDataQuality || null,
      processesUpToDate: data.processesUpToDate,
      readinessNotes: data.readinessNotes.trim() || null,
    },
  });
  revalidatePath("/landscape/readiness");
  revalidatePath("/landscape");
}

export async function deleteSystem(id: string) {
  await assertSystemOwnership(id);
  // DataObject.ownerSystemId har ingen cascade — ryd referencen først.
  await db.dataObject.updateMany({
    where: { ownerSystemId: id },
    data: { ownerSystemId: null },
  });
  await db.systemRef.delete({ where: { id } });
  revalidatePath("/landscape");
  revalidatePath("/data");
}

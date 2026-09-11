"use server";

import { revalidatePath } from "next/cache";
import { requireEngagement } from "@/lib/engagement";
import { db } from "@/lib/db";
import { generateApiKey, hashApiKey } from "@/lib/api-keys";

// Kundens egen håndtering af MCP-nøgler i Kontrolpanelet — samme ApiKey-
// model som konsulentens adminpanel kunne oprette nøgler fra, men her
// hentes engagementId ALTID fra kundens egen session (requireEngagement),
// aldrig fra klienten, så en bruger ikke kan oprette/tilbagekalde nøgler for
// et andet engagement ved at kende/gætte et id.
export async function createApiKey(name: string): Promise<{ key: string } | { error: string }> {
  const engagement = await requireEngagement();

  const trimmedName = name.trim();
  if (!trimmedName) return { error: "Giv nøglen et navn." };

  const key = generateApiKey();
  await db.apiKey.create({
    data: { engagementId: engagement.id, name: trimmedName, keyHash: hashApiKey(key) },
  });

  revalidatePath("/", "layout");
  return { key };
}

export async function revokeApiKey(apiKeyId: string) {
  const engagement = await requireEngagement();

  await db.apiKey.updateMany({
    where: { id: apiKeyId, engagementId: engagement.id },
    data: { revokedAt: new Date() },
  });

  revalidatePath("/", "layout");
}

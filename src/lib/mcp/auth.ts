import { db } from "@/lib/db";
import { hashApiKey } from "@/lib/api-keys";

// Erstatter requireEngagement() (cookie-session, se lib/engagement.ts) for
// eksterne klienter der ikke har en browser-session — de sender i stedet en
// API-nøgle i Authorization-headeren. Slår kun op på keyHash, aldrig den rå
// nøgle, og afviser en tilbagekaldt nøgle ligesom den slet ikke fandtes.
export async function resolveApiKey(authHeader: string | null): Promise<{ engagementId: string } | null> {
  const key = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!key) return null;

  const keyHash = hashApiKey(key);
  const record = await db.apiKey.findUnique({ where: { keyHash } });
  if (!record || record.revokedAt) return null;

  await db.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  return { engagementId: record.engagementId };
}

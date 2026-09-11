import { db } from "@/lib/db";
import { hashApiKey } from "@/lib/api-keys";

// Erstatter requireEngagement() (cookie-session, se lib/engagement.ts) for
// eksterne klienter der ikke har en browser-session — de sender i stedet en
// API-nøgle. Understøtter både "Authorization: Bearer <nøgle>" og
// "x-api-key: <nøgle>" — nogle MCP-klienter (bl.a. Claude selv) reserverer
// Authorization-headeren til deres egen OAuth-mekanisme og lader dig kun
// vælge blandt navngivne custom headers som x-api-key. Slår kun op på
// keyHash, aldrig den rå nøgle, og afviser en tilbagekaldt nøgle ligesom
// den slet ikke fandtes.
export async function resolveApiKey(headers: Headers): Promise<{ engagementId: string } | null> {
  const bearer = headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const key = bearer || headers.get("x-api-key")?.trim();
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

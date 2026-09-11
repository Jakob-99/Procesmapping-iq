import { randomBytes, createHash } from "crypto";

// Nøglen selv vises kun i det øjeblik den oprettes — vi gemmer aldrig den
// rå værdi, kun dens hash (samme princip som man ville bruge til en
// adgangskode, men uden bcrypt: dette er en høj-entropi, maskingenereret
// nøgle, ikke noget en bruger vælger, så en simpel sha256 er nok til at
// forhindre at en database-lækage afslører brugbare nøgler).
const PREFIX = "ciq_";

export function generateApiKey(): string {
  return PREFIX + randomBytes(24).toString("base64url");
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

import { db } from "./db";
import { requireEngagement } from "./engagement";

// Enhver server action der tager et id fra klienten skal tjekke at rækken
// rent faktisk hører til den indloggede brugers engagement, ikke en
// tilfældig anden kundes — ellers kan man mutere data på tværs af kunder ved
// at kende/gætte et cuid. Kaster ved mismatch/manglende række — det er en
// tamper-vej, ikke noget der sker ved normal brug.
async function assertEngagementId(engagementId: string | null | undefined) {
  const engagement = await requireEngagement();
  if (engagementId !== engagement.id) throw new Error("Ikke fundet.");
  return engagement;
}

export async function assertProcessOwnership(processId: string) {
  const process = await db.process.findUnique({
    where: { id: processId },
    select: { engagementId: true },
  });
  return assertEngagementId(process?.engagementId);
}

export async function assertSubProcessOwnership(subProcessId: string) {
  const sub = await db.subProcess.findUnique({
    where: { id: subProcessId },
    select: { process: { select: { engagementId: true } } },
  });
  return assertEngagementId(sub?.process.engagementId);
}

export async function assertSystemOwnership(systemId: string) {
  const system = await db.systemRef.findUnique({
    where: { id: systemId },
    select: { engagementId: true },
  });
  return assertEngagementId(system?.engagementId);
}

export async function assertDataObjectOwnership(dataObjectId: string) {
  const dataObject = await db.dataObject.findUnique({
    where: { id: dataObjectId },
    select: { engagementId: true },
  });
  return assertEngagementId(dataObject?.engagementId);
}

export async function assertRoleOwnership(roleId: string) {
  const role = await db.businessRole.findUnique({
    where: { id: roleId },
    select: { engagementId: true },
  });
  return assertEngagementId(role?.engagementId);
}

// Bruges hvor et id fra klienten peger på en User (procesejer, ansvarlig) —
// sikrer at brugeren hører til samme organisation som det aktive engagement.
export async function assertUserInEngagement(userId: string) {
  const engagement = await requireEngagement();
  const user = await db.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  if (!user || user.organizationId !== engagement.organizationId) {
    throw new Error("Ikke fundet.");
  }
  return engagement;
}

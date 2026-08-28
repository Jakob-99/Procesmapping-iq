import { db } from "./db";
import { requireEngagement } from "./engagement";

// Skrive-siden manglede ejerskabstjek: en server action der tager et id ind
// (processId, subProcessId, ...) opdaterede/slettede rækken uden at tjekke om
// den overhovedet hører til den indloggede brugers engagement — kun læse-siden
// (sider) var hærdet efter multi-tenant-omlægningen. Disse hjælpere lukker det
// hul ét sted, så hver action kan kalde ét kald i stedet for at gentage
// opslaget selv. Kaster ved mismatch/manglende række — det er en tamper-vej,
// ikke noget der sker ved normal brug.
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

export async function assertProposalOwnership(proposalId: string) {
  const proposal = await db.aiosProposal.findUnique({
    where: { id: proposalId },
    select: { improvement: { select: { engagementId: true } } },
  });
  return assertEngagementId(proposal?.improvement.engagementId);
}

export async function assertExpertOwnership(expertId: string) {
  const expert = await db.subProcessExpert.findUnique({
    where: { id: expertId },
    select: { subProcess: { select: { process: { select: { engagementId: true } } } } },
  });
  return assertEngagementId(expert?.subProcess.process.engagementId);
}

// Bruges hvor et id fra klienten peger på en User (assignee, validator,
// procesekspert) — sikrer at brugeren rent faktisk hører til samme
// organisation som det aktive engagement, ikke en tilfældig anden kunde.
export async function assertUserInEngagement(userId: string) {
  const engagement = await requireEngagement();
  const user = await db.user.findUnique({ where: { id: userId }, select: { organizationId: true } });
  if (!user || user.organizationId !== engagement.organizationId) {
    throw new Error("Ikke fundet.");
  }
  return engagement;
}

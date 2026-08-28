"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { BuildTarget, ResourceReadiness, SystemFunction, ToBeStep } from "@/lib/aios";
import { assertProposalOwnership, assertSubProcessOwnership } from "@/lib/ownership";
import { generateProposalForSubProcess } from "@/lib/proposal-generation";

// Selve flaskehalsanalysen agenten skulle udføre — fandtes ikke som kode,
// kun de manuelt seedede eksempler. Fejl (fx ingen kortlagte skridt endnu,
// eller ingen API-nøgle sat) returneres som { error } i stedet for at kaste —
// samme mønster som createCustomer — så et fejlende kald ikke forveksles med
// redirect()-kaldet, der SKAL kunne "kaste" uhindret ved succes.
export async function generateProposal(subProcessId: string): Promise<{ error: string } | never> {
  await assertSubProcessOwnership(subProcessId);
  let proposalId: string;
  try {
    proposalId = await generateProposalForSubProcess(subProcessId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Kunne ikke generere forslaget." };
  }
  revalidatePath("/improvements");
  redirect(`/improvements/${proposalId}`);
}

// Genbruger AiosProposal.selected (Pick-matrix-feltet) som "pin" — samme idé:
// et forslag man vil holde øje med, uden at det er en formel prioritering endnu.
export async function togglePin(proposalId: string) {
  await assertProposalOwnership(proposalId);
  const proposal = await db.aiosProposal.findUnique({
    where: { id: proposalId },
    select: { selected: true },
  });
  if (!proposal) return;
  await db.aiosProposal.update({
    where: { id: proposalId },
    data: { selected: !proposal.selected },
  });
  revalidatePath("/improvements");
}

// Ét samlet gem-kald for hele Forbedringsrapportens redigerbare grundlag —
// strategisk mål, berørte roller, og (hvis relevant) AIOS-systemets
// funktionsliste og to-be-processen. Redigeres fra ProposalReportEditor.
export async function updateProposalReport(
  proposalId: string,
  data: {
    strategicGoal: string;
    rolesAffected: string[];
    requiresSystem: boolean;
    systemFunctions: SystemFunction[];
    toBeSteps: ToBeStep[];
    buildsInto: BuildTarget[];
    resourceReadiness: ResourceReadiness | "";
    resourceNotes: string;
  },
) {
  await assertProposalOwnership(proposalId);
  await db.aiosProposal.update({
    where: { id: proposalId },
    data: {
      strategicGoal: data.strategicGoal.trim() || null,
      rolesAffected: data.rolesAffected.length ? JSON.stringify(data.rolesAffected) : null,
      requiresSystem: data.requiresSystem,
      systemFunctions: data.requiresSystem && data.systemFunctions.length
        ? JSON.stringify(data.systemFunctions)
        : null,
      toBeSteps: data.toBeSteps.length ? JSON.stringify(data.toBeSteps) : null,
      buildsInto: data.buildsInto.length ? JSON.stringify(data.buildsInto) : null,
      resourceReadiness: data.resourceReadiness || null,
      resourceNotes: data.resourceNotes.trim() || null,
    },
  });
  revalidatePath(`/improvements/${proposalId}`);
  revalidatePath("/improvements");
}

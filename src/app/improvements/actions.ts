"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

// Genbruger AiosProposal.selected (Pick-matrix-feltet) som "pin" — samme idé:
// et forslag man vil holde øje med, uden at det er en formel prioritering endnu.
export async function togglePin(proposalId: string) {
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

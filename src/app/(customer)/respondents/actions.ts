"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { assertRespondentOwnership } from "@/lib/ownership";

export async function createRespondent(
  name: string,
  email: string,
  title?: string,
  notes?: string,
) {
  if (!name.trim() || !email.trim()) return null;
  const engagement = await requireEngagement();
  const respondent = await db.respondent.create({
    data: {
      engagementId: engagement.id,
      name: name.trim(),
      email: email.trim(),
      title: title?.trim() || null,
      notes: notes?.trim() || null,
    },
  });
  revalidatePath("/respondents");
  return respondent;
}

export async function updateRespondent(
  id: string,
  name: string,
  email: string,
  title?: string,
  notes?: string,
) {
  await assertRespondentOwnership(id);
  if (!name.trim() || !email.trim()) return;
  await db.respondent.update({
    where: { id },
    data: {
      name: name.trim(),
      email: email.trim(),
      title: title?.trim() || null,
      notes: notes?.trim() || null,
    },
  });
  revalidatePath("/respondents");
}

export async function deleteRespondent(id: string) {
  await assertRespondentOwnership(id);
  await db.respondent.delete({ where: { id } });
  revalidatePath("/respondents");
}

export async function importRespondents(
  rows: { name: string; email: string; title?: string }[],
): Promise<{ imported: number }> {
  const engagement = await requireEngagement();
  const valid = rows.filter((r) => r.name.trim() && r.email.trim());
  await db.$transaction(
    valid.map((r) =>
      db.respondent.upsert({
        where: { engagementId_email: { engagementId: engagement.id, email: r.email.trim() } },
        update: { name: r.name.trim(), title: r.title?.trim() || null },
        create: {
          engagementId: engagement.id,
          name: r.name.trim(),
          email: r.email.trim(),
          title: r.title?.trim() || null,
        },
      }),
    ),
  );
  revalidatePath("/respondents");
  return { imported: valid.length };
}

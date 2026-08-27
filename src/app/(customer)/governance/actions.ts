"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { runUpdateCheck } from "@/lib/governance";

export async function setPolicyActive(subProcessId: string, active: boolean) {
  await db.updatePolicy.upsert({
    where: { subProcessId },
    create: { subProcessId, active },
    update: { active },
  });
  revalidatePath("/governance");
}

export async function setPolicyInterval(subProcessId: string, intervalDays: number) {
  await db.updatePolicy.upsert({
    where: { subProcessId },
    create: { subProcessId, intervalDays },
    update: { intervalDays },
  });
  revalidatePath("/governance");
}

export async function setPolicyAutoEmail(subProcessId: string, autoSendEmail: boolean) {
  await db.updatePolicy.upsert({
    where: { subProcessId },
    create: { subProcessId, autoSendEmail },
    update: { autoSendEmail },
  });
  revalidatePath("/governance");
}

export async function runCheckNow(subProcessId: string) {
  await db.updatePolicy.upsert({
    where: { subProcessId },
    create: { subProcessId, active: true },
    update: {},
  });
  await runUpdateCheck(subProcessId);
  revalidatePath("/governance");
}

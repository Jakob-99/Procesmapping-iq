"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

// Personlige indstillinger — modsat organization.ts (Kontrolpanelet) opererer
// denne KUN på den indloggede brugers egen række, læst fra sessionen selv
// (aldrig et id fra klienten), så man ikke kan redigere andres profil ved at
// sende et andet id ind. Navn/titel er de eneste felter der er personlige —
// mail og rolle hører til Kontrolpanelet.
export async function updateOwnProfile(name: string, title: string) {
  const user = await getSessionUser();
  if (!user || !name.trim()) return;

  await db.user.update({
    where: { id: user.id },
    data: { name: name.trim(), title: title.trim() || null },
  });
  revalidatePath("/", "layout");
}

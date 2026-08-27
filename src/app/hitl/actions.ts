"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

// Konsulenterne er Cornerstones' eget team, ikke kundens organisation — derfor
// ikke koblet på et engagement, og listen er den samme uanset hvilken kunde
// man kigger på.
export async function createConsultant(
  name: string,
  bio?: string,
  email?: string,
  phone?: string,
  bookingUrl?: string,
) {
  if (!name.trim()) return;
  const last = await db.consultant.findFirst({ orderBy: { sortOrder: "desc" } });
  await db.consultant.create({
    data: {
      name: name.trim(),
      bio: bio?.trim() || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      bookingUrl: bookingUrl?.trim() || null,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/hitl");
}

export async function deleteConsultant(id: string) {
  await db.consultant.delete({ where: { id } });
  revalidatePath("/hitl");
}

import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/session";
import { PageHeader } from "@/components/PageHeader";
import { Empty } from "@/components/ui";
import { ConsultantCreator } from "@/components/ConsultantCreator";
import { ConsultantCard } from "@/components/ConsultantCard";

export const dynamic = "force-dynamic";

export default async function HitlPage() {
  await requireSessionUser();

  const consultants = await db.consultant.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Kontakt en konsulent"
        lead="Agenten kan meget, men ikke alt. Her er de rigtige mennesker bag Corner IQ — skriv, ring eller book et møde direkte."
      />

      <div className="p-8">
        <ConsultantCreator />
        {consultants.length === 0 ? (
          <Empty>Ingen konsulenter tilføjet endnu.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {consultants.map((c) => (
              <ConsultantCard
                key={c.id}
                id={c.id}
                name={c.name}
                bio={c.bio}
                email={c.email}
                phone={c.phone}
                bookingUrl={c.bookingUrl}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

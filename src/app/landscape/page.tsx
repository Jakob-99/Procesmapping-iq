import Link from "next/link";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Empty, OutlineButton } from "@/components/ui";
import { SystemCreator } from "@/components/SystemCreator";
import { SystemCard } from "@/components/SystemCard";

export const dynamic = "force-dynamic";

export default async function LandscapePage() {
  const engagement = await requireEngagement();

  const systems = await db.systemRef.findMany({
    where: { engagementId: engagement.id },
    include: {
      stepLinks: { include: { step: { include: { subProcess: true } } } },
    },
    orderBy: { name: "asc" },
  });

  // Antal distinkte underprocesser der rører systemet — hvor dybt det sidder i forretningen.
  const reach = (links: { step: { subProcess: { id: string } } }[]) =>
    new Set(links.map((l) => l.step.subProcess.id)).size;

  return (
    <div>
      <PageHeader
        eyebrow={`${systems.length} i systemlandskabet`}
        title="Systemer"
        lead="Hvert system er her, fordi en medarbejder faktisk nævnte det i et interview. Agenten holder listen ajour, så det samme system ikke dukker op under to navne."
      />

      <div className="p-8">
        <div className="mb-4 flex items-center justify-between">
          <SystemCreator />
          <Link href="/landscape/readiness">
            <OutlineButton>Se AI-parathedsrapport →</OutlineButton>
          </Link>
        </div>
        {systems.length === 0 ? (
          <Empty>Ingen systemer kortlagt endnu.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {systems.map((s) => (
              <SystemCard
                key={s.id}
                id={s.id}
                name={s.name}
                category={s.category}
                isMasterData={s.isMasterData}
                canAgentConnect={s.canAgentConnect}
                notes={s.notes}
                processCount={reach(s.stepLinks)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

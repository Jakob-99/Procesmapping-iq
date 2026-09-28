import Link from "next/link";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Empty, OutlineButton } from "@/components/ui";
import { SystemCreator } from "@/components/SystemCreator";
import { SystemCard } from "@/components/SystemCard";
import { PixelIcon } from "@/components/FoundationCard";
import { StatStrip, usageBySubProcess } from "@/components/EntityParts";
import { agentCanConnect, parseIntegrations } from "@/lib/domain";

export const dynamic = "force-dynamic";

const STEP_SP = { subProcess: { select: { id: true, name: true, process: { select: { id: true, name: true } } } } };

export default async function LandscapePage() {
  const engagement = await requireEngagement();

  const systems = await db.systemRef.findMany({
    where: { engagementId: engagement.id },
    include: {
      stepLinks: { include: { step: { select: STEP_SP } } },
      actorSteps: { select: STEP_SP },
    },
    orderBy: { name: "asc" },
  });

  // Mest brugte først (antal skridt), ellers alfabetisk.
  const cards = systems
    .map((s) => ({
      ...s,
      integrationList: parseIntegrations(s.integrations),
      usage: usageBySubProcess([...s.stepLinks.map((l) => l.step), ...s.actorSteps]),
      stepCount: s.stepLinks.length + s.actorSteps.length,
    }))
    .sort((a, b) => b.stepCount - a.stepCount || a.name.localeCompare(b.name, "da"));

  const inUse = cards.filter((c) => c.usage.length > 0).length;
  const unclear = cards.filter((c) => c.integrationList.length === 0).length;

  return (
    <div>
      <PageHeader
        icon={<PixelIcon kind="system" px={4} />}
        eyebrow="Systemlandskab"
        title="Systemer"
        lead="IT-systemerne i landskabet. Et system kobles på processkridt — som noget skridtet læser eller skriver i, eller som aktøren der udfører skridtet."
        action={
          <Link href="/landscape/readiness">
            <OutlineButton>Se AI-parathedsrapport →</OutlineButton>
          </Link>
        }
      />

      <div className="mx-auto max-w-6xl space-y-8 px-8 py-8">
        <StatStrip
          stats={[
            { label: "Systemer", value: systems.length, hint: `${unclear} uden afklaret integration` },
            { label: "I brug", value: inUse, hint: `${systems.length - inUse} ikke koblet på en proces` },
            { label: "Agent-klar", value: cards.filter((c) => agentCanConnect(c.integrationList)).length, hint: "via API, MCP eller RPA" },
            { label: "Stamdata", value: systems.filter((s) => s.isMasterData).length, hint: "systemer der ejer stamdata" },
          ]}
        />

        <SystemCreator />

        {systems.length === 0 ? (
          <Empty>Ingen systemer kortlagt endnu.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((s) => (
              <SystemCard
                key={s.id}
                id={s.id}
                name={s.name}
                category={s.category}
                isMasterData={s.isMasterData}
                integrations={s.integrationList}
                notes={s.notes}
                usage={s.usage}
                actorCount={s.actorSteps.length}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Empty } from "@/components/ui";
import { RoleCreator } from "@/components/RoleCreator";
import { RoleRow } from "@/components/RoleRow";
import { PixelIcon } from "@/components/FoundationCard";
import { StatStrip, usageBySubProcess } from "@/components/EntityParts";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const engagement = await requireEngagement();

  const roles = await db.businessRole.findMany({
    where: { engagementId: engagement.id },
    include: {
      steps: { select: { subProcess: { select: { id: true, name: true, process: { select: { id: true, name: true } } } } } },
    },
    orderBy: { name: "asc" },
  });

  // Mest aktive roller først, så dem uden skridt samlet nederst.
  const cards = roles
    .map((r) => ({ ...r, usage: usageBySubProcess(r.steps) }))
    .sort((a, b) => b.steps.length - a.steps.length || a.name.localeCompare(b.name, "da"));
  const active = cards.filter((c) => c.steps.length > 0);
  const idle = cards.filter((c) => c.steps.length === 0);
  const totalSteps = cards.reduce((n, c) => n + c.steps.length, 0);
  const busiest = active[0];

  const grid = (list: typeof cards) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((r) => (
        <RoleRow
          key={r.id}
          id={r.id}
          name={r.name}
          description={r.description}
          usage={r.usage}
          stepCount={r.steps.length}
        />
      ))}
    </div>
  );

  return (
    <div>
      <PageHeader
        icon={<PixelIcon kind="role" px={4} />}
        eyebrow="Forretningens aktører"
        title="Roller"
        lead="De faste roller i forretningen — menneskelige aktører, ikke navngivne personer. Hvert processkridt udføres af en rolle."
      />

      <div className="mx-auto max-w-6xl space-y-8 px-8 py-8">
        <StatStrip
          stats={[
            { label: "Roller", value: roles.length },
            { label: "Aktive", value: active.length, hint: `${idle.length} uden skridt endnu` },
            { label: "Skridt fordelt", value: totalSteps, hint: "skridt med en rolle som aktør" },
            {
              label: "Travleste",
              value: busiest ? busiest.steps.length : "–",
              hint: busiest ? busiest.name : "ingen skridt endnu",
            },
          ]}
        />

        <RoleCreator />

        {roles.length === 0 ? (
          <Empty>Ingen roller defineret endnu.</Empty>
        ) : (
          grid(cards)
        )}
      </div>
    </div>
  );
}

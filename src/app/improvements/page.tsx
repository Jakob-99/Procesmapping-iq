import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { ProposalGrid } from "@/components/ProposalGrid";
import { Empty, Panel, Stat } from "@/components/ui";
import { pickScore } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function ImprovementsPage() {
  const engagement = await requireEngagement();

  const [processes, improvements] = await Promise.all([
    db.process.findMany({
      where: { engagementId: engagement.id },
      orderBy: { sortOrder: "asc" },
    }),
    db.improvement.findMany({
      where: { engagementId: engagement.id },
      include: {
        process: true,
        subProcess: true,
        proposals: { include: { processLinks: { include: { process: true } } } },
      },
    }),
  ]);

  // Samme rækkefølge som procesmodellen: kerne først, så støtte — nummeret er dét man peger på i et møde.
  const ordered = [
    ...processes.filter((p) => p.category === "CORE"),
    ...processes.filter((p) => p.category !== "CORE"),
  ];
  const numberOf = new Map(ordered.map((p, i) => [p.id, i + 1]));

  const proposals = improvements.flatMap((imp) =>
    imp.proposals.map((prop) => ({
      id: prop.id,
      name: prop.name,
      layer: prop.layer,
      potential: pickScore(prop),
      pinned: prop.selected,
      processNumbers: prop.processLinks
        .map((l) => numberOf.get(l.processId))
        .filter((n): n is number => n !== undefined),
    })),
  );

  const scored = proposals.filter((p) => p.potential !== null);
  const avgPotential = scored.length
    ? Math.round(scored.reduce((a, p) => a + (p.potential ?? 0), 0) / scored.length)
    : 0;
  const topPotential = scored.length ? Math.max(...scored.map((p) => p.potential ?? 0)) : 0;
  const orchestration = proposals.filter((p) => p.layer === "ORCHESTRATION").length;

  return (
    <div>
      <PageHeader
        eyebrow="Innovation"
        title="Optimering"
        lead="Forbedringsrapporter — måder AIOS-systemer og andre løsninger kan forbedre de kortlagte processer, fundet af agenten."
      />

      <div className="space-y-5 p-8">
        <div className="grid gap-6 sm:grid-cols-4">
          <Stat label="Forslag" value={proposals.length} />
          <Stat label="Gennemsnitligt potentiale" value={avgPotential} suffix="/100" accent />
          <Stat label="Højeste potentiale" value={topPotential} suffix="/100" />
          <Stat label="Orkestreringslag" value={orchestration} hint="på tværs af flere e2e-processer" />
        </div>

        <Panel eyebrow="Løsninger" title="Forbedringsrapporter" bodyClass="pt-1">
          {proposals.length === 0 ? (
            <Empty>Ingen flaskehalse fundet endnu.</Empty>
          ) : (
            <ProposalGrid proposals={proposals} />
          )}
        </Panel>
      </div>
    </div>
  );
}

import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Empty } from "@/components/ui";
import { DataObjectCreator } from "@/components/DataObjectCreator";
import { DataObjectCard } from "@/components/DataObjectCard";
import { PixelIcon } from "@/components/FoundationCard";
import { StatStrip, usageBySubProcess } from "@/components/EntityParts";
import { agentCanConnect, parseIntegrations } from "@/lib/domain";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const engagement = await requireEngagement();

  const [dataObjects, systems] = await Promise.all([
    db.dataObject.findMany({
      where: { engagementId: engagement.id },
      include: {
        ownerSystem: true,
        stepLinks: {
          include: {
            step: { select: { subProcess: { select: { id: true, name: true, process: { select: { id: true, name: true } } } } } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.systemRef.findMany({ where: { engagementId: engagement.id }, orderBy: { name: "asc" } }),
  ]);

  // Hvor mange gange objektet læses (input) hhv. skrives (output) på tværs af
  // skridt — "BOTH" tæller begge steder, fordi skridtet både læser og skriver det.
  const cards = dataObjects
    .map((d) => ({
      ...d,
      inputCount: d.stepLinks.filter((l) => l.direction === "INPUT" || l.direction === "BOTH").length,
      outputCount: d.stepLinks.filter((l) => l.direction === "OUTPUT" || l.direction === "BOTH").length,
      usage: usageBySubProcess(d.stepLinks.map((l) => l.step)),
    }))
    .sort((a, b) => b.stepLinks.length - a.stepLinks.length || a.name.localeCompare(b.name, "da"));
  const inUse = cards.filter((c) => c.stepLinks.length > 0).length;

  return (
    <div>
      <PageHeader
        icon={<PixelIcon kind="data" px={4} />}
        eyebrow="Informationen i processerne"
        title="Data"
        lead="Forretningsobjekterne der flyder gennem processerne — ordre, kunde, faktura og lignende. Et objekt er her, fordi et processkridt læser eller skriver det."
      />

      <div className="mx-auto max-w-6xl space-y-8 px-8 py-8">
        <StatStrip
          stats={[
            { label: "Dataobjekter", value: dataObjects.length, hint: "ordre, kunde, faktura …" },
            { label: "I brug", value: inUse, hint: `${dataObjects.length - inUse} ikke koblet på et skridt` },
            { label: "Stamdata", value: dataObjects.filter((d) => d.isMasterData).length, hint: "grunddata der genbruges" },
            {
              label: "Uden ejersystem",
              value: dataObjects.filter((d) => !d.ownerSystem).length,
              hint: "hvor bor de?",
            },
          ]}
        />

        <DataObjectCreator systems={systems.map((s) => ({ id: s.id, name: s.name }))} />

        {dataObjects.length === 0 ? (
          <Empty>Ingen dataobjekter kortlagt endnu.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((d) => (
              <DataObjectCard
                key={d.id}
                id={d.id}
                name={d.name}
                description={d.description}
                ownerSystemName={d.ownerSystem?.name ?? null}
                isMasterData={d.isMasterData}
                agentAvailable={agentCanConnect(parseIntegrations(d.ownerSystem?.integrations))}
                inputCount={d.inputCount}
                outputCount={d.outputCount}
                usage={d.usage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

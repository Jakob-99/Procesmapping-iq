import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Empty } from "@/components/ui";
import { DataObjectCreator } from "@/components/DataObjectCreator";
import { DataObjectCard } from "@/components/DataObjectCard";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const engagement = await requireEngagement();

  const dataObjects = await db.dataObject.findMany({
    where: { engagementId: engagement.id },
    include: {
      ownerSystem: true,
      stepLinks: {
        include: { step: { include: { subProcess: { include: { process: true } } } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const systems = await db.systemRef.findMany({
    where: { engagementId: engagement.id },
    orderBy: { name: "asc" },
  });

  type Link = {
    direction: string | null;
    step: { subProcess: { process: { name: string } } };
  };

  // Hvor mange gange objektet optræder som input hhv. output på tværs af
  // skridt — "BOTH" tæller med begge steder, fordi skridtet både læser og
  // skriver det.
  const usage = (links: Link[]) => ({
    inputCount: links.filter((l) => l.direction === "INPUT" || l.direction === "BOTH").length,
    outputCount: links.filter((l) => l.direction === "OUTPUT" || l.direction === "BOTH").length,
    processNames: [...new Set(links.map((l) => l.step.subProcess.process.name))],
  });

  return (
    <div>
      <PageHeader
        eyebrow={`${dataObjects.length} kontekstobjekter`}
        title="Data"
        lead="Forretningsobjekterne der flyder gennem processerne — Ordre, Kunde, Faktura og lignende. Hvert objekt er her, fordi et processkridt bruger det som input eller output kontekst."
      />

      <div className="p-8">
        <DataObjectCreator systems={systems.map((s) => ({ id: s.id, name: s.name }))} />
        {dataObjects.length === 0 ? (
          <Empty>Ingen kontekstobjekter kortlagt endnu.</Empty>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dataObjects.map((d) => {
              const { inputCount, outputCount, processNames } = usage(d.stepLinks);
              return (
                <DataObjectCard
                  key={d.id}
                  id={d.id}
                  name={d.name}
                  description={d.description}
                  ownerSystemName={d.ownerSystem?.name ?? null}
                  isMasterData={d.isMasterData}
                  agentAvailable={!!d.ownerSystem?.canAgentConnect}
                  inputCount={inputCount}
                  outputCount={outputCount}
                  processNames={processNames}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

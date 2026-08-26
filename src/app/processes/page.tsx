import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { ProcessModel } from "@/components/ProcessModel";
import { ProcessCreator } from "@/components/ProcessCreator";
import { Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProcessesPage() {
  const engagement = await requireEngagement();

  const processes = await db.process.findMany({
    where: { engagementId: engagement.id },
    orderBy: { sortOrder: "asc" },
    include: { owner: true, subProcesses: true },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Procesmodel"
        title="Processer"
        lead="Vælg en end-to-end proces for at se dens underprocesser. Hver underproces kortlægges gennem et interview med den medarbejder der udfører den."
      />

      <div className="space-y-5 p-8">
        <Panel
          eyebrow={`${processes.length} processer`}
          title="Virksomhedens procesmodel"
          bodyClass="p-4"
        >
          <ProcessCreator />
          <ProcessModel processes={processes} />
        </Panel>
      </div>
    </div>
  );
}

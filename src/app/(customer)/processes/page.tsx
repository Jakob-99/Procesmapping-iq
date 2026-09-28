import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { ProcessModel } from "@/components/ProcessModel";
import { ProcessCreator } from "@/components/ProcessCreator";
import { PixelIcon } from "@/components/FoundationCard";

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
        icon={<PixelIcon kind="process" px={4} />}
        eyebrow="Procesmodel"
        title="Processer"
        lead="Vælg en end-to-end proces for at se dens underprocesser. Hver underproces kortlægges som et svimlane-diagram med én svimlane pr. rolle eller system."
      />

      <div className="p-8">
        <ProcessCreator />
        <ProcessModel processes={processes} />
      </div>
    </div>
  );
}

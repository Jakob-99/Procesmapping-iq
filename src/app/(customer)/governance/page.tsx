import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Empty } from "@/components/ui";
import { Panel } from "@/components/ui";
import { GovernanceRow, type GovernanceRowData } from "@/components/GovernanceRow";

export const dynamic = "force-dynamic";

export default async function GovernancePage() {
  const engagement = await requireEngagement();

  const processes = await db.process.findMany({
    where: { engagementId: engagement.id },
    orderBy: { sortOrder: "asc" },
    include: {
      subProcesses: {
        where: { inScope: true },
        orderBy: { sortOrder: "asc" },
        include: {
          assignee: true,
          updatePolicy: {
            include: { runs: { orderBy: { ranAt: "desc" }, take: 1 } },
          },
        },
      },
    },
  });

  const rows: { processName: string; items: GovernanceRowData[] }[] = processes
    .map((p) => ({
      processName: p.name,
      items: p.subProcesses.map((sp) => {
        const run = sp.updatePolicy?.runs[0] ?? null;
        return {
          subProcessId: sp.id,
          name: sp.name,
          processName: p.name,
          assigneeName: sp.assignee?.name ?? null,
          policy: {
            active: sp.updatePolicy?.active ?? false,
            intervalDays: sp.updatePolicy?.intervalDays ?? 90,
            autoSendEmail: sp.updatePolicy?.autoSendEmail ?? false,
            lastCheckedAt: sp.updatePolicy?.lastCheckedAt?.toISOString() ?? null,
            lastEmailAt: sp.updatePolicy?.lastEmailAt?.toISOString() ?? null,
          },
          lastRun: run
            ? {
                ranAt: run.ranAt.toISOString(),
                needsUpdate: run.needsUpdate,
                finding: run.finding,
                emailSent: run.emailSent,
                emailTo: run.emailTo,
              }
            : null,
        };
      }),
    }))
    .filter((g) => g.items.length > 0);

  const totalActive = rows.reduce(
    (sum, g) => sum + g.items.filter((i) => i.policy.active).length,
    0,
  );

  return (
    <div>
      <PageHeader
        title="Opdatering styring"
        lead={`Vælg hvilke underprocesser agenten selv skal holde øje med, og hvor ofte. Er "Send mail selv" slået til, sender agenten en påmindelse direkte til den tildelte medarbejder, når den vurderer at materialet trænger til et eftersyn — ellers logges vurderingen kun her. ${totalActive} underproces${totalActive === 1 ? "" : "ser"} er aktiv${totalActive === 1 ? "" : "e"} lige nu.`}
      />

      <div className="space-y-6 p-8">
        {rows.length === 0 ? (
          <Empty>Ingen underprocesser i scope endnu.</Empty>
        ) : (
          rows.map((g) => (
            <Panel key={g.processName} title={g.processName}>
              <div>
                {g.items.map((item) => (
                  <GovernanceRow key={item.subProcessId} row={item} />
                ))}
              </div>
            </Panel>
          ))
        )}
      </div>
    </div>
  );
}

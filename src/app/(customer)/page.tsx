import Link from "next/link";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Stat, Panel, Badge, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Sendt, afventer svar",
  COMPLETED: "Afsluttet",
};

export default async function OverviewPage() {
  const engagement = await requireEngagement();

  const [respondentCount, agentCount, openCount, completedCount, recent] = await Promise.all([
    db.respondent.count({ where: { engagementId: engagement.id } }),
    db.interviewAgent.count({ where: { engagementId: engagement.id } }),
    db.interview.count({ where: { engagementId: engagement.id, status: "OPEN" } }),
    db.interview.count({ where: { engagementId: engagement.id, status: "COMPLETED" } }),
    db.interview.findMany({
      where: { engagementId: engagement.id },
      include: { interviewAgent: true, respondent: true },
      orderBy: { startedAt: "desc" },
      take: 6,
    }),
  ]);

  return (
    <div>
      <PageHeader title="Oversigt" lead="Interview-platformen for dette forløb." />

      <div className="p-8">
        <div className="mb-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Respondenter" value={respondentCount} />
          <Stat label="Interview agenter" value={agentCount} />
          <Stat label="Afventer svar" value={openCount} accent />
          <Stat label="Afsluttet" value={completedCount} />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div className="eyebrow">Seneste interviews</div>
          <Link href="/interviews" className="text-[12.5px] text-(--color-muted) hover:text-(--color-text)">
            Se alle →
          </Link>
        </div>

        {recent.length === 0 ? (
          <Empty>
            Ingen interviews endnu — opret en{" "}
            <Link href="/agents" className="text-(--color-clay) hover:underline">
              interview agent
            </Link>{" "}
            og send den til en{" "}
            <Link href="/respondents" className="text-(--color-clay) hover:underline">
              respondent
            </Link>
            .
          </Empty>
        ) : (
          <div className="space-y-2.5">
            {recent.map((iv) => (
              <Link key={iv.id} href={`/interviews/${iv.id}`} className="block">
                <Panel className="lift flex items-center justify-between gap-4 transition-colors hover:border-(--color-clay-line)">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium">{iv.interviewAgent.name}</div>
                    <div className="mt-0.5 text-[12.5px] text-(--color-muted)">{iv.respondent.name}</div>
                  </div>
                  <Badge tone={iv.status === "COMPLETED" ? "ok" : "clay"}>
                    {STATUS_LABEL[iv.status] ?? iv.status}
                  </Badge>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

// Indsigter er altid scoped til ÉN interview-agent (ét interview-formål),
// aldrig blandet på tværs af flere — man vælger agenten her først.
export default async function InsightsAgentPickerPage() {
  const engagement = await requireEngagement();

  const agents = await db.interviewAgent.findMany({
    where: { engagementId: engagement.id },
    include: { _count: { select: { interviews: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Indsigter"
        lead="Vælg en interview-agent for at se temaer, citater og spørge på tværs af netop den interview-runde."
      />

      <div className="mx-auto max-w-2xl px-8 py-8">
        {agents.length === 0 ? (
          <Empty>Ingen interview agenter endnu.</Empty>
        ) : (
          <div className="space-y-3">
            {agents.map((a) => (
              <Link key={a.id} href={`/insights/${a.id}`}>
                <Panel className="transition-colors hover:border-(--color-clay-line)">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[14px] font-medium">{a.name}</div>
                      <p className="mt-1 line-clamp-1 text-[12.5px] text-(--color-faint)">{a.goal}</p>
                    </div>
                    <span className="shrink-0 text-[12px] text-(--color-faint)">
                      {a._count.interviews} interviews
                    </span>
                  </div>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

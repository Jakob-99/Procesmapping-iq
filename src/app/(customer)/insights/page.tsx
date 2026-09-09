import Link from "next/link";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

// Indsigter er altid scoped til ÉN interview-runde, aldrig blandet på tværs
// af flere — man vælger runden her først.
export default async function InsightsRoundPickerPage() {
  const engagement = await requireEngagement();

  const rounds = await db.interviewRound.findMany({
    where: { engagementId: engagement.id },
    include: { _count: { select: { interviews: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Indsigter"
        lead="Vælg en interview runde for at se temaer, citater og spørge på tværs af netop de interviews."
      />

      <div className="mx-auto max-w-2xl px-8 py-8">
        {rounds.length === 0 ? (
          <Empty>Ingen interview runder endnu.</Empty>
        ) : (
          <div className="space-y-3">
            {rounds.map((r) => (
              <Link key={r.id} href={`/insights/${r.id}`}>
                <Panel className="transition-colors hover:border-(--color-clay-line)">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-[14px] font-medium">{r.name}</div>
                    <span className="shrink-0 text-[12px] text-(--color-faint)">
                      {r._count.interviews} interviews
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

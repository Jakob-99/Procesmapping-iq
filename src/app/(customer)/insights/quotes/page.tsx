import Link from "next/link";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Empty, Badge } from "@/components/ui";
import { InsightsTabs } from "@/components/InsightsTabs";
import { QuoteDeleteButton } from "@/components/QuoteDeleteButton";

export const dynamic = "force-dynamic";

export default async function InsightsQuotesPage() {
  const engagement = await requireEngagement();

  const quotes = await db.quote.findMany({
    where: { engagementId: engagement.id },
    include: { interview: { include: { respondent: true, interviewAgent: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Indsigter"
        lead="Tematisk analyse, citater og institutionel hukommelse på tværs af alle interviews."
      />

      <div className="mx-auto max-w-3xl px-8 py-8">
        <InsightsTabs />

        {quotes.length === 0 ? (
          <Empty>
            Ingen citater gemt endnu — brug "Citér"-knappen på en
            transskription.
          </Empty>
        ) : (
          <div className="space-y-3">
            {quotes.map((q) => (
              <Panel key={q.id}>
                <div className="flex items-start justify-between gap-4">
                  <p className="text-[14px] italic leading-relaxed text-(--color-text)">
                    &ldquo;{q.text}&rdquo;
                  </p>
                  <QuoteDeleteButton id={q.id} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {q.tag && <Badge tone="clay">{q.tag}</Badge>}
                  <Link
                    href={`/interviews/${q.interviewId}`}
                    className="text-[12px] text-(--color-muted) hover:text-(--color-clay)"
                  >
                    {q.interview.respondent.name} · {q.interview.interviewAgent.name}
                  </Link>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

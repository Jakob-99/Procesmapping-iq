import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Empty, Badge } from "@/components/ui";
import { InsightsTabs } from "@/components/InsightsTabs";
import { QuoteDeleteButton } from "@/components/QuoteDeleteButton";

export const dynamic = "force-dynamic";

export default async function InsightsQuotesPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const engagement = await requireEngagement();

  const agent = await db.interviewAgent.findUnique({ where: { id: agentId } });
  if (!agent || agent.engagementId !== engagement.id) notFound();

  const quotes = await db.quote.findMany({
    where: { interview: { interviewAgentId: agentId } },
    include: { interview: { include: { respondent: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Indsigter"
        lead="Tematisk analyse, citater og institutionel hukommelse for denne interview-agent."
      />

      <div className="mx-auto max-w-3xl px-8 py-8">
        <InsightsTabs agentId={agentId} agentName={agent.name} />

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
                    {q.interview.respondent.name}
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

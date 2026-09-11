import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";
import { InsightsTabs } from "@/components/InsightsTabs";
import { CrossQueryPanel } from "@/components/CrossQueryPanel";

export const dynamic = "force-dynamic";

export default async function InsightsAskPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  const engagement = await requireEngagement();

  const round = await db.interviewRound.findUnique({ where: { id: roundId } });
  if (!round || round.engagementId !== engagement.id) notFound();

  return (
    <div>
      <SetBreadcrumb
        items={[
          { label: "Undersøgelser", href: "/interviews" },
          { label: round.name, href: `/rounds/${roundId}` },
        ]}
      />
      <PageHeader
        title="Indsigter"
        lead="Tematisk analyse, citater og institutionel hukommelse for denne interview-runde."
      />

      <div className="mx-auto max-w-3xl px-8 py-8">
        <InsightsTabs roundId={roundId} roundName={round.name} />
        <CrossQueryPanel roundId={roundId} />
      </div>
    </div>
  );
}

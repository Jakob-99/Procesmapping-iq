import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { InsightsTabs } from "@/components/InsightsTabs";
import { CrossQueryPanel } from "@/components/CrossQueryPanel";

export const dynamic = "force-dynamic";

export default async function InsightsAskPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const engagement = await requireEngagement();

  const agent = await db.interviewAgent.findUnique({ where: { id: agentId } });
  if (!agent || agent.engagementId !== engagement.id) notFound();

  return (
    <div>
      <PageHeader
        title="Indsigter"
        lead="Tematisk analyse, citater og institutionel hukommelse for denne interview-agent."
      />

      <div className="mx-auto max-w-3xl px-8 py-8">
        <InsightsTabs agentId={agentId} agentName={agent.name} />
        <CrossQueryPanel agentId={agentId} />
      </div>
    </div>
  );
}

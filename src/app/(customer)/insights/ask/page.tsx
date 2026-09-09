import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { InsightsTabs } from "@/components/InsightsTabs";
import { CrossQueryPanel } from "@/components/CrossQueryPanel";

export const dynamic = "force-dynamic";

export default async function InsightsAskPage() {
  await requireEngagement();

  return (
    <div>
      <PageHeader
        title="Indsigter"
        lead="Tematisk analyse, citater og institutionel hukommelse på tværs af alle interviews."
      />

      <div className="mx-auto max-w-3xl px-8 py-8">
        <InsightsTabs />
        <CrossQueryPanel />
      </div>
    </div>
  );
}

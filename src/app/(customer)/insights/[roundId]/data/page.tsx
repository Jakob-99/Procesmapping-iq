import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";
import { Panel, Empty, Badge, Stat } from "@/components/ui";
import { InsightsTabs } from "@/components/InsightsTabs";
import { InterviewDownloadButton, DownloadAllButton } from "@/components/RoundTranscriptDownload";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Sendt, afventer svar",
  COMPLETED: "Afsluttet",
};

// Rå data for runden — ingen AI-fortolkning, bare tal og transskriptioner
// klar til download. Adskilt fra Temaer/Citater/Spørg på tværs, som alle er
// AI-genererede konklusioner.
export default async function InsightsDataPage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  const { roundId } = await params;
  const engagement = await requireEngagement();

  const round = await db.interviewRound.findUnique({ where: { id: roundId } });
  if (!round || round.engagementId !== engagement.id) notFound();

  const interviews = await db.interview.findMany({
    where: { interviewRoundId: roundId },
    include: {
      interviewAgent: true,
      respondent: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { startedAt: "desc" },
  });

  const completedCount = interviews.filter((iv) => iv.status === "COMPLETED").length;
  const openCount = interviews.length - completedCount;
  const categoryCounts = new Map<string, number>();
  for (const iv of interviews) {
    const cat = iv.respondent.category;
    if (cat) categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }

  const downloadData = interviews.map((iv) => ({
    id: iv.id,
    agentName: iv.interviewAgent.name,
    respondentName: iv.respondent.name,
    status: iv.status,
    startedAt: iv.startedAt,
    messages: iv.messages.map((m) => ({ role: m.role, content: m.content })),
  }));

  return (
    <div>
      <SetBreadcrumb
        items={[
          { label: "Undersøgelser", href: "/interviews" },
          { label: round.name, href: `/rounds/${roundId}` },
          { label: "Interviews" },
        ]}
      />
      <PageHeader
        title="Interviews"
        lead="Tematisk analyse, citater og institutionel hukommelse for denne interview-runde."
      />

      <div className="mx-auto max-w-3xl px-8 py-8">
        <InsightsTabs roundId={roundId} roundName={round.name} />

        <div className="mb-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Interviews" value={interviews.length} />
          <Stat label="Afsluttet" value={completedCount} />
          <Stat label="Afventer svar" value={openCount} accent={openCount > 0} />
          <Stat label="Forretningsområder" value={categoryCounts.size} />
        </div>

        {categoryCounts.size > 0 && (
          <div className="mb-8">
            <div className="eyebrow mb-3">Fordelt på forretningsområde</div>
            <div className="flex flex-wrap gap-2">
              {Array.from(categoryCounts.entries()).map(([cat, count]) => (
                <Badge key={cat} tone="muted">
                  {cat} · {count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3 flex items-center justify-between">
          <div className="eyebrow">Alle interviews i runden</div>
          <DownloadAllButton interviews={downloadData} />
        </div>

        {interviews.length === 0 ? (
          <Empty>Ingen interviews i denne runde endnu.</Empty>
        ) : (
          <div className="space-y-2.5">
            {interviews.map((iv, i) => (
              <Panel key={iv.id} className="flex items-center justify-between gap-4">
                <Link href={`/interviews/${iv.id}`} className="min-w-0 hover:text-(--color-clay)">
                  <div className="text-[14px] font-medium">{iv.interviewAgent.name}</div>
                  <div className="mt-0.5 text-[12.5px] text-(--color-muted)">
                    {iv.respondent.name}
                    {iv.respondent.category && (
                      <span className="text-(--color-faint)"> · {iv.respondent.category}</span>
                    )}
                    <span className="text-(--color-faint)"> · {iv.startedAt.toLocaleDateString("da-DK")}</span>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={iv.status === "COMPLETED" ? "ok" : "clay"}>
                    {STATUS_LABEL[iv.status] ?? iv.status}
                  </Badge>
                  <InterviewDownloadButton interview={downloadData[i]} />
                </div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

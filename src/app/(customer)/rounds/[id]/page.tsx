import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { parseCategories } from "@/lib/categories";
import { PageHeader } from "@/components/PageHeader";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";
import { Panel, Empty, Badge, Stat } from "@/components/ui";
import { SendInterviewForm } from "@/components/SendInterviewForm";
import { RoundPublicJoin } from "@/components/RoundPublicJoin";
import { InterviewList } from "@/components/InterviewList";
import { DownloadAllButton } from "@/components/RoundTranscriptDownload";

export const dynamic = "force-dynamic";

// Rundens egen side — "en undersøgelse" man kan gå ind i. Nøgletal, afsendelse
// og offentlig invitation ligger samlet ét sted i stedet for spredt over en
// fanebjælke — der er kun denne ene visning pr. runde.
export default async function RoundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const engagement = await requireEngagement();

  const round = await db.interviewRound.findUnique({ where: { id } });
  if (!round || round.engagementId !== engagement.id) notFound();

  const [agents, respondents, interviews] = await Promise.all([
    db.interviewAgent.findMany({ where: { engagementId: engagement.id }, orderBy: { name: "asc" } }),
    db.respondent.findMany({ where: { engagementId: engagement.id }, orderBy: { name: "asc" } }),
    db.interview.findMany({
      where: { interviewRoundId: id },
      include: {
        interviewAgent: true,
        respondent: true,
        sentBy: true,
        interviewRound: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  const completedCount = interviews.filter((iv) => iv.status === "COMPLETED").length;
  const openCount = interviews.length - completedCount;
  const categoryCounts = new Map<string, number>();
  for (const iv of interviews) {
    for (const cat of parseCategories(iv.respondent.categories)) {
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }
  }

  const downloadData = interviews.map((iv) => ({
    id: iv.id,
    agentName: iv.interviewAgent.name,
    respondentName: iv.respondent.name,
    status: iv.status,
    startedAt: iv.startedAt,
    messages: iv.messages.map((m) => ({ role: m.role, content: m.content })),
  }));

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = h.get("origin") ?? `${proto}://${host}`;

  const agentJoinStates = await Promise.all(
    agents.map(async (a) => {
      let joinUrl = "";
      let qrDataUrl: string | null = null;
      if (a.publicJoinSlug) {
        joinUrl = `${origin}/respond/join/${a.publicJoinSlug}`;
        qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 1, width: 200 });
      }
      return {
        id: a.id,
        name: a.name,
        enabledForThisRound: a.publicJoinEnabled && a.publicJoinRoundId === id,
        joinUrl,
        qrDataUrl,
      };
    }),
  );

  return (
    <div>
      <SetBreadcrumb items={[{ label: "Undersøgelser", href: "/interviews" }, { label: round.name }]} />
      <PageHeader
        eyebrow={`${interviews.length} interviews`}
        title={round.name}
        lead="Send interviewet til respondenter, eller del et offentligt link/QR-kode så folk kan starte det selv."
      />

      <div className="p-8">
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

        <Panel title="Send interview" className="mb-6">
          {agents.length === 0 || respondents.length === 0 ? (
            <Empty>
              Opret først en interview agent og en respondent for at kunne
              sende et interview.
            </Empty>
          ) : (
            <SendInterviewForm agents={agents} respondents={respondents} rounds={[round]} lockedRoundId={round.id} />
          )}
        </Panel>

        <Panel title="Offentlig invitation" className="mb-6">
          <p className="mb-4 text-[12.5px] leading-relaxed text-(--color-faint)">
            Del et link eller en QR-kode i stedet for at oprette respondenter
            manuelt — alle der bruger det starter deres eget interview i
            denne runde.
          </p>
          <RoundPublicJoin roundId={round.id} agents={agentJoinStates} />
        </Panel>

        <div className="mb-3 flex items-center justify-between">
          <div className="eyebrow">Sendte interviews</div>
          <DownloadAllButton interviews={downloadData} />
        </div>
        <InterviewList interviews={interviews} />
      </div>
    </div>
  );
}

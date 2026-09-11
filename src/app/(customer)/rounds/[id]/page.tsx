import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";
import { Panel, Empty } from "@/components/ui";
import { SendInterviewForm } from "@/components/SendInterviewForm";
import { RoundPublicJoin } from "@/components/RoundPublicJoin";
import { InterviewList } from "@/components/InterviewList";
import { InsightsTabs } from "@/components/InsightsTabs";

export const dynamic = "force-dynamic";

// Rundens egen side — "en undersøgelse" man kan gå ind i. Herfra sender man
// interviews til respondenter OG styrer offentlig invitation, i stedet for
// at de to ting lå spredt på henholdsvis /interviews og agent-siden.
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
      include: { interviewAgent: true, respondent: true, sentBy: true, interviewRound: true },
      orderBy: { startedAt: "desc" },
    }),
  ]);

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
        <InsightsTabs roundId={round.id} roundName={round.name} />

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

        <div className="eyebrow mb-3">Sendte interviews</div>
        <InterviewList interviews={interviews} />
      </div>
    </div>
  );
}

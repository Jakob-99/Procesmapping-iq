import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";
import { AgentEditForm } from "@/components/AgentEditForm";
import { Panel } from "@/components/ui";
import { QuantQuestionsEditor } from "@/components/QuantQuestionsEditor";
import { QuantResults } from "@/components/QuantResults";
import { PublicJoinToggle } from "@/components/PublicJoinToggle";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const engagement = await requireEngagement();

  const agent = await db.interviewAgent.findUnique({
    where: { id },
    include: { quantQuestions: { orderBy: { sortOrder: "asc" } } },
  });
  if (!agent || agent.engagementId !== engagement.id) notFound();

  const rounds = await db.interviewRound.findMany({
    where: { engagementId: engagement.id },
    orderBy: { createdAt: "desc" },
  });

  const resultsByQuestion = await Promise.all(
    agent.quantQuestions.map(async (q) => {
      const grouped = await db.quantAnswer.groupBy({
        by: ["value"],
        where: { quantQuestionId: q.id },
        _count: { value: true },
      });
      return {
        question: q,
        counts: grouped.map((g) => ({ value: g.value, count: g._count.value })),
      };
    }),
  );

  let qrDataUrl: string | null = null;
  let joinUrl = "";
  if (agent.publicJoinEnabled && agent.publicJoinSlug) {
    const h = await headers();
    const host = h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const origin = h.get("origin") ?? `${proto}://${host}`;
    joinUrl = `${origin}/respond/join/${agent.publicJoinSlug}`;
    qrDataUrl = await QRCode.toDataURL(joinUrl, { margin: 1, width: 200 });
  }

  return (
    <div>
      <SetBreadcrumb
        items={[{ label: "Interview agenter", href: "/agents" }, { label: agent.name }]}
      />
      <PageHeader title={agent.name} lead="Rediger interviewets formål og retningslinjer." />

      <div className="space-y-6 p-8">
        <AgentEditForm
          id={agent.id}
          name={agent.name}
          goal={agent.goal}
          instructions={agent.instructions}
        />

        <Panel title="Kvant-spørgsmål">
          <p className="mb-4 text-[12.5px] leading-relaxed text-(--color-faint)">
            Faste spørgsmål agenten stiller alle respondenter, ud over de frie
            AI-probes — svarene kan sammenlignes på tværs af interviews.
          </p>
          <QuantQuestionsEditor agentId={agent.id} questions={agent.quantQuestions} />
        </Panel>

        {resultsByQuestion.length > 0 && (
          <Panel title="Resultater">
            <div className="space-y-5">
              {resultsByQuestion.map((r) => (
                <QuantResults key={r.question.id} question={r.question} counts={r.counts} />
              ))}
            </div>
          </Panel>
        )}

        <Panel title="Offentlig invitation">
          <p className="mb-4 text-[12.5px] leading-relaxed text-(--color-faint)">
            Del et link eller en QR-kode i stedet for at oprette respondenter
            manuelt — alle der bruger det starter deres eget interview med
            denne agent.
          </p>
          <PublicJoinToggle
            agentId={agent.id}
            enabled={agent.publicJoinEnabled}
            roundId={agent.publicJoinRoundId}
            rounds={rounds}
            joinUrl={joinUrl}
            qrDataUrl={qrDataUrl}
          />
        </Panel>
      </div>
    </div>
  );
}

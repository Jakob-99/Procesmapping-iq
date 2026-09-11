import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";
import { Badge, Empty } from "@/components/ui";
import { NOTE_CATEGORIES } from "@/lib/interview";
import type { Tone } from "@/components/ui";
import { DeleteInterviewButton } from "@/components/DeleteInterviewButton";
import { daysAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const NOTE_TONE: Record<string, Tone> = {
  PAIN: "alert",
  WORKAROUND: "warn",
  RISK: "alert",
  KNOWLEDGE: "muted",
  OPPORTUNITY: "clay",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Sendt, afventer svar",
  COMPLETED: "Afsluttet",
};

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const engagement = await requireEngagement();

  const interview = await db.interview.findUnique({
    where: { id },
    include: {
      interviewAgent: true,
      respondent: true,
      interviewRound: true,
      messages: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!interview || interview.engagementId !== engagement.id) notFound();

  return (
    <div>
      <SetBreadcrumb
        items={[
          { label: "Undersøgelser", href: "/interviews" },
          { label: interview.interviewRound.name, href: `/rounds/${interview.interviewRoundId}` },
          { label: `${interview.interviewAgent.name} · ${interview.respondent.name}` },
        ]}
      />
      <PageHeader
        eyebrow={`${STATUS_LABEL[interview.status] ?? interview.status}${
          interview.status === "OPEN" ? ` · sendt ${daysAgo(interview.startedAt)}` : ""
        } · ${interview.interviewRound.name}`}
        title={`${interview.interviewAgent.name} — ${interview.respondent.name}`}
        action={<DeleteInterviewButton id={interview.id} />}
      />

      <div className="grid gap-5 p-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {interview.messages.length === 0 ? (
            <Empty>Respondenten har ikke svaret endnu.</Empty>
          ) : (
            interview.messages.map((m) => (
              <div key={m.id}>
                <div className="eyebrow mb-1.5">
                  {m.role === "agent" ? interview.interviewAgent.name : interview.respondent.name}
                </div>
                <p
                  className={`whitespace-pre-wrap text-[14px] leading-relaxed ${
                    m.role === "user" ? "text-(--color-muted)" : "text-(--color-text)"
                  }`}
                >
                  {m.content}
                </p>
              </div>
            ))
          )}
        </div>

        <aside className="h-fit border-l border-(--color-line) pl-5">
          <div className="eyebrow mb-3">Agentens noter</div>
          {interview.notes.length === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-(--color-faint)">Ingen noter endnu.</p>
          ) : (
            <div className="space-y-2">
              {interview.notes.map((n) => (
                <div key={n.id} className="border-b border-(--color-line-soft) pb-3">
                  <Badge tone={NOTE_TONE[n.category] ?? "muted"}>
                    {NOTE_CATEGORIES[n.category as keyof typeof NOTE_CATEGORIES] ?? n.category}
                  </Badge>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-(--color-muted)">{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

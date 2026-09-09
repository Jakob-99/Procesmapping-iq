import Link from "next/link";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Empty, Badge, Panel } from "@/components/ui";
import { SendInterviewForm } from "@/components/SendInterviewForm";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Sendt, afventer svar",
  COMPLETED: "Afsluttet",
};

export default async function InterviewsPage() {
  const engagement = await requireEngagement();

  const [agents, respondents, rounds, interviews] = await Promise.all([
    db.interviewAgent.findMany({ where: { engagementId: engagement.id }, orderBy: { name: "asc" } }),
    db.respondent.findMany({ where: { engagementId: engagement.id }, orderBy: { name: "asc" } }),
    db.interviewRound.findMany({ where: { engagementId: engagement.id }, orderBy: { createdAt: "desc" } }),
    db.interview.findMany({
      where: { engagementId: engagement.id },
      include: { interviewAgent: true, respondent: true, sentBy: true, interviewRound: true },
      orderBy: { startedAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow={`${interviews.length} interviews`}
        title="Interviews"
        lead="Send en interview agent til en eller flere respondenter, ind i en interview runde, og følg svarene."
      />

      <div className="p-8">
        {agents.length === 0 || respondents.length === 0 ? (
          <Empty>
            Opret først en{" "}
            <Link href="/agents" className="text-(--color-clay) hover:underline">
              interview agent
            </Link>{" "}
            og en{" "}
            <Link href="/respondents" className="text-(--color-clay) hover:underline">
              respondent
            </Link>{" "}
            for at kunne sende et interview.
          </Empty>
        ) : (
          <SendInterviewForm agents={agents} respondents={respondents} rounds={rounds} />
        )}

        {interviews.length === 0 ? (
          <Empty>Ingen interviews sendt endnu.</Empty>
        ) : (
          <div className="space-y-2.5">
            {interviews.map((iv) => (
              <Link key={iv.id} href={`/interviews/${iv.id}`}>
                <Panel className="lift flex items-center justify-between gap-4 transition-colors hover:border-(--color-clay-line)">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium">{iv.interviewAgent.name}</div>
                    <div className="mt-0.5 text-[12.5px] text-(--color-muted)">
                      {iv.respondent.name}
                      <span className="text-(--color-faint)"> · {iv.interviewRound.name}</span>
                      {iv.sentBy && <span className="text-(--color-faint)"> · sendt af {iv.sentBy.name}</span>}
                    </div>
                  </div>
                  <Badge tone={iv.status === "COMPLETED" ? "ok" : "clay"}>
                    {STATUS_LABEL[iv.status] ?? iv.status}
                  </Badge>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

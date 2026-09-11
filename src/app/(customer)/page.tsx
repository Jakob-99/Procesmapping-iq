import Link from "next/link";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { getSessionUser } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { Stat, Panel, Badge, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Sendt, afventer svar",
  COMPLETED: "Afsluttet",
};

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

// Forsidens eneste bevidste afvigelse fra det almindelige PageHeader
// (hvid flade, tekst-only) — samme prikmønster som login-siderne, nu bag
// selve mærket i stedet for bag et enkelt nøgletal, som en rolig
// "velkommen ind"-gestus frem for endnu en ren tekstoverskrift.
export default async function OverviewPage() {
  const engagement = await requireEngagement();
  const sessionUser = await getSessionUser();

  const [respondentCount, agentCount, openCount, completedCount, recent] = await Promise.all([
    db.respondent.count({ where: { engagementId: engagement.id } }),
    db.interviewAgent.count({ where: { engagementId: engagement.id } }),
    db.interview.count({ where: { engagementId: engagement.id, status: "OPEN" } }),
    db.interview.count({ where: { engagementId: engagement.id, status: "COMPLETED" } }),
    db.interview.findMany({
      where: { engagementId: engagement.id },
      include: { interviewAgent: true, respondent: true },
      orderBy: { startedAt: "desc" },
      take: 6,
    }),
  ]);

  return (
    <div>
      <div className="dot-grid flex shrink-0 items-center gap-5 border-b border-(--color-line) bg-(--color-surface) px-8 py-9">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-(--color-line) bg-(--color-surface) shadow-[0_1px_2px_rgba(20,16,12,0.03)]">
          <Logo size={30} />
        </div>
        <div>
          <div className="eyebrow mb-1">{engagement.name}</div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
            {sessionUser ? `Hej, ${firstName(sessionUser.name)}` : "Oversigt"}
          </h1>
          <p className="mt-1 text-[12.5px] text-(--color-muted)">
            Interview-platformen for dette forløb.
          </p>
        </div>
      </div>

      <div className="p-8">
        <div className="mb-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Respondenter" value={respondentCount} />
          <Stat label="Interview agenter" value={agentCount} />
          <Stat label="Afventer svar" value={openCount} accent />
          <Stat label="Afsluttet" value={completedCount} />
        </div>

        <div className="mb-4 flex items-center justify-between">
          <div className="eyebrow">Seneste interviews</div>
          <Link href="/interviews" className="text-[12.5px] text-(--color-muted) hover:text-(--color-text)">
            Se alle →
          </Link>
        </div>

        {recent.length === 0 ? (
          <Empty>
            Ingen interviews endnu — opret en{" "}
            <Link href="/agents" className="text-(--color-clay) hover:underline">
              interview agent
            </Link>{" "}
            og send den til en{" "}
            <Link href="/respondents" className="text-(--color-clay) hover:underline">
              respondent
            </Link>
            .
          </Empty>
        ) : (
          <div className="space-y-2.5">
            {recent.map((iv) => (
              <Link key={iv.id} href={`/interviews/${iv.id}`} className="block">
                <Panel className="lift flex items-center justify-between gap-4 transition-colors hover:border-(--color-clay-line)">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium">{iv.interviewAgent.name}</div>
                    <div className="mt-0.5 text-[12.5px] text-(--color-muted)">{iv.respondent.name}</div>
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

import Link from "next/link";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Empty, Panel, ClayButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const engagement = await requireEngagement();

  const agents = await db.interviewAgent.findMany({
    where: { engagementId: engagement.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { interviews: true } } },
  });

  return (
    <div>
      <PageHeader
        eyebrow={`${agents.length} agenter`}
        title="Interview agenter"
        lead="Navngivne interview-definitioner, klar til at sende ud til en eller flere respondenter."
        action={
          <Link href="/agents/new">
            <ClayButton>+ Ny interview agent</ClayButton>
          </Link>
        }
      />

      <div className="p-8">
        {agents.length === 0 ? (
          <Empty>Ingen interview agenter endnu.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((a) => (
              <Link key={a.id} href={`/agents/${a.id}`}>
                <Panel className="lift h-full transition-colors hover:border-(--color-clay-line)">
                  <div className="text-[15px] font-medium">{a.name}</div>
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-(--color-muted)">
                    {a.purpose}
                  </p>
                  <div className="mt-3 text-[11px] text-(--color-faint)">
                    {a._count.interviews} interview{a._count.interviews === 1 ? "" : "s"} sendt
                  </div>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

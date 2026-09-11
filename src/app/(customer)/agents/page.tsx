import Link from "next/link";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { ClayButton } from "@/components/ui";
import { AgentList } from "@/components/AgentList";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const engagement = await requireEngagement();

  const agentRows = await db.interviewAgent.findMany({
    where: { engagementId: engagement.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { interviews: true } } },
  });
  const agents = agentRows.map((a) => ({
    id: a.id,
    name: a.name,
    purpose: a.purpose,
    createdAt: a.createdAt,
    interviewCount: a._count.interviews,
  }));

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
        <AgentList agents={agents} />
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";
import { AgentEditForm } from "@/components/AgentEditForm";

export const dynamic = "force-dynamic";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const engagement = await requireEngagement();

  const agent = await db.interviewAgent.findUnique({ where: { id } });
  if (!agent || agent.engagementId !== engagement.id) notFound();

  return (
    <div>
      <SetBreadcrumb
        items={[{ label: "Interview agenter", href: "/agents" }, { label: agent.name }]}
      />
      <PageHeader title={agent.name} lead="Rediger interviewets formål og retningslinjer." />

      <div className="p-8">
        <AgentEditForm
          id={agent.id}
          name={agent.name}
          goal={agent.goal}
          instructions={agent.instructions}
        />
      </div>
    </div>
  );
}

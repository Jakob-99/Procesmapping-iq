import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";
import { InterviewSession } from "@/components/InterviewSession";

export const dynamic = "force-dynamic";

/*
  Konsulentens "prøv agenten selv" — kør interviewet igennem før det sendes
  ud til rigtige respondenter. Intet gemmes.
*/
export default async function AgentPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const engagement = await requireEngagement();

  const agent = await db.interviewAgent.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!agent || agent.engagementId !== engagement.id) notFound();

  return (
    <div>
      <SetBreadcrumb
        items={[
          { label: "Interview agenter", href: "/agents" },
          { label: agent.name, href: `/agents/${agent.id}` },
          { label: "Forhåndsvisning" },
        ]}
      />
      <PageHeader
        eyebrow="Forhåndsvisning"
        title={`Interview: ${agent.name}`}
        lead="Intet gemmes i denne visning."
        action={
          <Link href={`/agents/${agent.id}`} className="text-[13px] text-(--color-muted) hover:text-(--color-text)">
            ← Tilbage
          </Link>
        }
      />

      <InterviewSession
        preview
        agentId={agent.id}
        agentName={agent.name}
        respondentName="Dig"
        agentImages={agent.images.map((img) => ({ label: img.label, data: img.data }))}
      />
    </div>
  );
}

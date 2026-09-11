import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";
import { AgentEditor } from "@/components/AgentEditor";
import { Panel } from "@/components/ui";
import { QuantQuestionsEditor } from "@/components/QuantQuestionsEditor";
import { QuantResults } from "@/components/QuantResults";
import { AgentImagesEditor } from "@/components/AgentImagesEditor";

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
    include: {
      quantQuestions: { orderBy: { sortOrder: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!agent || agent.engagementId !== engagement.id) notFound();

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

  return (
    <div>
      <SetBreadcrumb
        items={[{ label: "Interview agenter", href: "/agents" }, { label: agent.name }]}
      />
      <AgentEditor
        agent={{
          id: agent.id,
          name: agent.name,
          purpose: agent.purpose,
          prequalification: agent.prequalification,
          investigate: agent.investigate,
          followUpLevel: agent.followUpLevel,
          formalityLevel: agent.formalityLevel,
          questionLengthLevel: agent.questionLengthLevel,
        }}
        images={agent.images.map((img) => ({ label: img.label }))}
        extraSections={
          <>
            <Panel title="Billeder">
              <p className="mb-4 text-[12.5px] leading-relaxed text-(--color-faint)">
                Læg billeder ind agenten kan vise respondenten undervejs — fx
                en mockup respondenten skal vurdere. Agenten afgør selv
                hvornår i samtalen det er relevant.
              </p>
              <AgentImagesEditor agentId={agent.id} images={agent.images} />
            </Panel>

            <Panel title="Kvant-spørgsmål">
              <p className="mb-4 text-[12.5px] leading-relaxed text-(--color-faint)">
                Faste spørgsmål agenten stiller alle respondenter, ud over de
                frie AI-probes — svarene kan sammenlignes på tværs af
                interviews.
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
          </>
        }
      />
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { parseCategories } from "@/lib/categories";
import { PageHeader } from "@/components/PageHeader";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";
import { Badge, Empty, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Sendt, afventer svar",
  COMPLETED: "Afsluttet",
};

export default async function RespondentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const engagement = await requireEngagement();

  const respondent = await db.respondent.findUnique({
    where: { id },
    include: {
      interviews: {
        include: { interviewAgent: true, interviewRound: true },
        orderBy: { startedAt: "desc" },
      },
    },
  });
  if (!respondent || respondent.engagementId !== engagement.id) notFound();
  const categories = parseCategories(respondent.categories);

  return (
    <div>
      <SetBreadcrumb
        items={[{ label: "Respondenter", href: "/respondents" }, { label: respondent.name }]}
      />
      <PageHeader
        eyebrow={`${respondent.interviews.length} interviews`}
        title={respondent.name}
        lead={[respondent.email, respondent.title].filter(Boolean).join(" · ")}
      />

      <div className="mx-auto max-w-2xl px-8 py-8">
        {categories.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <Badge key={c} tone="muted">{c}</Badge>
            ))}
          </div>
        )}

        <div className="eyebrow mb-3">Interviewhistorik</div>
        {respondent.interviews.length === 0 ? (
          <Empty>Ingen interviews sendt til denne respondent endnu.</Empty>
        ) : (
          <div className="space-y-2.5">
            {respondent.interviews.map((iv) => (
              <Link key={iv.id} href={`/interviews/${iv.id}`} className="block">
                <Panel className="lift flex items-center justify-between gap-4 transition-colors hover:border-(--color-clay-line)">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium">{iv.interviewAgent.name}</div>
                    <div className="mt-0.5 text-[12.5px] text-(--color-muted)">
                      {iv.interviewRound.name}
                      <span className="text-(--color-faint)">
                        {" · "}
                        {iv.startedAt.toLocaleDateString("da-DK")}
                      </span>
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

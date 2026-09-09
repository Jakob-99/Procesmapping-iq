import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Empty } from "@/components/ui";
import { RespondentCreator } from "@/components/RespondentCreator";
import { RespondentRow } from "@/components/RespondentRow";

export const dynamic = "force-dynamic";

export default async function RespondentsPage() {
  const engagement = await requireEngagement();

  const respondents = await db.respondent.findMany({
    where: { engagementId: engagement.id },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow={`${respondents.length} respondenter`}
        title="Respondenter"
        lead="De personer man kan sende interviews til."
      />

      <div className="mx-auto max-w-2xl px-8 py-8">
        <RespondentCreator />
        {respondents.length === 0 ? (
          <Empty>Ingen respondenter endnu.</Empty>
        ) : (
          <div className="divide-y divide-(--color-line-soft)">
            {respondents.map((r) => (
              <RespondentRow key={r.id} id={r.id} name={r.name} email={r.email} title={r.title} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

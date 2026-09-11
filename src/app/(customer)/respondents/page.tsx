import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { RespondentCreator } from "@/components/RespondentCreator";
import { RespondentCsvImport } from "@/components/RespondentCsvImport";
import { RespondentCsvExport } from "@/components/RespondentCsvExport";
import { RespondentList } from "@/components/RespondentList";

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
        <div className="flex flex-wrap items-start">
          <RespondentCreator />
          <RespondentCsvImport />
          <RespondentCsvExport respondents={respondents} />
        </div>
        <RespondentList respondents={respondents} />
      </div>
    </div>
  );
}

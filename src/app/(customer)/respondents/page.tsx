import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { parseCategories } from "@/lib/categories";
import { PageHeader } from "@/components/PageHeader";
import { RespondentCreator } from "@/components/RespondentCreator";
import { RespondentCsvImport } from "@/components/RespondentCsvImport";
import { RespondentCsvExport } from "@/components/RespondentCsvExport";
import { RespondentList } from "@/components/RespondentList";

export const dynamic = "force-dynamic";

export default async function RespondentsPage() {
  const engagement = await requireEngagement();

  const respondentRows = await db.respondent.findMany({
    where: { engagementId: engagement.id },
    orderBy: { name: "asc" },
  });
  const respondents = respondentRows.map((r) => ({ ...r, categories: parseCategories(r.categories) }));

  // Alle forretningsområder der allerede er i brug i dette engagement —
  // grundlaget for dropdown-forslagene i CategoryPicker, så man genbruger
  // eksisterende navne i stedet for at stave dem forskelligt hver gang.
  const existingCategories = [...new Set(respondents.flatMap((r) => r.categories))].sort();

  return (
    <div>
      <PageHeader
        eyebrow={`${respondents.length} respondenter`}
        title="Respondenter"
        lead="De personer man kan sende interviews til."
      />

      <div className="mx-auto max-w-2xl px-8 py-8">
        <div className="flex flex-wrap items-start">
          <RespondentCreator existingCategories={existingCategories} />
          <RespondentCsvImport />
          <RespondentCsvExport respondents={respondents} />
        </div>
        <RespondentList respondents={respondents} existingCategories={existingCategories} />
      </div>
    </div>
  );
}

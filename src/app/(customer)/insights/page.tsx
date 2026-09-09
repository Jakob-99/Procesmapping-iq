import Link from "next/link";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Empty } from "@/components/ui";
import { InsightsTabs } from "@/components/InsightsTabs";
import { ThemeGenerateButton } from "@/components/ThemeGenerateButton";

export const dynamic = "force-dynamic";

export default async function InsightsThemesPage() {
  const engagement = await requireEngagement();

  const themes = await db.themeCluster.findMany({
    where: { engagementId: engagement.id },
    orderBy: { createdAt: "asc" },
  });

  const allNoteIds = themes.flatMap((t) => JSON.parse(t.noteIds) as string[]);
  const notes = allNoteIds.length
    ? await db.interviewNote.findMany({
        where: { id: { in: allNoteIds } },
        include: { interview: { include: { respondent: true } } },
      })
    : [];
  const noteById = new Map(notes.map((n) => [n.id, n]));

  return (
    <div>
      <PageHeader
        title="Indsigter"
        lead="Tematisk analyse, citater og institutionel hukommelse på tværs af alle interviews."
      />

      <div className="mx-auto max-w-3xl px-8 py-8">
        <InsightsTabs />

        <div className="mb-5 flex items-start justify-between gap-4">
          <p className="max-w-md text-[12.5px] leading-relaxed text-(--color-faint)">
            AI'en klynger noterne fra alle gennemførte interviews i temaer.
            Regenerér når der er kommet nye interviews i hus.
          </p>
          <ThemeGenerateButton />
        </div>

        {themes.length === 0 ? (
          <Empty>Ingen temaer endnu — klik "Generér temaer".</Empty>
        ) : (
          <div className="space-y-4">
            {themes.map((t) => {
              const noteIds = JSON.parse(t.noteIds) as string[];
              const sourceNotes = noteIds.map((id) => noteById.get(id)).filter(Boolean);
              return (
                <Panel key={t.id} title={t.title}>
                  <p className="text-[13px] leading-relaxed text-(--color-muted)">{t.summary}</p>
                  {sourceNotes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {sourceNotes.map((n) => (
                        <Link
                          key={n!.id}
                          href={`/interviews/${n!.interviewId}`}
                          className="rounded-full border border-(--color-line) bg-(--color-raised) px-2.5 py-1 text-[11px] text-(--color-muted) hover:border-(--color-clay-line) hover:text-(--color-clay)"
                        >
                          {n!.interview.respondent.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

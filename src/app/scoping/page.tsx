import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { GoalList } from "@/components/GoalList";

export const dynamic = "force-dynamic";

// Et mål pr. linje — "1) ..." eller bare fri tekst. Vi antager ikke et format,
// vi viser bare hver linje som sit eget punkt.
function splitGoals(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\d+\)\s*/, ""));
}

export default async function ScopingPage() {
  const engagement = await requireEngagement();
  const goals = engagement.strategicGoals ? splitGoals(engagement.strategicGoals) : [];

  return (
    <div>
      <PageHeader
        eyebrow="Fase 0 — senior konsulent"
        title="Strategi"
        lead="De mål resten af systemet arbejder ud fra — og det agenten måler forbedringsforslag op imod."
      />

      <div className="mx-auto max-w-2xl px-8 py-8">
        <GoalList goals={goals} />
      </div>
    </div>
  );
}

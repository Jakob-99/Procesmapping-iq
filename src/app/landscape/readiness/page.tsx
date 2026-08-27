import Link from "next/link";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Empty, Stat } from "@/components/ui";
import { SystemReadinessRow } from "@/components/SystemReadinessRow";
import { READINESS_CRITERIA, systemReadiness } from "@/lib/readiness";

export const dynamic = "force-dynamic";

export default async function ReadinessPage() {
  const engagement = await requireEngagement();

  const systems = await db.systemRef.findMany({
    where: { engagementId: engagement.id },
    orderBy: { name: "asc" },
  });

  const verdicts = systems.map((s) => systemReadiness(s).verdict);
  const ready = verdicts.filter((v) => v === "READY").length;
  const partial = verdicts.filter((v) => v === "PARTIAL").length;
  const notReady = verdicts.filter((v) => v === "NOT_READY").length;

  return (
    <div>
      <PageHeader
        eyebrow="Rapport"
        title="AI-parathed"
        lead="Er systemlandskabet klar til AI native — eller kræver det først et fundament? Vurderet på tre forudsætninger: åbne API'er, stamdata-hygiejne og løbende opdatering."
      />

      <div className="space-y-6 p-8">
        <div className="grid gap-6 sm:grid-cols-3">
          <Stat label="Klar til AI" value={ready} suffix={`/ ${systems.length}`} accent />
          <Stat label="Delvist klar" value={partial} />
          <Stat label="Ikke klar" value={notReady} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {Object.values(READINESS_CRITERIA).map((c) => (
            <div key={c.label} className="rounded-lg border border-(--color-line-soft) bg-(--color-raised) p-4">
              <div className="mb-1 text-[12.5px] font-semibold">{c.label}</div>
              <p className="text-[12px] leading-relaxed text-(--color-muted)">{c.blurb}</p>
            </div>
          ))}
        </div>

        {systems.length === 0 ? (
          <Empty>Ingen systemer kortlagt endnu.</Empty>
        ) : (
          <div className="space-y-3">
            {systems.map((s) => (
              <SystemReadinessRow
                key={s.id}
                id={s.id}
                name={s.name}
                category={s.category}
                hasOpenApi={s.hasOpenApi}
                masterDataQuality={s.masterDataQuality}
                processesUpToDate={s.processesUpToDate}
                readinessNotes={s.readinessNotes}
              />
            ))}
          </div>
        )}

        <Link href="/landscape" className="inline-block text-[13px] font-medium text-(--color-clay) hover:underline">
          ← Systemer
        </Link>
      </div>
    </div>
  );
}

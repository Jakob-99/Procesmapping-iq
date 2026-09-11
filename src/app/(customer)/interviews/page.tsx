import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Empty, Panel } from "@/components/ui";
import { RoundCreator } from "@/components/RoundCreator";
import { RoundRow } from "@/components/RoundRow";

export const dynamic = "force-dynamic";

// "Undersøgelser" — hver runde er én undersøgelse man kan gå ind i for at
// sende interviews og styre offentlig invitation, se rounds/[id]/page.tsx.
export default async function InterviewsPage() {
  const engagement = await requireEngagement();

  const rounds = await db.interviewRound.findMany({
    where: { engagementId: engagement.id },
    include: { _count: { select: { interviews: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow={`${rounds.length} undersøgelser`}
        title="Undersøgelser"
        lead="Opret en undersøgelse, gå ind i den for at sende interviews til respondenter eller dele et offentligt link."
      />

      <div className="p-8">
        <Panel title="Undersøgelser">
          <RoundCreator />
          {rounds.length === 0 ? (
            <Empty>Ingen undersøgelser endnu — opret én for at kunne sende interviews.</Empty>
          ) : (
            <div className="divide-y divide-(--color-line-soft)">
              {rounds.map((r) => (
                <RoundRow key={r.id} id={r.id} name={r.name} interviewCount={r._count.interviews} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

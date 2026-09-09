import Link from "next/link";
import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Empty } from "@/components/ui";
import { RoundCreator } from "@/components/RoundCreator";
import { RoundRow } from "@/components/RoundRow";

export const dynamic = "force-dynamic";

export default async function RoundsPage() {
  const engagement = await requireEngagement();

  const rounds = await db.interviewRound.findMany({
    where: { engagementId: engagement.id },
    include: { _count: { select: { interviews: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow={`${rounds.length} runder`}
        title="Interview runder"
        lead="Opret en runde først — den samler de interviews du sender ud. Se indsigter for hver runde for sig under Indsigter."
      />

      <div className="mx-auto max-w-2xl px-8 py-8">
        <RoundCreator />
        {rounds.length === 0 ? (
          <Empty>Ingen runder endnu — opret én for at kunne sende interviews.</Empty>
        ) : (
          <div className="divide-y divide-(--color-line-soft)">
            {rounds.map((r) => (
              <RoundRow key={r.id} id={r.id} name={r.name} interviewCount={r._count.interviews} />
            ))}
          </div>
        )}
        {rounds.length > 0 && (
          <p className="mt-6 text-[12px] text-(--color-faint)">
            Klar til at sende? Gå til{" "}
            <Link href="/interviews" className="text-(--color-clay) hover:underline">
              Interviews
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

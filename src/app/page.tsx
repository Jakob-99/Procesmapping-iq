import { db } from "@/lib/db";
import { activeEngagement } from "@/lib/engagement";
import { BrainIntro } from "@/components/BrainIntro";
import { Empty } from "@/components/ui";
import { Chat } from "./brain/Chat";

export const dynamic = "force-dynamic";

export default async function Home() {
  const engagement = await activeEngagement();

  if (!engagement) {
    return (
      <div className="p-8">
        <Empty>
          Ingen data endnu. Kør <code className="text-(--color-clay)">npm run db:seed</code>{" "}
          for at lægge et demo-engagement ind.
        </Empty>
      </div>
    );
  }

  const [subProcesses, systemCount, roleCount, noteCount, proposals] = await Promise.all([
    db.subProcess.findMany({
      where: { process: { engagementId: engagement.id } },
    }),
    db.systemRef.count({ where: { engagementId: engagement.id } }),
    db.businessRole.count({ where: { engagementId: engagement.id } }),
    db.interviewNote.count({ where: { importance: 3 } }),
    db.aiosProposal.findMany({
      where: { improvement: { engagementId: engagement.id } },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const inScope = subProcesses.filter((s) => s.inScope);
  const validated = inScope.filter((s) => s.status === "VALIDATED").length;
  const coverage = inScope.length
    ? Math.round((validated / inScope.length) * 100)
    : 0;

  return (
    <div className="flex h-full flex-col">
      <Chat
        attachables={proposals.map((p) => ({ id: p.id, name: p.name }))}
        intro={
          <BrainIntro
            orgName={engagement.organization.name}
            coverage={coverage}
            stats={{
              validated,
              total: inScope.length,
              systems: systemCount,
              roles: roleCount,
              notes: noteCount,
            }}
          />
        }
      />
    </div>
  );
}

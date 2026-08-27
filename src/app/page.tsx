import { db } from "@/lib/db";
import { activeEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { BrainIntro } from "@/components/BrainIntro";
import { Empty, type Tone } from "@/components/ui";
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

  const [processes, subProcesses, systems, roleCount, notes, proposals] = await Promise.all([
    db.process.findMany({
      where: { engagementId: engagement.id, category: "CORE" },
      include: { owner: true, subProcesses: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.subProcess.findMany({
      where: { process: { engagementId: engagement.id } },
    }),
    db.systemRef.findMany({
      where: { engagementId: engagement.id },
      include: { stepLinks: true },
      orderBy: { name: "asc" },
    }),
    db.businessRole.count({ where: { engagementId: engagement.id } }),
    db.interviewNote.findMany({
      where: { importance: 3 },
      take: 3,
      orderBy: { createdAt: "asc" },
    }),
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

  const processRows = processes.map((p) => {
    const subs = p.subProcesses.filter((s) => s.inScope);
    const done = subs.filter((s) => s.status === "VALIDATED").length;
    return {
      label: p.name,
      sub: p.owner ? p.owner.name : "Ingen procesejer",
      badge: `${done}/${subs.length}`,
      tone: (done === subs.length && subs.length > 0
        ? "ok"
        : done > 0
          ? "clay"
          : "faint") as Tone,
    };
  });

  // Systemerne der rører flest skridt står øverst — det er dem samtalen handler om.
  const systemRows = systems
    .slice()
    .sort((a, b) => b.stepLinks.length - a.stepLinks.length)
    .slice(0, 5)
    .map((s) => ({
      label: s.name,
      sub: s.category ?? undefined,
      badge: s.isMasterData ? "Master data" : undefined,
      tone: "clay" as Tone,
    }));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={engagement.organization.name}
        title="Hjernen"
        lead="Jeg ved hvad der faktisk sker i forretningen — hvem der gør hvad, i hvilke systemer, med hvilke data. Spørg som du ville spørge en kollega der har været her i tyve år."
      />

      <Chat
        attachables={proposals.map((p) => ({ id: p.id, name: p.name }))}
        intro={
          <BrainIntro
            orgName={engagement.organization.name}
            coverage={coverage}
            stats={{
              validated,
              total: inScope.length,
              systems: systems.length,
              roles: roleCount,
            }}
            processes={processRows}
            systems={systemRows}
            insights={notes.map((n) => ({
              category: n.category,
              content: n.content,
            }))}
          />
        }
      />
    </div>
  );
}

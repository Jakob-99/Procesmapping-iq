import Link from "next/link";
import { db } from "@/lib/db";
import { activeEngagement } from "@/lib/engagement";
import { getSessionUser } from "@/lib/session";
import { SUBPROCESS_STATUS, isStartOrEnd } from "@/lib/domain";
import { PixelLogo } from "@/components/PixelLogo";
import { LawnScene } from "@/components/LawnScene";
import { FoundationCard } from "@/components/FoundationCard";
import { Badge, Empty, type Tone } from "@/components/ui";

export const dynamic = "force-dynamic";

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

// Én nøgletals-flise: etiket over, tal under, en lille forklaring.
function Tile({ label, value, hint, href }: { label: string; value: string | number; hint: string; href?: string }) {
  const body = (
    <div className="h-full rounded-lg border border-(--color-line-soft) bg-(--color-surface) px-5 py-4 shadow-[0_1px_2px_rgba(20,16,12,0.03)] transition-colors hover:border-(--color-clay-line)">
      <div className="eyebrow mb-2">{label}</div>
      <div className="tabular font-mono text-[30px] leading-none tracking-tight">{value}</div>
      <div className="mt-2 text-[11.5px] leading-snug text-(--color-faint)">{hint}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

/*
  Forsiden: hvor langt kortlægningen er nået, og genveje ind i arbejdet —
  de senest ændrede underprocesser og procesområderne. Nederst plænen med
  figuren der skubber hjørnestenen.
*/
export default async function Home() {
  const engagement = await activeEngagement();
  const sessionUser = await getSessionUser();

  if (!engagement) {
    return (
      <div className="p-8">
        <Empty>
          Ingen data endnu. Kør <code className="text-(--color-clay)">npm run db:seed</code> for at lægge et
          demo-engagement ind.
        </Empty>
      </div>
    );
  }

  const [processes, recent, findingCounts, systems, roles, dataObjects] = await Promise.all([
    db.process.findMany({
      where: { engagementId: engagement.id },
      orderBy: { sortOrder: "asc" },
      include: {
        subProcesses: {
          select: { inScope: true, status: true, steps: { select: { stepType: true } } },
        },
      },
    }),
    db.subProcess.findMany({
      where: { process: { engagementId: engagement.id } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { process: { select: { id: true, name: true } } },
    }),
    db.processFinding.groupBy({
      by: ["kind"],
      where: { subProcess: { process: { engagementId: engagement.id } } },
      _count: true,
    }),
    db.systemRef.findMany({
      where: { engagementId: engagement.id },
      select: { id: true, name: true, category: true, _count: { select: { stepLinks: true, actorSteps: true } } },
    }),
    db.businessRole.findMany({
      where: { engagementId: engagement.id },
      select: { id: true, name: true, _count: { select: { steps: true } } },
    }),
    db.dataObject.findMany({
      where: { engagementId: engagement.id },
      select: { id: true, name: true, isMasterData: true, ownerSystem: { select: { name: true } }, _count: { select: { stepLinks: true } } },
    }),
  ]);

  // Mest brugte først (antal skridt de indgår i), ellers alfabetisk.
  const byUse = <T extends { name: string }>(items: T[], use: (t: T) => number) =>
    [...items].sort((a, b) => use(b) - use(a) || a.name.localeCompare(b.name, "da"));
  const foundation = [
    {
      key: "systems",
      title: "Systemer",
      href: "/landscape",
      icon: "system" as const,
      count: systems.length,
      empty: "Ingen systemer i landskabet endnu.",
      items: byUse(systems, (s) => s._count.stepLinks + s._count.actorSteps).map((s) => ({
        id: s.id,
        name: s.name,
        meta: s.category ?? null,
        uses: s._count.stepLinks + s._count.actorSteps,
      })),
    },
    {
      key: "roles",
      title: "Roller",
      href: "/roles",
      icon: "role" as const,
      count: roles.length,
      empty: "Ingen roller endnu.",
      items: byUse(roles, (r) => r._count.steps).map((r) => ({ id: r.id, name: r.name, meta: null, uses: r._count.steps })),
    },
    {
      key: "data",
      title: "Dataobjekter",
      href: "/data",
      icon: "data" as const,
      count: dataObjects.length,
      empty: "Ingen dataobjekter endnu.",
      items: byUse(dataObjects, (d) => d._count.stepLinks).map((d) => ({
        id: d.id,
        name: d.name,
        meta: d.ownerSystem?.name ?? (d.isMasterData ? "Stamdata" : null),
        uses: d._count.stepLinks,
      })),
    },
  ];

  const subs = processes.flatMap((p) => p.subProcesses);
  const inScope = subs.filter((s) => s.inScope);
  const validated = inScope.filter((s) => s.status === "VALIDATED").length;
  const coverage = inScope.length ? Math.round((validated / inScope.length) * 100) : 0;
  const drawn = subs.filter((s) => s.steps.some((st) => !isStartOrEnd(st.stepType))).length;
  const count = (kind: string) => findingCounts.find((f) => f.kind === kind)?._count ?? 0;
  const findings = count("PROBLEM") + count("WISH") + count("IDEA");

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-5xl flex-1 px-8 pb-10 pt-14">
        <PixelLogo />

        <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow mb-1">{engagement.organization.name}</div>
            <h1 className="text-[26px] font-semibold leading-tight tracking-tight">
              {sessionUser ? `Hej, ${firstName(sessionUser.name)}` : "Oversigt"}
            </h1>
          </div>
          <Link
            href="/processes"
            className="rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-3.5 py-2 text-[13px] font-medium text-(--color-clay) transition-colors hover:bg-(--color-clay-line)"
          >
            Gå til procesmodellen →
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="dot-grid rounded-lg border border-(--color-line-soft) bg-(--color-surface) px-5 py-4 shadow-[0_1px_2px_rgba(20,16,12,0.03)]">
            <div className="eyebrow mb-2">Kortlagt og valideret</div>
            <div className="tabular font-mono text-[30px] leading-none tracking-tight">
              {coverage}
              <span className="text-(--color-faint)">%</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-(--color-sunken)">
              <div className="h-full rounded-full bg-(--color-clay)" style={{ width: `${coverage}%` }} />
            </div>
            <div className="mt-2 text-[11.5px] text-(--color-faint)">
              {validated} af {inScope.length} underprocesser
            </div>
          </div>
          <Tile
            label="Procesområder"
            value={processes.length}
            hint={`${processes.filter((p) => p.category === "CORE").length} kerne · ${processes.filter((p) => p.category !== "CORE").length} støtte`}
            href="/processes"
          />
          <Tile label="Tegnede diagrammer" value={drawn} hint={`af ${subs.length} underprocesser`} />
          <Tile
            label="Analysepunkter"
            value={findings}
            hint={`${count("PROBLEM")} problemer · ${count("WISH")} ønsker · ${count("IDEA")} ideer`}
          />
        </div>

        <section className="mt-8">
          <div className="eyebrow mb-3">Hvem og hvad processerne bruger</div>
          <div className="grid gap-3 md:grid-cols-3">
            {foundation.map(({ key, ...f }) => (
              <FoundationCard key={key} {...f} />
            ))}
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section>
            <div className="eyebrow mb-3">Senest ændret</div>
            {recent.length === 0 ? (
              <p className="text-[12.5px] text-(--color-faint)">Ingen underprocesser endnu.</p>
            ) : (
              <div className="divide-y divide-(--color-line-soft) rounded-lg border border-(--color-line-soft) bg-(--color-surface)">
                {recent.map((sp) => {
                  const st = SUBPROCESS_STATUS[sp.status as keyof typeof SUBPROCESS_STATUS] ?? SUBPROCESS_STATUS.NOT_STARTED;
                  return (
                    <Link
                      key={sp.id}
                      href={`/processes/${sp.process.id}/${sp.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-(--color-raised)"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-medium">{sp.name}</div>
                        <div className="truncate text-[11.5px] text-(--color-faint)">{sp.process.name}</div>
                      </div>
                      <Badge tone={st.tone as Tone}>{st.label}</Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <div className="eyebrow mb-3">Procesområder</div>
            <div className="flex flex-wrap gap-2">
              {processes.map((p) => (
                <Link
                  key={p.id}
                  href={`/processes/${p.id}`}
                  className={`rounded-md border px-3 py-1.5 text-[12.5px] transition-colors hover:border-(--color-clay) hover:text-(--color-clay) ${
                    p.category === "CORE"
                      ? "border-(--color-line) bg-(--color-sunken) text-(--color-text)"
                      : "border-(--color-line) bg-(--color-surface) text-(--color-muted)"
                  }`}
                >
                  {p.name}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>

      <LawnScene />
    </div>
  );
}

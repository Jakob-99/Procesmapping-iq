import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { MaterialButtons } from "@/components/MaterialButtons";
import { Badge, type Tone } from "@/components/ui";
import { LEVERS, pickScore, proposalGradient } from "@/lib/domain";
import { splitInsights } from "@/lib/insights";

export const dynamic = "force-dynamic";

function parseList(json: string | null) {
  if (!json) return [] as string[];
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const proposal = await db.aiosProposal.findUnique({
    where: { id },
    include: {
      improvement: { include: { process: true, subProcess: true } },
      processLinks: { include: { process: true } },
    },
  });

  if (!proposal) notFound();

  const subProcessIds = proposal.improvement.subProcessId
    ? [proposal.improvement.subProcessId]
    : (
        await db.subProcess.findMany({
          where: { processId: proposal.improvement.processId ?? "" },
          select: { id: true },
        })
      ).map((s) => s.id);

  const notes = subProcessIds.length
    ? await db.interviewNote.findMany({
        where: { interview: { subProcessId: { in: subProcessIds } } },
      })
    : [];

  const { works, broken } = splitInsights(notes);
  const potential = pickScore(proposal);
  const lever = LEVERS[proposal.improvement.lever as keyof typeof LEVERS];
  const systems = parseList(proposal.systemsUsed);
  const data = parseList(proposal.dataUsed);

  const gradient = proposalGradient(proposal.id);

  return (
    <article>
      <div
        className="flex h-[280px] items-end px-8 py-8 sm:h-[340px]"
        style={{ background: gradient }}
      >
        <div className="mx-auto w-full max-w-[680px]">
          <div className="eyebrow mb-3 text-white/70">
            {proposal.layer === "ORCHESTRATION" ? "Orkestreringslag" : "Procesniveau"}
            {lever && ` · ${lever.label}`}
          </div>
          <h1
            className="text-[36px] font-normal leading-[1.1] tracking-tight text-white sm:text-[44px]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {proposal.name}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-[680px] px-8 py-12">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-(--color-line) pb-8">
          <div className="flex items-baseline gap-8">
            <div>
              <div className="eyebrow mb-1">Potentiale</div>
              <div className="font-mono text-[28px] font-medium text-(--color-clay)">
                {potential ?? "—"}
                <span className="text-[14px] text-(--color-faint)">/100</span>
              </div>
            </div>
            <div>
              <div className="eyebrow mb-1">Impact</div>
              <div className="font-mono text-[28px] font-medium">{proposal.scoreImpact ?? "—"}<span className="text-[14px] text-(--color-faint)">/5</span></div>
            </div>
            <div>
              <div className="eyebrow mb-1">Feasibility</div>
              <div className="font-mono text-[28px] font-medium">{proposal.scoreFeasibility ?? "—"}<span className="text-[14px] text-(--color-faint)">/5</span></div>
            </div>
          </div>
          <MaterialButtons
            filename={`${proposal.name.replace(/\s+/g, "-").toLowerCase()}.md`}
            content={`# ${proposal.name}\n\n${proposal.description}\n\n${proposal.howItWorks ? `## Sådan virker det\n${proposal.howItWorks}\n` : ""}`}
          />
        </div>

        <p className="text-[17px] leading-relaxed text-(--color-text)">
          {proposal.description}
        </p>

        <section className="mt-14">
          <div className="eyebrow mb-3">Flaskehalsen</div>
          <h2 className="mb-4 text-[24px] font-semibold tracking-tight">
            {proposal.improvement.title}
          </h2>
          <p className="text-[15px] leading-[1.8] text-(--color-muted)">
            {proposal.improvement.bottleneck}
          </p>
          {proposal.improvement.rationale && (
            <p className="mt-4 text-[15px] leading-[1.8] text-(--color-muted)">
              {proposal.improvement.rationale}
            </p>
          )}
          <p className="mt-4 text-[13px] text-(--color-faint)">
            {proposal.improvement.process?.name}
            {proposal.improvement.subProcess ? ` · ${proposal.improvement.subProcess.name}` : ""}
          </p>
        </section>

        {proposal.howItWorks && (
          <section className="mt-14">
            <div className="eyebrow mb-3">Beskrivelse</div>
            <h2 className="mb-4 text-[24px] font-semibold tracking-tight">
              Sådan virker {proposal.name}
            </h2>
            <p className="text-[15px] leading-[1.8] text-(--color-muted)">
              {proposal.howItWorks}
            </p>
          </section>
        )}

        {proposal.example && (
          <section className="mt-14">
            <div className="eyebrow mb-3">Et eksempel</div>
            <h2 className="mb-4 text-[24px] font-semibold tracking-tight">
              Sådan kunne en dag se ud
            </h2>
            <p
              className="border-l-2 border-(--color-clay) pl-5 text-[15.5px] italic leading-[1.85] text-(--color-text)"
            >
              {proposal.example}
            </p>
          </section>
        )}

        {(proposal.processLinks.length > 0 || systems.length > 0) && (
          <section className="mt-14">
            <div className="eyebrow mb-3">Hvad det rører</div>
            <h2 className="mb-5 text-[24px] font-semibold tracking-tight">
              Berørte processer og systemer
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {proposal.processLinks.length > 0 && (
                <div>
                  <div className="mb-2 text-[11.5px] font-medium text-(--color-faint)">Processer</div>
                  <div className="flex flex-wrap gap-1.5">
                    {proposal.processLinks.map((l) => (
                      <Link key={l.id} href={`/processes/${l.processId}`}>
                        <Badge tone="clay">{l.process.name}</Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {systems.length > 0 && (
                <div>
                  <div className="mb-2 text-[11.5px] font-medium text-(--color-faint)">Systemer</div>
                  <div className="flex flex-wrap gap-1.5">
                    {systems.map((s) => (
                      <Badge key={s} tone="muted">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {data.length > 0 && (
                <div className="sm:col-span-2">
                  <div className="mb-2 text-[11.5px] font-medium text-(--color-faint)">Data</div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.map((d) => (
                      <Badge key={d} tone="faint">{d}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {notes.length > 0 && (
          <section className="mt-14">
            <div className="eyebrow mb-3">Fra kortlægningen</div>
            <h2 className="mb-5 text-[24px] font-semibold tracking-tight">Indsigter</h2>
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-[11px] font-medium text-(--color-ok)">
                  Fungerer ({works.length})
                </div>
                <div className="space-y-3">
                  {works.map((n, i) => (
                    <p key={i} className="border-l-2 border-(--color-ok) pl-3 text-[13.5px] leading-relaxed text-(--color-muted)">
                      {n.content}
                    </p>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-medium text-(--color-alert)">
                  Fungerer ikke ({broken.length})
                </div>
                <div className="space-y-3">
                  {broken.map((n, i) => (
                    <p key={i} className="border-l-2 border-(--color-alert) pl-3 text-[13.5px] leading-relaxed text-(--color-muted)">
                      {n.content}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {proposal.roiEstimate && (
          <section className="mt-14 rounded-2xl bg-(--color-raised) px-7 py-8">
            <div className="eyebrow mb-3">Estimeret afkast</div>
            <h2 className="mb-4 text-[24px] font-semibold tracking-tight">ROI</h2>
            <p className="text-[15px] leading-[1.8] text-(--color-muted)">
              {proposal.roiEstimate}
            </p>
          </section>
        )}

        <div className="mt-16 border-t border-(--color-line) pt-8">
          <div className="mb-2 text-[11.5px] text-(--color-faint)">
            {proposal.sourceKind === "WEB_CASE"
              ? "Kilde: lignende case fra websøgning"
              : proposal.sourceKind === "CONSULTANT_LOG"
                ? "Kilde: konsulenternes AIOS-log"
                : "Kilde: agentens egen analyse"}
          </div>
          <Link
            href="/improvements"
            className="text-[13px] font-medium text-(--color-clay) hover:underline"
          >
            ← Alle forslag
          </Link>
        </div>
      </div>
    </article>
  );
}

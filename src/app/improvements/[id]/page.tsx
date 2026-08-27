import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { MaterialButtons } from "@/components/MaterialButtons";
import { ProposalReportEditor } from "@/components/ProposalReportEditor";
import { ToBeFlow } from "@/components/ToBeFlow";
import { Badge } from "@/components/ui";
import { LEVERS, pickScore, proposalGradient, splitEvents } from "@/lib/domain";
import { splitInsights } from "@/lib/insights";
import {
  AIOS_BUILDING_BLOCKS,
  BUILD_TARGETS,
  RESOURCE_READINESS_LABELS,
  parseJsonList,
  type BuildTarget,
  type ResourceReadiness,
  type SystemFunction,
  type ToBeStep,
} from "@/lib/aios";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const proposal = await db.aiosProposal.findUnique({
    where: { id },
    include: {
      improvement: { include: { engagement: true, process: true, subProcess: true } },
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
  const systems = parseJsonList<string>(proposal.systemsUsed);
  const data = parseJsonList<string>(proposal.dataUsed);
  const roles = parseJsonList<string>(proposal.rolesAffected);
  const systemFunctions = parseJsonList<SystemFunction>(proposal.systemFunctions);
  const toBeSteps = parseJsonList<ToBeStep>(proposal.toBeSteps);
  const buildsInto = parseJsonList<BuildTarget>(proposal.buildsInto);
  const resourceReadiness = (proposal.resourceReadiness ?? "") as ResourceReadiness | "";
  const strategicGoalOptions = splitEvents(proposal.improvement.engagement.strategicGoals);

  const gradient = proposalGradient(proposal.id);

  return (
    <article>
      <div
        className="flex h-[280px] items-end px-8 py-8 sm:h-[340px]"
        style={{ background: gradient }}
      >
        <div className="mx-auto w-full max-w-[680px]">
          <div className="eyebrow mb-3 text-white/70">
            Forbedringsrapport · {proposal.layer === "ORCHESTRATION" ? "Orkestreringslag" : "Procesniveau"}
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
          <div className="flex items-center gap-2">
            <ProposalReportEditor
              proposalId={proposal.id}
              strategicGoal={proposal.strategicGoal ?? ""}
              rolesAffected={roles}
              requiresSystem={proposal.requiresSystem}
              systemFunctions={systemFunctions}
              toBeSteps={toBeSteps}
              buildsInto={buildsInto}
              resourceReadiness={resourceReadiness}
              resourceNotes={proposal.resourceNotes ?? ""}
              strategicGoalOptions={strategicGoalOptions}
            />
            <MaterialButtons
              filename={`${proposal.name.replace(/\s+/g, "-").toLowerCase()}.md`}
              content={`# ${proposal.name}\n\n${proposal.description}\n\n${proposal.howItWorks ? `## Sådan virker det\n${proposal.howItWorks}\n` : ""}`}
            />
          </div>
        </div>

        <section className="mb-10 rounded-lg border border-(--color-line-soft) bg-(--color-raised) p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {buildsInto.map((b) => (
              <Badge key={b} tone="faint">Bygges ind i: {BUILD_TARGETS[b]?.label ?? b}</Badge>
            ))}
            {proposal.strategicGoal && (
              <span className="text-[12.5px] text-(--color-muted)">
                hjælper på <span className="font-medium text-(--color-text)">{proposal.strategicGoal}</span>
              </span>
            )}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-[11px] font-medium text-(--color-faint)">Processer</div>
              <div className="flex flex-wrap gap-1.5">
                {proposal.processLinks.length > 0 ? (
                  proposal.processLinks.map((l) => (
                    <Link key={l.id} href={`/processes/${l.processId}`}>
                      <Badge tone="clay">{l.process.name}</Badge>
                    </Link>
                  ))
                ) : (
                  <span className="text-[12px] text-(--color-faint)">Ingen angivet</span>
                )}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-medium text-(--color-faint)">Roller</div>
              <div className="flex flex-wrap gap-1.5">
                {roles.length > 0 ? (
                  roles.map((r) => (
                    <Badge key={r} tone="warn">{r}</Badge>
                  ))
                ) : (
                  <span className="text-[12px] text-(--color-faint)">Ingen angivet</span>
                )}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-medium text-(--color-faint)">Systemer</div>
              <div className="flex flex-wrap gap-1.5">
                {systems.length > 0 ? (
                  systems.map((s) => <Badge key={s} tone="muted">{s}</Badge>)
                ) : (
                  <span className="text-[12px] text-(--color-faint)">Ingen angivet</span>
                )}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-medium text-(--color-faint)">Data</div>
              <div className="flex flex-wrap gap-1.5">
                {data.length > 0 ? (
                  data.map((d) => <Badge key={d} tone="faint">{d}</Badge>)
                ) : (
                  <span className="text-[12px] text-(--color-faint)">Ingen angivet</span>
                )}
              </div>
            </div>
          </div>
          {notes.length > 0 && (
            <p className="mt-4 border-t border-(--color-line) pt-3 text-[12.5px] text-(--color-faint)">
              Bygger på {notes.length} indsigter fra kortlægningen —{" "}
              <a href="#indsigter" className="text-(--color-clay) hover:underline">
                se dem nedenfor
              </a>
              .
            </p>
          )}
        </section>

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

        {proposal.requiresSystem && systemFunctions.length > 0 && (
          <section className="mt-14">
            <div className="eyebrow mb-3">AIOS-systemet</div>
            <h2 className="mb-2 text-[24px] font-semibold tracking-tight">Funktioner i systemet</h2>
            <p className="mb-5 text-[13.5px] text-(--color-faint)">
              Struktureret efter AIOS-byggestenene — model, kontekst, skills og resten af harnesset omkring modellen.
            </p>
            <div className="space-y-4">
              {systemFunctions.map((f, i) => (
                <div key={i} className="rounded-lg border border-(--color-line-soft) bg-(--color-surface) p-4">
                  <div className="mb-1 text-[13px] font-semibold text-(--color-clay)">
                    {AIOS_BUILDING_BLOCKS[f.block]?.label ?? f.block}
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-(--color-muted)">{f.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {(resourceReadiness || proposal.resourceNotes) && (
          <section className="mt-14">
            <div className="eyebrow mb-3">Fit/gap</div>
            <h2 className="mb-2 text-[24px] font-semibold tracking-tight">Ressourcer & kompetencer</h2>
            <p className="mb-4 text-[13.5px] text-(--color-faint)">
              Har virksomheden det der skal til for rent faktisk at bygge og drive dette?
            </p>
            {resourceReadiness && (
              <Badge tone={RESOURCE_READINESS_LABELS[resourceReadiness].tone}>
                {RESOURCE_READINESS_LABELS[resourceReadiness].label}
              </Badge>
            )}
            {proposal.resourceNotes && (
              <p className="mt-3 text-[15px] leading-[1.8] text-(--color-muted)">{proposal.resourceNotes}</p>
            )}
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

        {toBeSteps.length > 0 && (
          <section className="mt-14">
            <div className="eyebrow mb-3">To-be</div>
            <h2 className="mb-5 text-[24px] font-semibold tracking-tight">Sådan kunne processen se ud</h2>
            <div className="overflow-x-auto pb-2">
              <ToBeFlow steps={toBeSteps} />
            </div>
          </section>
        )}

        {notes.length > 0 && (
          <section id="indsigter" className="mt-14 scroll-mt-8">
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

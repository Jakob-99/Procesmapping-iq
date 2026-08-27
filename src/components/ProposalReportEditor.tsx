"use client";

import { useState, useTransition } from "react";
import { updateProposalReport } from "@/app/(customer)/improvements/actions";
import { Modal } from "./Modal";
import { ClayButton, OutlineButton } from "./ui";
import {
  AIOS_BUILDING_BLOCKS,
  BUILD_TARGETS,
  RESOURCE_READINESS_LABELS,
  type AiosBlock,
  type BuildTarget,
  type ResourceReadiness,
  type SystemFunction,
  type ToBeStep,
} from "@/lib/aios";

const BLOCK_KEYS = Object.keys(AIOS_BUILDING_BLOCKS) as AiosBlock[];
const BUILD_TARGET_KEYS = Object.keys(BUILD_TARGETS) as BuildTarget[];
const READINESS_KEYS = Object.keys(RESOURCE_READINESS_LABELS) as ResourceReadiness[];

function emptyStep(): ToBeStep {
  return { name: "", actorRole: "", isAi: true, description: "" };
}

/*
  Forbedringsrapportens grundlag redigeres samlet i én modal: strategisk mål,
  berørte roller, og — hvis forslaget kræver et selvstændigt AIOS-system —
  funktionslisten (struktureret efter AIOS-byggestenene) og en forenklet
  to-be-proces. Gemmes i ét kald (updateProposalReport) frem for felt-for-felt,
  fordi det hele hænger sammen som ét stykke rapportgrundlag.

  Bevidst INGEN "strategisk vs. operationelt"-kobling eller
  forretningsmodel-dimensioner her — rapporterne handler udelukkende om at
  forbedre eksisterende processer gennem AIOS-systemer og andre løsninger,
  ikke om at redesigne organisationen eller opfinde nye værditilbud.
*/
export function ProposalReportEditor({
  proposalId,
  strategicGoal: initialStrategicGoal,
  rolesAffected: initialRoles,
  requiresSystem: initialRequiresSystem,
  systemFunctions: initialFunctions,
  toBeSteps: initialSteps,
  buildsInto: initialBuildsInto,
  resourceReadiness: initialResourceReadiness,
  resourceNotes: initialResourceNotes,
  strategicGoalOptions,
}: {
  proposalId: string;
  strategicGoal: string;
  rolesAffected: string[];
  requiresSystem: boolean;
  systemFunctions: SystemFunction[];
  toBeSteps: ToBeStep[];
  buildsInto: BuildTarget[];
  resourceReadiness: ResourceReadiness | "";
  resourceNotes: string;
  strategicGoalOptions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [strategicGoal, setStrategicGoal] = useState(initialStrategicGoal);
  const [buildsInto, setBuildsInto] = useState<BuildTarget[]>(initialBuildsInto);
  const [resourceReadiness, setResourceReadiness] = useState<ResourceReadiness | "">(initialResourceReadiness);
  const [resourceNotes, setResourceNotes] = useState(initialResourceNotes);
  const [rolesText, setRolesText] = useState(initialRoles.join("\n"));
  const [requiresSystem, setRequiresSystem] = useState(initialRequiresSystem);
  const [functions, setFunctions] = useState<Record<AiosBlock, string>>(() => {
    const map = Object.fromEntries(BLOCK_KEYS.map((k) => [k, ""])) as Record<AiosBlock, string>;
    for (const f of initialFunctions) map[f.block] = f.description;
    return map;
  });
  const [steps, setSteps] = useState<ToBeStep[]>(initialSteps.length ? initialSteps : [emptyStep()]);

  function submit() {
    const rolesAffected = rolesText
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
    const systemFunctions: SystemFunction[] = BLOCK_KEYS.filter((k) => functions[k].trim()).map((k) => ({
      block: k,
      description: functions[k].trim(),
    }));
    const toBeSteps = steps
      .map((s) => ({ ...s, name: s.name.trim(), actorRole: s.actorRole.trim(), description: s.description.trim() }))
      .filter((s) => s.name);

    startTransition(async () => {
      await updateProposalReport(proposalId, {
        strategicGoal,
        rolesAffected,
        requiresSystem,
        systemFunctions,
        toBeSteps,
        buildsInto,
        resourceReadiness,
        resourceNotes,
      });
      setOpen(false);
    });
  }

  function toggleBuildTarget(k: BuildTarget) {
    setBuildsInto((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));
  }

  return (
    <>
      <OutlineButton onClick={() => setOpen(true)}>Rediger rapportgrundlag</OutlineButton>

      <Modal open={open} onClose={() => setOpen(false)} title="Forbedringsrapport — grundlag">
        <div className="space-y-7 pb-4">
          <section>
            <div className="eyebrow mb-2">Strategisk mål</div>
            <input
              value={strategicGoal}
              onChange={(e) => setStrategicGoal(e.target.value)}
              placeholder="Hvilket strategisk mål hjælper forslaget på?"
              className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
            />
            {strategicGoalOptions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {strategicGoalOptions.map((g) => (
                  <button
                    key={g}
                    onClick={() => setStrategicGoal(g)}
                    className="rounded-full border border-(--color-line-soft) px-2.5 py-1 text-[11px] text-(--color-muted) hover:border-(--color-clay-line) hover:text-(--color-clay)"
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="eyebrow mb-2">Bygges ind i</div>
            <p className="mb-2 text-[11.5px] text-(--color-faint)">
              Hvor bygges AIOS-systemet ind — i interne processer, i produktet, eller begge?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BUILD_TARGET_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => toggleBuildTarget(k)}
                  title={BUILD_TARGETS[k].blurb}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    buildsInto.includes(k)
                      ? "border-(--color-clay-line) bg-(--color-clay-wash) text-(--color-clay)"
                      : "border-(--color-line-soft) text-(--color-muted) hover:border-(--color-clay-line)"
                  }`}
                >
                  {BUILD_TARGETS[k].label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="eyebrow mb-2">Berørte roller</div>
            <textarea
              value={rolesText}
              onChange={(e) => setRolesText(e.target.value)}
              placeholder={"Én rolle pr. linje, fx\nBogholder\nProcesejer"}
              rows={3}
              className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
            />
          </section>

          <section>
            <label className="flex items-center gap-2 text-[12.5px] font-medium">
              <input
                type="checkbox"
                checked={requiresSystem}
                onChange={(e) => setRequiresSystem(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Forslaget kræver et selvstændigt AIOS-system
            </label>

            {requiresSystem && (
              <div className="mt-3 space-y-3 border-l-2 border-(--color-line) pl-4">
                <p className="text-[11.5px] text-(--color-faint)">
                  Beskriv systemets funktioner pr. AIOS-byggesten. Tomme felter tages ikke med i rapporten.
                </p>
                {BLOCK_KEYS.map((k) => (
                  <div key={k}>
                    <div className="mb-1 text-[12px] font-medium">{AIOS_BUILDING_BLOCKS[k].label}</div>
                    <textarea
                      value={functions[k]}
                      onChange={(e) => setFunctions((f) => ({ ...f, [k]: e.target.value }))}
                      placeholder={AIOS_BUILDING_BLOCKS[k].blurb}
                      rows={2}
                      className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="eyebrow mb-2">Ressourcer & kompetencer</div>
            <p className="mb-2 text-[11.5px] text-(--color-faint)">
              Har virksomheden det der skal til for rent faktisk at bygge og drive dette — ikke kun om det er en god idé?
            </p>
            <div className="mb-2 flex flex-wrap gap-2">
              {READINESS_KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => setResourceReadiness(k)}
                  className={`rounded-md border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    resourceReadiness === k
                      ? "border-(--color-clay-line) bg-(--color-clay-wash) text-(--color-clay)"
                      : "border-(--color-line) bg-(--color-surface) text-(--color-muted) hover:border-(--color-clay-line)"
                  }`}
                >
                  {RESOURCE_READINESS_LABELS[k].label}
                </button>
              ))}
            </div>
            <textarea
              value={resourceNotes}
              onChange={(e) => setResourceNotes(e.target.value)}
              placeholder="Hvilke kompetencer eller ressourcer mangler — eller er allerede til stede?"
              rows={2}
              className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
            />
          </section>

          <section>
            <div className="eyebrow mb-2">To-be-processen</div>
            <p className="mb-2 text-[11.5px] text-(--color-faint)">
              Et forenklet forløb der viser hvordan processen kunne se ud fremover.
            </p>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-1.5 rounded-md border border-(--color-line-soft) bg-(--color-raised) p-2">
                  <input
                    value={step.name}
                    onChange={(e) =>
                      setSteps((arr) => arr.map((s, j) => (j === i ? { ...s, name: e.target.value } : s)))
                    }
                    placeholder="Trin"
                    className="rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1 text-[12px] outline-none focus:border-(--color-clay)"
                  />
                  <input
                    value={step.actorRole}
                    onChange={(e) =>
                      setSteps((arr) => arr.map((s, j) => (j === i ? { ...s, actorRole: e.target.value } : s)))
                    }
                    placeholder="Udføres af"
                    className="rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1 text-[12px] outline-none focus:border-(--color-clay)"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-(--color-muted)">
                    <input
                      type="checkbox"
                      checked={step.isAi}
                      onChange={(e) =>
                        setSteps((arr) => arr.map((s, j) => (j === i ? { ...s, isAi: e.target.checked } : s)))
                      }
                      className="h-3.5 w-3.5"
                    />
                    AI
                  </label>
                  <button
                    onClick={() => setSteps((arr) => arr.filter((_, j) => j !== i))}
                    className="text-[11px] text-(--color-faint) hover:text-(--color-alert)"
                  >
                    Fjern
                  </button>
                  <textarea
                    value={step.description}
                    onChange={(e) =>
                      setSteps((arr) => arr.map((s, j) => (j === i ? { ...s, description: e.target.value } : s)))
                    }
                    placeholder="Kort beskrivelse (valgfrit)"
                    rows={1}
                    className="col-span-4 rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1 text-[12px] outline-none focus:border-(--color-clay)"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => setSteps((arr) => [...arr, emptyStep()])}
              className="mt-2 flex items-center gap-1.5 rounded-full border border-dashed border-(--color-line) px-3 py-1 text-[11.5px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
            >
              + Tilføj trin
            </button>
          </section>

          <div className="flex gap-2 border-t border-(--color-line) pt-4">
            <ClayButton onClick={submit} disabled={pending}>
              Gem
            </ClayButton>
            <button
              onClick={() => setOpen(false)}
              className="text-[12.5px] text-(--color-faint) hover:text-(--color-text)"
            >
              Annullér
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

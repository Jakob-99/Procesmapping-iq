"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  linkStepData,
  linkStepSystem,
  setStepActor,
  unlinkStepData,
  unlinkStepSystem,
  updateStepDetails,
} from "@/app/(customer)/processes/[processId]/[subId]/actions";
import { createSystem } from "@/app/(customer)/landscape/actions";
import { createDataObject } from "@/app/(customer)/data/actions";
import { createRole } from "@/app/(customer)/roles/actions";
import { Empty } from "./ui";

const NEW_ROLE = "__new_role__";
const NEW_SYSTEM = "__new_system__";

type StepSystemLink = { id: string; usage: string; systemId: string; systemName: string };
type StepDataLink = { id: string; direction: string; dataObjectId: string; dataObjectName: string };
type StepOption = {
  id: string;
  name: string;
  actorRoleId: string | null;
  actorSystemId: string | null;
  stepType: string;
  frequency: string | null;
  durationMin: number | null;
  painPoint: string | null;
  decisionCriteria: string | null;
  output: string | null;
  systems: StepSystemLink[];
  data: StepDataLink[];
};
type RoleOption = { id: string; name: string };
type SystemOption = { id: string; name: string };
type DataObjectOption = { id: string; name: string };

const USAGE_LABEL: Record<string, string> = { READ: "Læser", WRITE: "Skriver", BOTH: "Læser/skriver" };
const DIRECTION_LABEL: Record<string, string> = { INPUT: "Input", OUTPUT: "Output", BOTH: "Input/output" };

/*
  Skridtdetaljer — hvem/hvad udfører skridtet (rolle ELLER system, se
  setStepActor), hvilke systemer og dataobjekter det rører (StepSystem/
  StepData, koblet manuelt her — se linkStepSystem/linkStepData), plus
  frekvens, varighed, smertepunkt, beslutningsgrundlag og resultat.

  focusStepId åbnes automatisk og scrolles i view — det er destinationen når
  brugeren klikker en kontekst-/systemer-boks eller selve skridtet på
  BPMN-lærredet (se BpmnViewer.onElementClick / SubProcessWorkspace).
*/
export function StepDetailsPanel({
  processId,
  subProcessId,
  steps,
  roles,
  systems,
  dataObjects,
  focusStepId,
}: {
  processId: string;
  subProcessId: string;
  steps: StepOption[];
  roles: RoleOption[];
  systems: SystemOption[];
  dataObjects: DataObjectOption[];
  focusStepId?: string | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(focusStepId ?? null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!focusStepId) return;
    setExpandedId(focusStepId);
    rowRefs.current.get(focusStepId)?.scrollIntoView({ block: "nearest" });
  }, [focusStepId]);

  if (!steps.length) {
    return <Empty>Ingen skridt kortlagt endnu — tegn dem først på lærredet.</Empty>;
  }

  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <StepRow
          key={s.id}
          ref={(el) => {
            if (el) rowRefs.current.set(s.id, el);
            else rowRefs.current.delete(s.id);
          }}
          processId={processId}
          subProcessId={subProcessId}
          step={s}
          roles={roles}
          systems={systems}
          dataObjects={dataObjects}
          expanded={expandedId === s.id}
          onToggle={() => setExpandedId((id) => (id === s.id ? null : s.id))}
        />
      ))}
    </div>
  );
}

function StepRow({
  processId,
  subProcessId,
  step,
  roles,
  systems,
  dataObjects,
  expanded,
  onToggle,
  ref,
}: {
  processId: string;
  subProcessId: string;
  step: StepOption;
  roles: RoleOption[];
  systems: SystemOption[];
  dataObjects: DataObjectOption[];
  expanded: boolean;
  onToggle: () => void;
  ref: (el: HTMLDivElement | null) => void;
}) {
  const [actorPending, startActorTransition] = useTransition();
  const [creatingActor, setCreatingActor] = useState<"role" | "system" | null>(null);
  const [newActorName, setNewActorName] = useState("");
  const actorValue = step.actorRoleId
    ? `role:${step.actorRoleId}`
    : step.actorSystemId
      ? `system:${step.actorSystemId}`
      : "";

  function onActorChange(value: string) {
    if (value === NEW_ROLE) return setCreatingActor("role");
    if (value === NEW_SYSTEM) return setCreatingActor("system");
    const actor = value
      ? { type: value.startsWith("role:") ? ("role" as const) : ("system" as const), id: value.split(":")[1] }
      : null;
    startActorTransition(() => setStepActor(processId, subProcessId, step.id, actor));
  }

  function createActor() {
    if (!newActorName.trim() || !creatingActor) return;
    startActorTransition(async () => {
      const created =
        creatingActor === "role"
          ? await createRole(newActorName)
          : await createSystem(newActorName);
      if (created) {
        await setStepActor(processId, subProcessId, step.id, { type: creatingActor, id: created.id });
      }
      setCreatingActor(null);
      setNewActorName("");
    });
  }

  return (
    <div ref={ref} className="rounded-md border border-(--color-line)">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 truncate text-left text-[12.5px] text-(--color-text) hover:text-(--color-clay)"
        >
          {step.name}
        </button>
        {creatingActor ? (
          <div className="flex shrink-0 gap-1">
            <input
              value={newActorName}
              onChange={(e) => setNewActorName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createActor()}
              autoFocus
              placeholder={creatingActor === "role" ? "Ny rolle" : "Nyt system"}
              className="w-[110px] rounded-md border border-(--color-line) bg-(--color-surface) px-1.5 py-1 text-[11.5px] outline-none focus:border-(--color-clay)"
            />
            <button
              onClick={createActor}
              disabled={actorPending || !newActorName.trim()}
              title="Opret"
              className="rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-1.5 text-[11px] text-(--color-clay) disabled:opacity-40"
            >
              ✓
            </button>
            <button
              onClick={() => {
                setCreatingActor(null);
                setNewActorName("");
              }}
              title="Annullér"
              className="text-[11px] text-(--color-faint) hover:text-(--color-text)"
            >
              ×
            </button>
          </div>
        ) : (
          <select
            value={actorValue}
            disabled={actorPending}
            onChange={(e) => onActorChange(e.target.value)}
            className="w-[130px] shrink-0 rounded-md border border-(--color-line) bg-(--color-surface) px-1.5 py-1 text-[11.5px] outline-none focus:border-(--color-clay)"
          >
            <option value="">Ingen aktør</option>
            <optgroup label="Roller">
              {roles.map((r) => (
                <option key={r.id} value={`role:${r.id}`}>
                  {r.name}
                </option>
              ))}
              <option value={NEW_ROLE}>+ Opret ny rolle…</option>
            </optgroup>
            <optgroup label="Systemer">
              {systems.map((s) => (
                <option key={s.id} value={`system:${s.id}`}>
                  {s.name}
                </option>
              ))}
              <option value={NEW_SYSTEM}>+ Opret nyt system…</option>
            </optgroup>
          </select>
        )}
      </div>
      {expanded && (
        <StepDetailsForm
          processId={processId}
          subProcessId={subProcessId}
          step={step}
          systems={systems}
          dataObjects={dataObjects}
        />
      )}
    </div>
  );
}

function StepDetailsForm({
  processId,
  subProcessId,
  step,
  systems,
  dataObjects,
}: {
  processId: string;
  subProcessId: string;
  step: StepOption;
  systems: SystemOption[];
  dataObjects: DataObjectOption[];
}) {
  const [frequency, setFrequency] = useState(step.frequency ?? "");
  const [durationMin, setDurationMin] = useState(step.durationMin?.toString() ?? "");
  const [painPoint, setPainPoint] = useState(step.painPoint ?? "");
  const [decisionCriteria, setDecisionCriteria] = useState(step.decisionCriteria ?? "");
  const [output, setOutput] = useState(step.output ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const fieldClass =
    "w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)";

  function submit() {
    if (pending) return;
    startTransition(async () => {
      await updateStepDetails(processId, subProcessId, step.id, {
        frequency,
        durationMin: durationMin.trim() ? Number(durationMin) : null,
        painPoint,
        decisionCriteria,
        output,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div className="space-y-3 border-t border-(--color-line) px-2.5 py-2.5">
      <SystemsSection processId={processId} subProcessId={subProcessId} step={step} systems={systems} />
      <DataSection processId={processId} subProcessId={subProcessId} step={step} dataObjects={dataObjects} />

      <div>
        <div className="eyebrow mb-1">Frekvens</div>
        <input
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          placeholder='Fx "40 gange om dagen"'
          className={fieldClass}
        />
      </div>
      <div>
        <div className="eyebrow mb-1">Varighed (minutter)</div>
        <input
          type="number"
          min={0}
          value={durationMin}
          onChange={(e) => setDurationMin(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div>
        <div className="eyebrow mb-1">Smertepunkt</div>
        <textarea
          value={painPoint}
          onChange={(e) => setPainPoint(e.target.value)}
          rows={2}
          className={`${fieldClass} resize-none`}
        />
      </div>
      {step.stepType === "DECISION" && (
        <div>
          <div className="eyebrow mb-1">Beslutningsgrundlag</div>
          <input
            value={decisionCriteria}
            onChange={(e) => setDecisionCriteria(e.target.value)}
            placeholder="Hvad afgør skridtet?"
            className={fieldClass}
          />
        </div>
      )}
      <div>
        <div className="eyebrow mb-1">Resultat</div>
        <input
          value={output}
          onChange={(e) => setOutput(e.target.value)}
          placeholder="Hvad producerer skridtet?"
          className={fieldClass}
        />
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-2.5 py-1 text-[12px] font-medium text-(--color-clay) transition-colors hover:bg-(--color-clay-line) disabled:opacity-40"
      >
        {pending ? "Gemmer…" : saved ? "Gemt ✓" : "Gem"}
      </button>
    </div>
  );
}

function SystemsSection({
  processId,
  subProcessId,
  step,
  systems,
}: {
  processId: string;
  subProcessId: string;
  step: StepOption;
  systems: SystemOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const linkedIds = new Set(step.systems.map((l) => l.systemId));
  const available = systems.filter((s) => !linkedIds.has(s.id));
  const [pickId, setPickId] = useState("");
  const [usage, setUsage] = useState<"READ" | "WRITE" | "BOTH">("BOTH");

  function add() {
    if (!pickId) return;
    startTransition(async () => {
      await linkStepSystem(processId, subProcessId, step.id, pickId, usage);
      setPickId("");
    });
  }

  function createAndLink() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const system = await createSystem(newName);
      if (system) await linkStepSystem(processId, subProcessId, step.id, system.id, usage);
      setNewName("");
      setCreating(false);
    });
  }

  return (
    <div>
      <div className="eyebrow mb-1">Systemer</div>
      {step.systems.length > 0 && (
        <ul className="mb-1.5 space-y-1">
          {step.systems.map((link) => (
            <li
              key={link.id}
              className="group flex items-center justify-between gap-2 rounded-md border border-(--color-line-soft) bg-(--color-raised) px-2 py-1 text-[12px]"
            >
              <span className="min-w-0 flex-1 truncate">
                {link.systemName}{" "}
                <span className="text-(--color-faint)">· {USAGE_LABEL[link.usage] ?? link.usage}</span>
              </span>
              <button
                onClick={() =>
                  startTransition(() => unlinkStepSystem(processId, subProcessId, link.id))
                }
                disabled={pending}
                title="Fjern"
                className="shrink-0 text-[11px] text-(--color-faint) opacity-0 transition-opacity hover:text-(--color-alert) group-hover:opacity-100 disabled:opacity-40"
              >
                Fjern
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && !creating && (
        <div className="flex gap-1">
          <select
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-(--color-line) bg-(--color-surface) px-1.5 py-1 text-[11.5px] outline-none focus:border-(--color-clay)"
          >
            <option value="">Vælg eksisterende…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={usage}
            onChange={(e) => setUsage(e.target.value as typeof usage)}
            className="shrink-0 rounded-md border border-(--color-line) bg-(--color-surface) px-1 py-1 text-[11px] outline-none focus:border-(--color-clay)"
          >
            <option value="READ">Læser</option>
            <option value="WRITE">Skriver</option>
            <option value="BOTH">Begge</option>
          </select>
          <button
            onClick={add}
            disabled={pending || !pickId}
            title="Tilføj"
            className="shrink-0 rounded-md border border-dashed border-(--color-line) px-2 text-[13px] text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay) disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}

      {creating ? (
        <div className="mt-1.5 flex gap-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createAndLink()}
            autoFocus
            placeholder="Navn på nyt system"
            className="min-w-0 flex-1 rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1 text-[11.5px] outline-none focus:border-(--color-clay)"
          />
          <button
            onClick={createAndLink}
            disabled={pending || !newName.trim()}
            className="shrink-0 rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-2 text-[11.5px] font-medium text-(--color-clay) disabled:opacity-40"
          >
            Opret
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
            className="shrink-0 text-[11px] text-(--color-faint) hover:text-(--color-text)"
          >
            Annullér
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mt-1.5 text-[11px] text-(--color-clay) hover:underline"
        >
          + Opret nyt system
        </button>
      )}
    </div>
  );
}

function DataSection({
  processId,
  subProcessId,
  step,
  dataObjects,
}: {
  processId: string;
  subProcessId: string;
  step: StepOption;
  dataObjects: DataObjectOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const linkedIds = new Set(step.data.map((l) => l.dataObjectId));
  const available = dataObjects.filter((d) => !linkedIds.has(d.id));
  const [pickId, setPickId] = useState("");
  const [direction, setDirection] = useState<"INPUT" | "OUTPUT" | "BOTH">("INPUT");

  function add() {
    if (!pickId) return;
    startTransition(async () => {
      await linkStepData(processId, subProcessId, step.id, pickId, direction);
      setPickId("");
    });
  }

  function createAndLink() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const dataObject = await createDataObject(newName);
      if (dataObject) await linkStepData(processId, subProcessId, step.id, dataObject.id, direction);
      setNewName("");
      setCreating(false);
    });
  }

  return (
    <div>
      <div className="eyebrow mb-1">Input/output-data</div>
      {step.data.length > 0 && (
        <ul className="mb-1.5 space-y-1">
          {step.data.map((link) => (
            <li
              key={link.id}
              className="group flex items-center justify-between gap-2 rounded-md border border-(--color-line-soft) bg-(--color-raised) px-2 py-1 text-[12px]"
            >
              <span className="min-w-0 flex-1 truncate">
                {link.dataObjectName}{" "}
                <span className="text-(--color-faint)">
                  · {DIRECTION_LABEL[link.direction] ?? link.direction}
                </span>
              </span>
              <button
                onClick={() => startTransition(() => unlinkStepData(processId, subProcessId, link.id))}
                disabled={pending}
                title="Fjern"
                className="shrink-0 text-[11px] text-(--color-faint) opacity-0 transition-opacity hover:text-(--color-alert) group-hover:opacity-100 disabled:opacity-40"
              >
                Fjern
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && !creating && (
        <div className="flex gap-1">
          <select
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-(--color-line) bg-(--color-surface) px-1.5 py-1 text-[11.5px] outline-none focus:border-(--color-clay)"
          >
            <option value="">Vælg eksisterende…</option>
            {available.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as typeof direction)}
            className="shrink-0 rounded-md border border-(--color-line) bg-(--color-surface) px-1 py-1 text-[11px] outline-none focus:border-(--color-clay)"
          >
            <option value="INPUT">Input</option>
            <option value="OUTPUT">Output</option>
            <option value="BOTH">Begge</option>
          </select>
          <button
            onClick={add}
            disabled={pending || !pickId}
            title="Tilføj"
            className="shrink-0 rounded-md border border-dashed border-(--color-line) px-2 text-[13px] text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay) disabled:opacity-40"
          >
            +
          </button>
        </div>
      )}

      {creating ? (
        <div className="mt-1.5 flex gap-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createAndLink()}
            autoFocus
            placeholder="Navn på nyt dataobjekt"
            className="min-w-0 flex-1 rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1 text-[11.5px] outline-none focus:border-(--color-clay)"
          />
          <button
            onClick={createAndLink}
            disabled={pending || !newName.trim()}
            className="shrink-0 rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-2 text-[11.5px] font-medium text-(--color-clay) disabled:opacity-40"
          >
            Opret
          </button>
          <button
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
            className="shrink-0 text-[11px] text-(--color-faint) hover:text-(--color-text)"
          >
            Annullér
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="mt-1.5 text-[11px] text-(--color-clay) hover:underline"
        >
          + Opret nyt dataobjekt
        </button>
      )}
    </div>
  );
}

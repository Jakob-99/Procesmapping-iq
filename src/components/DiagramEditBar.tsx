"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import {
  addStep,
  deleteFlow,
  deleteStep,
  moveStep,
  updateFlow,
  updateStep,
} from "@/app/(customer)/processes/[processId]/[subId]/actions";
import { isGateway, STEP_TYPE_LABELS, type StepType } from "@/lib/domain";
import { InlineDelete } from "./InlineDelete";
import type { DiagramFlow, DiagramLane, DiagramStep } from "./SwimlaneDiagram";

/*
  Redigeringslinjen over diagrammet — alle værktøjer til at redigere
  processen samlet ét sted, ved siden af chatten.

  Venstre del skifter med det der er markeret:
  - intet: tilføj nye elementer og noter
  - et skridt: omdøb, type, svimlane, flyt op/ned, tilføj efter (eller ny
    gren fra en gateway), forbind med en pil, detaljer, slet
  - en pil: etiket, besked-pil, slet
  Højre del (tools) står der altid: svimlaner, pools og skridtdetaljer.
*/

const TYPES: { type: StepType; label: string; defaultName: string }[] = [
  { type: "TASK", label: "Aktivitet", defaultName: "Ny aktivitet" },
  { type: "DECISION", label: "Eksklusiv (X)", defaultName: "" },
  { type: "PARALLEL", label: "Parallel (+)", defaultName: "" },
  { type: "INCLUSIVE", label: "Inklusiv (O)", defaultName: "" },
  { type: "EVENT_GATEWAY", label: "Hændelsesbaseret", defaultName: "" },
  { type: "TIMER", label: "Timer", defaultName: "Ny timer" },
  { type: "START", label: "Start", defaultName: "Start" },
  { type: "END", label: "Slut", defaultName: "Slut" },
];
const GATEWAYS = TYPES.filter((t) => isGateway(t.type));
const OTHERS = TYPES.filter((t) => !isGateway(t.type));

const field =
  "h-8 rounded-md border border-(--color-line) bg-(--color-surface) px-2 text-[12.5px] outline-none focus:border-(--color-clay-line) disabled:opacity-50";
const chip =
  "h-8 rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 text-[12px] text-(--color-muted) transition-colors hover:border-(--color-clay-line) hover:text-(--color-text) disabled:opacity-40";

// Typevalg med gateways samlet i en gruppe, så listen er kort at overskue.
function TypeOptions({ exclude = [] as StepType[] }) {
  return (
    <>
      {OTHERS.filter((t) => !exclude.includes(t.type) && t.type === "TASK").map((t) => (
        <option key={t.type} value={t.type}>
          {t.label}
        </option>
      ))}
      <optgroup label="Gateway">
        {GATEWAYS.map((t) => (
          <option key={t.type} value={t.type}>
            {t.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Hændelse">
        {OTHERS.filter((t) => !exclude.includes(t.type) && t.type !== "TASK").map((t) => (
          <option key={t.type} value={t.type}>
            {t.label}
          </option>
        ))}
      </optgroup>
    </>
  );
}

export function DiagramEditBar({
  processId,
  subProcessId,
  lanes,
  steps,
  flows,
  selectedStepId,
  selectedFlow,
  connecting,
  onSelectStep,
  onClear,
  onStartConnect,
  onCancelConnect,
  onOpenDetails,
  placingNote,
  onPlaceNote,
  tools,
}: {
  processId: string;
  subProcessId: string;
  lanes: DiagramLane[];
  steps: DiagramStep[];
  flows: DiagramFlow[];
  selectedStepId: string | null;
  selectedFlow: { from: string; to: string } | null;
  connecting: boolean;
  onSelectStep: (id: string) => void;
  onClear: () => void;
  onStartConnect: () => void;
  onCancelConnect: () => void;
  onOpenDetails: (id: string) => void;
  placingNote: boolean;
  onPlaceNote: (on: boolean) => void;
  tools: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const step = steps.find((s) => s.id === selectedStepId) ?? null;
  const flow = selectedFlow
    ? flows.find((f) => f.from === selectedFlow.from && f.to === selectedFlow.to) ?? null
    : null;
  const nameOf = (id: string) => {
    const s = steps.find((x) => x.id === id);
    return s ? s.name || (isGateway(s.type) ? "Gateway" : STEP_TYPE_LABELS[s.type as StepType] ?? s.type) : "?";
  };
  // Nye elementer uden placering lægges i den første rigtige svimlane.
  const defaultLaneId = lanes.find((l) => !l.isDefault)?.id ?? lanes.find((l) => l.isDefault)?.id ?? null;
  const laneIdForAction = (laneId: string | null) =>
    laneId && lanes.find((l) => l.id === laneId)?.isDefault ? null : laneId;

  function add(type: StepType, afterStepId: string | null, laneId: string | null, branchLabel?: string) {
    const t = TYPES.find((x) => x.type === type)!;
    startTransition(async () => {
      const id = await addStep(processId, subProcessId, {
        type,
        name: t.defaultName,
        laneId: laneIdForAction(laneId),
        afterStepId,
        branchLabel,
      });
      if (id) onSelectStep(id);
    });
  }

  const bar = (children: ReactNode) => <Bar tools={tools}>{children}</Bar>;

  if (placingNote) {
    return bar(
      <>
        <span className="text-[12.5px] text-(--color-text)">Klik i diagrammet, hvor noten skal stå</span>
        <button type="button" onClick={() => onPlaceNote(false)} className={chip}>
          Annullér
        </button>
      </>,
    );
  }

  if (connecting && step) {
    return bar(
      <>
        <span className="text-[12.5px] text-(--color-text)">
          Klik på det skridt pilen fra <b>{nameOf(step.id)}</b> skal gå til
        </span>
        <button type="button" onClick={onCancelConnect} className={chip}>
          Annullér
        </button>
      </>,
    );
  }

  if (flow) {
    return bar(
      <>
        <span className="eyebrow">Pil</span>
        <span className="max-w-[260px] truncate text-[12.5px] text-(--color-text)">
          {nameOf(flow.from)} → {nameOf(flow.to)}
        </span>
        <FlowLabel
          key={`${flow.from}>${flow.to}`}
          initial={flow.label ?? ""}
          disabled={pending}
          onSave={(label) => startTransition(() => updateFlow(processId, subProcessId, flow.from, flow.to, { label }))}
        />
        <label className="flex items-center gap-1.5 text-[12px] text-(--color-muted)">
          <input
            type="checkbox"
            checked={flow.kind === "MESSAGE"}
            disabled={pending}
            onChange={(e) =>
              startTransition(() =>
                updateFlow(processId, subProcessId, flow.from, flow.to, {
                  kind: e.target.checked ? "MESSAGE" : "SEQUENCE",
                }),
              )
            }
          />
          Besked-pil
        </label>
        <Divider />
        <InlineDelete
          pending={pending}
          label="Slet pil"
          onConfirm={() =>
            startTransition(async () => {
              await deleteFlow(processId, subProcessId, flow.from, flow.to);
              onClear();
            })
          }
        />
        <CloseButton onClick={onClear} />
      </>,
    );
  }

  if (step) {
    const index = steps.findIndex((s) => s.id === step.id);
    const gateway = isGateway(step.type);
    return bar(
      <>
        <StepName
          key={`name-${step.id}`}
          initial={step.name}
          placeholder={gateway ? "Spørgsmål (valgfrit)" : "Navn"}
          disabled={pending}
          onSave={(name) => startTransition(() => updateStep(processId, subProcessId, step.id, { name }))}
        />
        <select
          value={step.type}
          disabled={pending}
          onChange={(e) =>
            startTransition(() => updateStep(processId, subProcessId, step.id, { type: e.target.value as StepType }))
          }
          className={`${field} w-[140px]`}
          title="Type"
        >
          <TypeOptions />
        </select>
        <select
          value={step.laneId}
          disabled={pending}
          onChange={(e) => {
            const laneId = laneIdForAction(e.target.value);
            startTransition(() => moveStep(processId, subProcessId, step.id, { laneId }));
          }}
          className={`${field} w-[150px]`}
          title="Svimlane"
        >
          {lanes.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <span className="flex">
          <button
            type="button"
            title="Flyt op"
            disabled={pending || index <= 0}
            onClick={() => startTransition(() => moveStep(processId, subProcessId, step.id, { position: index - 1 }))}
            className={`${chip} rounded-r-none px-2`}
          >
            ↑
          </button>
          <button
            type="button"
            title="Flyt ned"
            disabled={pending || index >= steps.length - 1}
            onClick={() => startTransition(() => moveStep(processId, subProcessId, step.id, { position: index + 1 }))}
            className={`${chip} -ml-px rounded-l-none px-2`}
          >
            ↓
          </button>
        </span>
        <Divider />
        {gateway ? (
          <NewBranch
            key={`branch-${step.id}`}
            disabled={pending}
            onCreate={(type, label) => add(type, step.id, step.laneId, label)}
          />
        ) : (
          <select
            value=""
            disabled={pending}
            onChange={(e) => e.target.value && add(e.target.value as StepType, step.id, step.laneId)}
            className={`${field} w-[130px]`}
            title="Indsæt et nyt element lige efter dette"
          >
            <option value="">+ Tilføj efter…</option>
            <TypeOptions exclude={["START"]} />
          </select>
        )}
        <button type="button" onClick={onStartConnect} disabled={pending} className={chip}>
          Forbind til…
        </button>
        {step.type !== "START" && step.type !== "END" && (
          <button type="button" onClick={() => onOpenDetails(step.id)} className={chip}>
            Detaljer
          </button>
        )}
        <Divider />
        <InlineDelete
          pending={pending}
          title="Pilene til og fra skridtet sys sammen igen"
          onConfirm={() =>
            startTransition(async () => {
              await deleteStep(processId, subProcessId, step.id);
              onClear();
            })
          }
        />
        <CloseButton onClick={onClear} />
      </>,
    );
  }

  // Intet markeret: tilføj. Aktiviteter, gateways og timere sættes ind lige
  // før første sluthændelse — efter det skridt der peger på den — så de
  // hænger sammen med forløbet med det samme.
  const firstEnd = steps.find((s) => s.type === "END");
  const before = firstEnd ? flows.find((f) => f.to === firstEnd.id)?.from ?? null : null;
  const placement = (type: StepType) => {
    const after = type === "START" || type === "END" ? null : before;
    const laneId = after ? steps.find((s) => s.id === after)?.laneId ?? defaultLaneId : defaultLaneId;
    return [after, laneId] as const;
  };
  const addButton = (type: StepType, label: string) => (
    <button key={type} type="button" disabled={pending} onClick={() => add(type, ...placement(type))} className={chip}>
      + {label}
    </button>
  );
  return bar(
    <>
      <span className="eyebrow">Tilføj</span>
      {addButton("TASK", "Aktivitet")}
      <select
        value=""
        disabled={pending}
        onChange={(e) => e.target.value && add(e.target.value as StepType, ...placement(e.target.value as StepType))}
        className={`${field} w-[120px]`}
        title="Tilføj en gateway"
      >
        <option value="">+ Gateway…</option>
        {GATEWAYS.map((t) => (
          <option key={t.type} value={t.type}>
            {t.label}
          </option>
        ))}
      </select>
      {addButton("TIMER", "Timer")}
      {addButton("START", "Start")}
      {addButton("END", "Slut")}
      <Divider />
      <button type="button" onClick={() => onPlaceNote(true)} className={chip}>
        + Note
      </button>
    </>,
  );
}

function Bar({ children, tools }: { children: ReactNode; tools: ReactNode }) {
  return (
    <div className="mb-3 flex items-start gap-3 rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2">
      <div className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      <div className="flex shrink-0 items-center gap-2 border-l border-(--color-line) pl-3">{tools}</div>
    </div>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-(--color-line)" />;
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Fjern markering (Esc)"
      className="h-8 px-1 text-[15px] leading-none text-(--color-faint) hover:text-(--color-text)"
    >
      ×
    </button>
  );
}

// En ny gren ud fra en gateway: skriv evt. en etiket ("Ja", "Nej"…), og vælg
// hvad grenen starter med — så oprettes den med det samme. De eksisterende
// grene røres ikke.
function NewBranch({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (type: StepType, label: string) => void;
}) {
  const [label, setLabel] = useState("");
  return (
    <span className="flex">
      <input
        value={label}
        disabled={disabled}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onCreate("TASK", label);
            setLabel("");
          }
        }}
        placeholder="Etiket"
        title='Etiket på pilen til den nye gren, fx "Ja"'
        className={`${field} w-[90px] rounded-r-none`}
      />
      <select
        value=""
        disabled={disabled}
        onChange={(e) => {
          if (!e.target.value) return;
          onCreate(e.target.value as StepType, label);
          setLabel("");
        }}
        className={`${field} -ml-px w-[120px] rounded-l-none border-(--color-clay-line) text-(--color-clay)`}
        title="Tilføj en ny gren ud fra gatewayen"
      >
        <option value="">+ Ny gren…</option>
        <TypeOptions exclude={["START"]} />
      </select>
    </span>
  );
}

function StepName({
  initial,
  placeholder,
  disabled,
  onSave,
}: {
  initial: string;
  placeholder: string;
  disabled: boolean;
  onSave: (name: string) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  const save = () => value.trim() !== initial.trim() && onSave(value);
  return (
    <input
      autoFocus
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className={`${field} w-52 font-medium`}
    />
  );
}

function FlowLabel({
  initial,
  disabled,
  onSave,
}: {
  initial: string;
  disabled: boolean;
  onSave: (label: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const save = () => value.trim() !== initial.trim() && onSave(value);
  return (
    <input
      autoFocus
      value={value}
      disabled={disabled}
      placeholder='Etiket, fx "Ja"'
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
      className={`${field} w-44`}
    />
  );
}

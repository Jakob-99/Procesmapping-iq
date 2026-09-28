"use client";

import { useState, useTransition } from "react";
import {
  addFinding,
  deleteFinding,
  updateFinding,
} from "@/app/(customer)/processes/[processId]/[subId]/actions";
import { InlineDelete } from "./InlineDelete";

/*
  Analysen under diagrammet i tre spalter: problemer/findings, ønsker og
  forbedringer, og mulige ideer der er diskuteret. Hvert punkt kan kobles
  til et skridt i diagrammet. Proces-agenten i chatten kan også selv notere
  punkter, når de dukker op i samtalen.
*/

type Kind = "PROBLEM" | "WISH" | "IDEA";
export type Finding = { id: string; kind: string; text: string; stepId: string | null };
type StepOption = { id: string; name: string };

const SECTIONS: { kind: Kind; title: string; placeholder: string; dot: string }[] = [
  {
    kind: "PROBLEM",
    title: "Problemer / findings",
    placeholder: "Fx: Antallet tastes i hånden i Kanpla, og fejl opdages først dagen efter",
    dot: "bg-(--color-alert)",
  },
  {
    kind: "WISH",
    title: "Ønsker og forbedringer",
    placeholder: "Fx: Bestillingen skal kunne rettes uden at logge ind i Kanpla",
    dot: "bg-(--color-clay)",
  },
  {
    kind: "IDEA",
    title: "Mulige ideer diskuteret",
    placeholder: "Fx: En agent tæller kalenderne og bestiller automatisk hver onsdag",
    dot: "bg-(--color-ok)",
  },
];

export function ProcessAnalysis({
  processId,
  subProcessId,
  findings,
  steps,
}: {
  processId: string;
  subProcessId: string;
  findings: Finding[];
  steps: StepOption[];
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-[18px] font-semibold tracking-tight">Analyse</h3>
      <p className="mb-5 max-w-[68ch] text-[12.5px] text-(--color-muted)">
        Det kortlægningen har vist. Skriv punkterne her, eller bed agenten i chatten om at notere dem.
      </p>
      <div className="grid gap-5 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Column
            key={s.kind}
            section={s}
            processId={processId}
            subProcessId={subProcessId}
            items={findings.filter((f) => f.kind === s.kind)}
            steps={steps}
          />
        ))}
      </div>
    </section>
  );
}

function Column({
  section,
  processId,
  subProcessId,
  items,
  steps,
}: {
  section: (typeof SECTIONS)[number];
  processId: string;
  subProcessId: string;
  items: Finding[];
  steps: StepOption[];
}) {
  const [text, setText] = useState("");
  const [stepId, setStepId] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!text.trim()) return;
    const value = text;
    startTransition(async () => {
      await addFinding(processId, subProcessId, section.kind, value, stepId || null);
      setText("");
      setStepId("");
    });
  }

  return (
    <div className="rounded-lg border border-(--color-line-soft) bg-(--color-surface) p-4 shadow-[0_1px_2px_rgba(20,16,12,0.03)]">
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${section.dot}`} />
        <h4 className="text-[14px] font-semibold tracking-tight">{section.title}</h4>
        <span className="tabular ml-auto text-[11.5px] text-(--color-faint)">{items.length}</span>
      </div>

      {items.length > 0 && (
        <ul className="mb-3 space-y-2">
          {items.map((f) => (
            <Item key={f.id} finding={f} processId={processId} subProcessId={subProcessId} steps={steps} />
          ))}
        </ul>
      )}

      <div className="space-y-1.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
          rows={2}
          disabled={pending}
          placeholder={section.placeholder}
          className="w-full resize-none rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] leading-snug outline-none placeholder:text-(--color-faint) focus:border-(--color-clay-line) disabled:opacity-50"
        />
        {text.trim() && (
          <div className="flex items-center gap-2">
            <StepSelect value={stepId} onChange={setStepId} steps={steps} />
            <button
              type="button"
              onClick={add}
              disabled={pending}
              className="shrink-0 rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-3 py-1.5 text-[12px] font-medium text-(--color-clay) transition-colors hover:bg-(--color-clay-line) disabled:opacity-40"
            >
              Tilføj
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepSelect({
  value,
  onChange,
  steps,
}: {
  value: string;
  onChange: (v: string) => void;
  steps: StepOption[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-0 flex-1 rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-[12px] text-(--color-muted) outline-none focus:border-(--color-clay-line)"
    >
      <option value="">Hele processen</option>
      {steps.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

function Item({
  finding,
  processId,
  subProcessId,
  steps,
}: {
  finding: Finding;
  processId: string;
  subProcessId: string;
  steps: StepOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(finding.text);
  const [stepId, setStepId] = useState(finding.stepId ?? "");
  const [pending, startTransition] = useTransition();
  const stepName = steps.find((s) => s.id === finding.stepId)?.name;

  if (editing) {
    return (
      <li className="space-y-1.5 border-l-2 border-(--color-clay) pl-3">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-md border border-(--color-line) px-2.5 py-1.5 text-[12.5px] leading-snug outline-none focus:border-(--color-clay-line)"
        />
        <div className="flex items-center gap-2">
          <StepSelect value={stepId} onChange={setStepId} steps={steps} />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await updateFinding(processId, subProcessId, finding.id, { text, stepId: stepId || null });
                setEditing(false);
              })
            }
            className="shrink-0 text-[12px] font-medium text-(--color-clay) hover:underline"
          >
            Gem
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="shrink-0 text-[12px] text-(--color-faint) hover:text-(--color-text)"
          >
            Annullér
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`group border-l-2 border-(--color-line) pl-3 transition-colors hover:border-(--color-clay) ${
        pending ? "opacity-40" : ""
      }`}
    >
      <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-(--color-text)">{finding.text}</p>
      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-(--color-faint)">
        {stepName && <span>↳ {stepName}</span>}
        <span className="ml-auto flex items-center gap-2.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={() => setEditing(true)} className="hover:text-(--color-text)">
            Rediger
          </button>
          <InlineDelete
            pending={pending}
            onConfirm={() => startTransition(() => deleteFinding(processId, subProcessId, finding.id))}
          />
        </span>
      </div>
    </li>
  );
}

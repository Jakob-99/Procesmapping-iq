"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { BpmnViewer, type BpmnEditorHandle } from "./BpmnViewer";
import { InterviewPanel } from "./InterviewPanel";
import { InsightsPanel } from "./InsightsPanel";
import { ExpertsPanel } from "./ExpertsPanel";
import { ValidationPanel } from "./ValidationPanel";
import { TriggersPanel } from "./TriggersPanel";
import { AssigneeSelect } from "./AssigneeSelect";
import { Badge, ClayButton, Empty, type Tone } from "./ui";
import { saveDiagram } from "@/app/processes/[processId]/[subId]/actions";

/*
  Underprocessens arbejdsflade: tegningen får hele skærmen på et prikket
  lærred, ligesom et whiteboard. Man redigerer den direkte — sletter og tegner
  figurer og pile med bpmn-js's egen palet — i stedet for gennem en liste ved
  siden af. Alt det der før stod i en fast højrekolonne er nu funktioner man
  henter frem i et panel, så tegningen aldrig skal dele pladsen med noget den
  ikke har brug for.
*/

type Note = { id: string; category: string; content: string; importance: number };
type Message = { id: string; role: string; content: string };
type Expert = { id: string; name: string; email: string; invitedAt: string | null };
type Validation = {
  id: string;
  verdict: string;
  comment: string | null;
  validatorId: string;
  createdAt: string;
};
type ImprovementLogItem = { id: string; content: string; status: string; createdAt: string };

const DOCK_ITEMS = [
  { key: "ansvarlig", label: "Ansvarlig" },
  { key: "haendelser", label: "Start/slut" },
  { key: "eksperter", label: "Procesksperter" },
  { key: "keynotes", label: "Keynotes" },
  { key: "validering", label: "Validering" },
  { key: "indsigter", label: "Indsigter" },
] as const;

type DockKey = (typeof DOCK_ITEMS)[number]["key"];

function DockIcon({ dockKey }: { dockKey: DockKey }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (dockKey) {
    case "ansvarlig":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5 19a7 7 0 0 1 14 0" />
        </svg>
      );
    case "haendelser":
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="2.6" />
          <circle cx="18" cy="12" r="2.6" />
          <path d="M8.6 12h6.8" strokeDasharray="2.5 2.5" />
        </svg>
      );
    case "eksperter":
      return (
        <svg {...common}>
          <circle cx="8.5" cy="8" r="2.8" />
          <path d="M3.5 19a5 5 0 0 1 10 0" />
          <path d="M14.5 6.3a2.8 2.8 0 0 1 0 5.2" />
          <path d="M16 19a4.6 4.6 0 0 0-2.7-4.2" />
        </svg>
      );
    case "keynotes":
      return (
        <svg {...common}>
          <path d="M6 4h9l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
          <path d="M9 12h6M9 16h6" />
        </svg>
      );
    case "validering":
      return (
        <svg {...common}>
          <path d="M12 3.5 4.5 6.5v5.3c0 4.4 3.2 6.9 7.5 8.7 4.3-1.8 7.5-4.3 7.5-8.7V6.5Z" />
          <path d="m9 12 2 2 4-4.2" />
        </svg>
      );
    case "indsigter":
      return (
        <svg {...common}>
          <path d="M12 3a5.5 5.5 0 0 0-3 10.1V15h6v-1.9A5.5 5.5 0 0 0 12 3Z" />
          <path d="M10 19h4M10.5 21h3" />
        </svg>
      );
  }
}

export function SubProcessWorkspace({
  processId,
  processName,
  sp,
  statusLabel,
  statusTone,
  bpmnXml,
  manualCount,
  totalMin,
  notes,
  transcript,
  interviewer,
  experts,
  validations,
  improvementLogs,
  subProcessId,
  startEvents,
  endEvents,
  users,
}: {
  processId: string;
  processName: string;
  sp: {
    id: string;
    name: string;
    assigneeId: string | null;
    assignee: { name: string; title: string | null } | null;
  };
  statusLabel: string;
  statusTone: Tone;
  bpmnXml: string | null;
  manualCount: number;
  totalMin: number;
  notes: Note[];
  transcript: Message[];
  interviewer: string | null;
  experts: Expert[];
  validations: Validation[];
  improvementLogs: ImprovementLogItem[];
  subProcessId: string;
  startEvents: string[];
  endEvents: string[];
  users: { id: string; name: string }[];
}) {
  const [panel, setPanel] = useState<DockKey | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<BpmnEditorHandle>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    const nodes = editorRef.current?.getOrderedNodes();
    if (!nodes) return;
    startTransition(async () => {
      await saveDiagram(processId, subProcessId, nodes);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  // Luk panelet med Escape eller ved klik udenfor — det skal føles som et
  // overlay, ikke en fast del af siden.
  useEffect(() => {
    if (!panel) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPanel(null);
    }
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (drawerRef.current?.contains(target) || dockRef.current?.contains(target)) return;
      setPanel(null);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [panel]);

  const validationTone: Tone | null =
    validations.length === 0
      ? null
      : validations.every((v) => v.verdict === "APPROVED")
        ? "ok"
        : "warn";

  const badgeFor: Record<DockKey, number | null> = {
    ansvarlig: null,
    haendelser: startEvents.length + endEvents.length || null,
    eksperter: experts.length || null,
    keynotes: notes.length || null,
    validering: null,
    indsigter: notes.length + improvementLogs.length || null,
  };

  return (
    <div className="dot-grid relative h-full w-full overflow-hidden bg-(--color-raised)">
      {/* Flydende topbjælke — tilbage, navn, status */}
      <div className="absolute left-4 right-4 top-4 z-10 flex items-center gap-3">
        <Link
          href={`/processes/${processId}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-(--color-line) bg-(--color-surface) text-(--color-muted) shadow-sm transition-colors hover:border-(--color-clay-line) hover:text-(--color-text)"
          title="Tilbage til processen"
        >
          ←
        </Link>
        <div className="min-w-0 rounded-md border border-(--color-line) bg-(--color-surface) px-3.5 py-2 shadow-sm">
          <div className="eyebrow">{processName}</div>
          <div className="truncate text-[14px] font-semibold leading-tight">{sp.name}</div>
        </div>
        <Badge tone={statusTone}>{statusLabel}</Badge>
        {bpmnXml && (
          <div className="tabular ml-auto hidden gap-3 rounded-md border border-(--color-line) bg-(--color-surface) px-3 py-2 text-[11.5px] text-(--color-faint) shadow-sm sm:flex">
            <span>{manualCount} manuelle</span>
            {totalMin > 0 && <span>~{totalMin} min i alt</span>}
          </div>
        )}
        {bpmnXml && (dirty || saved) && (
          <ClayButton onClick={handleSave} disabled={pending || !dirty} className="!py-2 !text-[12.5px] shadow-sm">
            {saved ? "Gemt ✓" : pending ? "Gemmer…" : "Gem ændringer"}
          </ClayButton>
        )}
      </div>

      {/* Selve lærredet */}
      <div className="flex h-full w-full items-center justify-center pt-16">
        {bpmnXml ? (
          <BpmnViewer
            key={subProcessId}
            ref={editorRef}
            xml={bpmnXml}
            bare
            editable
            className="h-full"
            onDirty={() => setDirty(true)}
          />
        ) : (
          <div className="rounded-md border border-(--color-line) bg-(--color-surface) px-6 py-5 shadow-sm">
            <Empty>
              Ingen skridt kortlagt endnu. Agenten interviewer den ansvarlige
              medarbejder og tegner forløbet derfra.
            </Empty>
          </div>
        )}
      </div>

      {/* Flydende dock — funktionerne der før stod i højrekolonnen */}
      <div
        ref={dockRef}
        className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1.5 rounded-lg border border-(--color-line) bg-(--color-surface) p-1.5 shadow-sm"
      >
        {DOCK_ITEMS.map((d) => {
          const count = badgeFor[d.key];
          return (
            <button
              key={d.key}
              title={d.label}
              onClick={() => setPanel((p) => (p === d.key ? null : d.key))}
              className={`relative flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
                panel === d.key
                  ? "bg-(--color-clay-wash) text-(--color-clay)"
                  : "text-(--color-muted) hover:bg-(--color-sunken) hover:text-(--color-text)"
              }`}
            >
              <DockIcon dockKey={d.key} />
              {count !== null && (
                <span className="tabular absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-(--color-clay) px-1 text-[9.5px] font-medium leading-none text-white">
                  {count}
                </span>
              )}
              {d.key === "validering" && validationTone && (
                <span
                  className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-(--color-surface) ${
                    validationTone === "ok" ? "bg-(--color-ok)" : "bg-(--color-warn)"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Panelet der glider ind fra højre med det valgte indhold */}
      {panel && (
        <div
          ref={drawerRef}
          className="absolute right-[68px] top-4 bottom-4 z-10 w-[320px] overflow-y-auto rounded-lg border border-(--color-line) bg-(--color-surface) p-4 shadow-lg"
        >
          <DrawerContent
            panel={panel}
            processId={processId}
            sp={sp}
            experts={experts}
            notes={notes}
            transcript={transcript}
            interviewer={interviewer}
            validations={validations}
            improvementLogs={improvementLogs}
            startEvents={startEvents}
            endEvents={endEvents}
            users={users}
          />
        </div>
      )}
    </div>
  );
}

function DrawerHeader({ label }: { label: string }) {
  return <h2 className="mb-3 text-[15px] font-semibold tracking-tight">{label}</h2>;
}

function DrawerContent({
  panel,
  processId,
  sp,
  experts,
  notes,
  transcript,
  interviewer,
  validations,
  improvementLogs,
  startEvents,
  endEvents,
  users,
}: {
  panel: DockKey;
  processId: string;
  sp: {
    id: string;
    assigneeId: string | null;
    assignee: { name: string; title: string | null } | null;
  };
  experts: Expert[];
  notes: Note[];
  transcript: Message[];
  interviewer: string | null;
  validations: Validation[];
  improvementLogs: ImprovementLogItem[];
  startEvents: string[];
  endEvents: string[];
  users: { id: string; name: string }[];
}): ReactNode {
  switch (panel) {
    case "haendelser":
      return (
        <div>
          <DrawerHeader label="Start/slut-hændelser" />
          <TriggersPanel
            processId={processId}
            subProcessId={sp.id}
            startEvents={startEvents}
            endEvents={endEvents}
          />
        </div>
      );
    case "ansvarlig":
      return (
        <div>
          <DrawerHeader label="Kortlagt af" />
          <AssigneeSelect
            processId={processId}
            subProcessId={sp.id}
            assigneeId={sp.assigneeId}
            users={users}
            className="w-full"
          />
          {sp.assignee?.title && (
            <div className="mt-2 text-[11.5px] text-(--color-faint)">{sp.assignee.title}</div>
          )}
          <Link
            href={`/interviews/preview?sub=${sp.id}`}
            className="mt-4 block rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-3 py-2.5 text-center text-[12.5px] font-medium text-(--color-clay) transition-colors hover:bg-(--color-clay-line)"
          >
            Se interviewet
          </Link>
        </div>
      );
    case "eksperter":
      return (
        <div>
          <DrawerHeader label={`Procesksperter · ${experts.length}`} />
          <ExpertsPanel processId={processId} subProcessId={sp.id} experts={experts} users={users} />
        </div>
      );
    case "keynotes":
      return (
        <div>
          <DrawerHeader label="Keynotes fra interviewet" />
          <InterviewPanel notes={notes} transcript={transcript} interviewer={interviewer} />
        </div>
      );
    case "validering":
      return (
        <div>
          <DrawerHeader label="Validering" />
          <ValidationPanel
            processId={processId}
            subProcessId={sp.id}
            validations={validations}
            users={users}
          />
        </div>
      );
    case "indsigter":
      return <InsightsPanel notes={notes} logs={improvementLogs} />;
  }
}

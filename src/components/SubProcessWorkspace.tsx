"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  SwimlaneDiagram,
  type DiagramFlow,
  type DiagramLane,
  type DiagramPool,
  type DiagramStep,
} from "./SwimlaneDiagram";
import { PoolEditor } from "./PoolEditor";
import { ProcessAnalysis, type Finding } from "./ProcessAnalysis";
import { DiagramEditBar } from "./DiagramEditBar";
import { DiagramNotes, type Note } from "./DiagramNotes";
import { ZoomableDiagram } from "./ZoomableDiagram";
import { addFlow, moveStep } from "@/app/(customer)/processes/[processId]/[subId]/actions";
import { ProcessChat } from "./ProcessChat";
import { AssigneeSelect } from "./AssigneeSelect";
import { StepDetailsPanel } from "./StepDetailsPanel";
import { LaneEditor } from "./LaneEditor";
import { Badge, type Tone } from "./ui";
import { setSubProcessStatus } from "@/app/(customer)/processes/[processId]/[subId]/actions";
import { SUBPROCESS_STATUS, isStartOrEnd } from "@/lib/domain";

/*
  Underprocessens arbejdsflade: diagrammet i midten (samme notation som
  Cornerstones' procesmodel), systemerne processen bruger under det, og
  chatten med proces-agenten fast i bunden — det er dér diagrammet ændres.
  Klik på et skridt åbner Skridtdetaljer i et panel til højre; klik på en
  svimlanes overskrift åbner en lille boks til at skifte eller slette aktøren.
*/

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
type Option = { id: string; name: string };
type LaneOption = {
  id: string;
  isDefault: boolean;
  actorRoleId: string | null;
  actorSystemId: string | null;
  actorName: string | null;
  poolId: string | null;
};
type SystemCard = { id: string; name: string; type: string | null; integration: string | null; data: string[] };
type ChatMessage = { id: string; role: string; content: string; userName: string | null };

type PanelKey = "ansvarlig" | "detaljer";

export function SubProcessWorkspace({
  processId,
  processName,
  sp,
  status,
  statusLabel,
  statusTone,
  users,
  roles,
  systems,
  dataObjects,
  lanes,
  steps,
  diagram,
  systemCards,
  findings,
  notes,
  chat,
}: {
  processId: string;
  processName: string;
  sp: {
    id: string;
    name: string;
    summary: string | null;
    assigneeId: string | null;
    assignee: { name: string; title: string | null } | null;
    interviewActive: boolean;
  };
  status: string;
  statusLabel: string;
  statusTone: Tone;
  users: Option[];
  roles: Option[];
  systems: Option[];
  dataObjects: Option[];
  lanes: LaneOption[];
  steps: StepOption[];
  diagram: { pools: DiagramPool[]; lanes: DiagramLane[]; steps: DiagramStep[]; flows: DiagramFlow[] };
  systemCards: SystemCard[];
  findings: Finding[];
  notes: Note[];
  chat: ChatMessage[];
}) {
  const [placingNote, setPlacingNote] = useState(false);
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const [focusStepId, setFocusStepId] = useState<string | null>(null);
  // Markering i diagrammet: et skridt (focusStepId) eller en pil — aldrig begge.
  const [selectedFlow, setSelectedFlow] = useState<{ from: string; to: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [, startDiagramTransition] = useTransition();

  function clearSelection() {
    setFocusStepId(null);
    setSelectedFlow(null);
    setConnecting(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.key === "Escape" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) clearSelection();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  // Samme lille boks bruges til svimlaner og pools — kind afgør indholdet.
  const [lanePopover, setLanePopover] = useState<{
    kind: "lane" | "pool";
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Luk panel/popover med Escape eller klik udenfor.
  useEffect(() => {
    if (!panel && !lanePopover) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPanel(null);
        setLanePopover(null);
      }
    }
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (drawerRef.current?.contains(t) || popoverRef.current?.contains(t) || toolbarRef.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.("[data-diagram-click]")) return;
      setPanel(null);
      setLanePopover(null);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [panel, lanePopover]);

  function openPopover(kind: "lane" | "pool", id: string, rect: DOMRect) {
    setPanel(null);
    setLanePopover({
      kind,
      id,
      x: Math.min(rect.left, window.innerWidth - 300),
      y: Math.min(rect.bottom + 6, window.innerHeight - 300),
    });
  }

  // Klik på et skridt markerer det til redigering. Er man ved at forbinde,
  // bliver klikket i stedet pilens mål.
  function clickStep(stepId: string) {
    setLanePopover(null);
    if (connecting && focusStepId && focusStepId !== stepId) {
      const from = focusStepId;
      setConnecting(false);
      startDiagramTransition(() => addFlow(processId, sp.id, from, stepId));
      return;
    }
    setConnecting(false);
    setSelectedFlow(null);
    setFocusStepId(stepId);
  }

  function openDetails(stepId: string) {
    setFocusStepId(stepId);
    setPanel("detaljer");
  }

  const taskSteps = steps.filter((s) => !isStartOrEnd(s.stepType));

  return (
    <div className="relative flex h-full flex-col bg-(--color-raised)">
      {/* Topbjælke */}
      <div className="flex shrink-0 items-center gap-3 border-b border-(--color-line) bg-(--color-surface) px-6 py-3">
        <Link
          href={`/processes/${processId}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-(--color-line) text-(--color-muted) transition-colors hover:border-(--color-clay-line) hover:text-(--color-text)"
          title="Tilbage til processen"
        >
          ←
        </Link>
        <div className="min-w-0">
          <div className="eyebrow">{processName}</div>
          <div className="truncate text-[15px] font-semibold leading-tight">{sp.name}</div>
        </div>
        <Badge tone={statusTone}>{statusLabel}</Badge>
        <div className="ml-auto flex items-center gap-2">
          {/* Almindeligt link med download — ruten sender filen som vedhæftning */}
          <a
            href={`/api/export/visio/${sp.id}`}
            download
            title="Hent diagrammet som Visio-fil (.vsdx)"
            className="relative flex h-8 items-center rounded-md border border-(--color-line) px-2.5 text-[12px] text-(--color-muted) transition-colors hover:border-(--color-clay-line) hover:text-(--color-text)"
          >
            Eksportér til Visio
            <span className="absolute -right-1.5 -top-1.5 rounded-sm bg-(--color-clay) px-1 py-px text-[8.5px] font-semibold leading-none tracking-wide text-white">
              BETA
            </span>
          </a>
          <ToolbarButton active={panel === "ansvarlig"} onClick={() => setPanel((p) => (p === "ansvarlig" ? null : "ansvarlig"))}>
            Ansvarlig og status
          </ToolbarButton>
        </div>
      </div>

      {/* Diagram og systemer til venstre, chatten i sin egen kolonne til højre */}
      <div className="flex min-h-0 flex-1">
      <div className="relative min-w-0 flex-1">
      <div className="absolute inset-0 overflow-auto">
        <div className="px-6 py-6">
          {sp.summary && (
            <p className="mb-5 max-w-[68ch] text-[13.5px] leading-relaxed text-(--color-muted)">{sp.summary}</p>
          )}
          <div data-diagram-click>
            <DiagramEditBar
              processId={processId}
              subProcessId={sp.id}
              lanes={diagram.lanes.filter(
                (l) => !l.isDefault || diagram.steps.some((s) => s.laneId === l.id) || diagram.lanes.length === 1,
              )}
              steps={diagram.steps}
              flows={diagram.flows}
              selectedStepId={focusStepId}
              selectedFlow={selectedFlow}
              connecting={connecting}
              onSelectStep={(id) => {
                setSelectedFlow(null);
                setFocusStepId(id);
              }}
              onClear={clearSelection}
              onStartConnect={() => setConnecting(true)}
              onCancelConnect={() => setConnecting(false)}
              onOpenDetails={openDetails}
              placingNote={placingNote}
              onPlaceNote={(on) => {
                clearSelection();
                setPlacingNote(on);
              }}
              tools={
                <div ref={toolbarRef} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => openPopover("lane", "__new__", e.currentTarget.getBoundingClientRect())}
                    className="h-8 rounded-md border border-(--color-line) px-2.5 text-[12px] text-(--color-muted) transition-colors hover:border-(--color-clay-line) hover:text-(--color-text)"
                  >
                    + Svimlane
                  </button>
                  <button
                    type="button"
                    onClick={(e) => openPopover("pool", "__new__", e.currentTarget.getBoundingClientRect())}
                    className="h-8 rounded-md border border-(--color-line) px-2.5 text-[12px] text-(--color-muted) transition-colors hover:border-(--color-clay-line) hover:text-(--color-text)"
                  >
                    + Pool
                  </button>
                  <ToolbarButton
                    active={panel === "detaljer"}
                    onClick={() => setPanel((p) => (p === "detaljer" ? null : "detaljer"))}
                  >
                    Skridtdetaljer
                  </ToolbarButton>
                </div>
              }
            />
            <ZoomableDiagram>
              {(scale) => (
              <SwimlaneDiagram
                scale={scale}
                title={sp.name}
                pools={diagram.pools}
                lanes={diagram.lanes}
                steps={diagram.steps}
                flows={diagram.flows}
                focusStepId={focusStepId}
                selectedFlow={selectedFlow}
                connecting={connecting}
                onStepClick={clickStep}
                onFlowClick={(from, to) => {
                  setLanePopover(null);
                  setConnecting(false);
                  setFocusStepId(null);
                  setSelectedFlow({ from, to });
                }}
                onStepDrop={(stepId, laneId, position) => {
                  const lane = diagram.lanes.find((l) => l.id === laneId);
                  startDiagramTransition(() =>
                    moveStep(processId, sp.id, stepId, { laneId: lane?.isDefault ? null : laneId, position }),
                  );
                }}
                onLaneClick={(id, rect) => openPopover("lane", id, rect)}
                onPoolClick={(id, rect) => openPopover("pool", id, rect)}
                overlay={
                  <DiagramNotes
                    processId={processId}
                    subProcessId={sp.id}
                    notes={notes}
                    placing={placingNote}
                    scale={scale}
                    onPlaced={() => setPlacingNote(false)}
                  />
                }
              />
              )}
            </ZoomableDiagram>
          </div>

          <div className="mt-10">
            <ProcessAnalysis
              processId={processId}
              subProcessId={sp.id}
              findings={findings}
              steps={taskSteps.map((s) => ({ id: s.id, name: s.name || "Beslutning" }))}
            />
          </div>

          <h3 className="mb-1.5 mt-10 text-[18px] font-semibold tracking-tight">Systemer</h3>
          <p className="mb-5 max-w-[68ch] text-[12.5px] text-(--color-muted)">
            De systemer processen bruger, og hvilke integrationer systemet understøtter.
          </p>
          {systemCards.length === 0 ? (
            <p className="text-[12.5px] text-(--color-faint)">Ingen systemer koblet på skridtene endnu.</p>
          ) : (
            <div className="flex flex-wrap items-start gap-7">
              {systemCards.map((s) => (
                <SystemMapCard key={s.id} card={s} />
              ))}
            </div>
          )}
        </div>
      </div>

      {panel && (
        <div
          ref={drawerRef}
          className="absolute bottom-4 right-4 top-4 z-20 w-[340px] overflow-y-auto rounded-lg border border-(--color-line) bg-(--color-surface) p-4 shadow-[0_8px_28px_-8px_rgba(60,40,24,0.25)]"
        >
          {panel === "detaljer" ? (
            <>
              <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Skridtdetaljer</h2>
              <StepDetailsPanel
                processId={processId}
                subProcessId={sp.id}
                steps={taskSteps}
                roles={roles}
                systems={systems}
                dataObjects={dataObjects}
                focusStepId={focusStepId}
              />
            </>
          ) : (
            <>
              <h2 className="mb-3 text-[15px] font-semibold tracking-tight">Ansvarlig</h2>
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
              <div className="eyebrow mb-1.5 mt-5">Status</div>
              <StatusSelect processId={processId} subProcessId={sp.id} status={status} />
            </>
          )}
        </div>
      )}
      </div>

      <ProcessChat
        processId={processId}
        subProcessId={sp.id}
        messages={chat}
        hasSteps={taskSteps.length > 0}
        interviewActive={sp.interviewActive}
      />
      </div>

      {lanePopover && (
        <div
          ref={popoverRef}
          style={{ left: lanePopover.x, top: lanePopover.y }}
          className="fixed z-30 w-[280px] rounded-lg border border-(--color-line) bg-(--color-surface) p-3.5 shadow-[0_8px_28px_-8px_rgba(60,40,24,0.25)]"
        >
          {lanePopover.kind === "lane" ? (
            <LaneEditor
              processId={processId}
              subProcessId={sp.id}
              laneId={lanePopover.id}
              lanes={lanes}
              roles={roles}
              systems={systems}
              pools={diagram.pools}
              mainPoolName={sp.name}
              onDone={() => setLanePopover(null)}
            />
          ) : (
            <PoolEditor
              key={lanePopover.id}
              processId={processId}
              subProcessId={sp.id}
              poolId={lanePopover.id}
              pools={diagram.pools}
              roles={roles}
              systems={systems}
              onDone={() => setLanePopover(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-md border px-2.5 text-[12px] transition-colors ${
        active
          ? "border-(--color-clay-line) bg-(--color-clay-wash) text-(--color-clay)"
          : "border-(--color-line) text-(--color-muted) hover:border-(--color-clay-line) hover:text-(--color-text)"
      }`}
    >
      {children}
    </button>
  );
}

// Systemkortet fra procesmodellen: navn, type, integration — og en database
// med de data systemet ejer i denne proces.
function SystemMapCard({ card }: { card: SystemCard }) {
  const open = <span className="italic text-(--color-faint)">Ikke afklaret</span>;
  return (
    <div className="flex w-[180px] flex-col items-center">
      <div className="w-full overflow-hidden rounded-lg border-2 border-(--color-text) bg-(--color-surface) text-center text-[13.5px] leading-snug text-(--color-text)">
        <div className="px-2 py-2.5 font-bold">{card.name}</div>
        <div className="border-t-[1.5px] border-(--color-text) bg-(--color-raised) px-2 py-2.5">{card.type ?? open}</div>
        <div className="border-t-[1.5px] border-(--color-text) bg-(--color-clay-wash) px-2 py-2.5">
          {card.integration ?? open}
        </div>
      </div>
      {card.data.length > 0 && (
        <>
          <div className="relative mt-2.5 h-11 w-0.5 bg-(--color-text)">
            <span className="absolute -top-[9px] left-1/2 -translate-x-1/2 border-x-[6px] border-b-[10px] border-x-transparent border-b-(--color-text)" />
          </div>
          <div className="relative flex h-[92px] w-[150px] items-center justify-center px-3 pb-1.5 pt-[18px]">
            <svg viewBox="0 0 150 92" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full overflow-visible">
              <path
                d="M1 12 V80 A74 11 0 0 0 149 80 V12"
                fill="var(--color-surface)"
                stroke="var(--color-text)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
              <ellipse
                cx="75"
                cy="12"
                rx="74"
                ry="11"
                fill="var(--color-surface)"
                stroke="var(--color-text)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span className="relative text-center text-[12.5px] leading-tight text-(--color-text)">
              {card.data.join(", ")}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function StatusSelect({
  processId,
  subProcessId,
  status,
}: {
  processId: string;
  subProcessId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(() => setSubProcessStatus(processId, subProcessId, next));
      }}
      className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] focus:border-(--color-clay-line) focus:outline-none disabled:opacity-50"
    >
      {Object.entries(SUBPROCESS_STATUS).map(([key, s]) => (
        <option key={key} value={key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { BpmnViewer, type BpmnEditorHandle, type ElementClickInfo } from "./BpmnViewer";
import { InterviewPanel } from "./InterviewPanel";
import { InsightsPanel } from "./InsightsPanel";
import { ExpertsPanel } from "./ExpertsPanel";
import { ValidationPanel } from "./ValidationPanel";
import { TriggersPanel } from "./TriggersPanel";
import { AssigneeSelect } from "./AssigneeSelect";
import { StepDetailsPanel } from "./StepDetailsPanel";
import { LaneEditor } from "./LaneEditor";
import { Badge, ClayButton, Empty, type Tone } from "./ui";
import {
  generateStepsFromInterviewAction,
  saveDiagram,
} from "@/app/(customer)/processes/[processId]/[subId]/actions";

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
type LaneOption = {
  id: string;
  isDefault: boolean;
  actorRoleId: string | null;
  actorSystemId: string | null;
  actorName: string | null;
};

const DOCK_ITEMS = [
  { key: "ansvarlig", label: "Ansvarlig" },
  { key: "haendelser", label: "Start/slut" },
  { key: "detaljer", label: "Skridtdetaljer" },
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
    case "detaljer":
      return (
        <svg {...common}>
          <circle cx="9" cy="7" r="3" />
          <path d="M4 20a5 5 0 0 1 10 0" />
          <path d="M15.5 4.5h4M15.5 8.5h4M15.5 12.5h2.5" />
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
  canGenerateFromInterview,
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
  roles,
  systems,
  dataObjects,
  steps,
  lanes,
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
  canGenerateFromInterview: boolean;
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
  roles: RoleOption[];
  systems: SystemOption[];
  dataObjects: DataObjectOption[];
  steps: StepOption[];
  lanes: LaneOption[];
}) {
  const [panel, setPanel] = useState<DockKey | null>(null);
  const [focusStepId, setFocusStepId] = useState<string | null>(null);
  // Svimlaner redigeres ALDRIG i den faste højre-sidebjælke (samme boks som
  // Skridtdetaljer m.v.) — kun i en lille flydende boks lige ved den
  // svimlane man klikkede/bad om at tilføje, jf. brugerens eksplicitte krav.
  const [lanePopover, setLanePopover] = useState<{ laneId: string; x: number; y: number } | null>(null);

  // Finder svimlanens egen skærm-position i det levende bpmn-js-lærred, så
  // boksen dukker op lige ved siden af den — ikke et fast sted langt væk.
  function popoverNear(laneId: string): { laneId: string; x: number; y: number } {
    const el = document.querySelector(`[data-element-id="Lane_${laneId}"]`);
    const rect = el?.getBoundingClientRect();
    const x = Math.min((rect?.right ?? 200) + 8, window.innerWidth - 300);
    const y = Math.max(Math.min(rect?.top ?? 120, window.innerHeight - 220), 72);
    return { laneId, x, y };
  }

  function handleElementClick(info: ElementClickInfo) {
    if (info.kind === "lane") {
      setPanel(null);
      setLanePopover(popoverNear(info.laneId));
      return;
    }
    setLanePopover(null);
    if (info.kind === "unsaved") {
      // Et hånd-tegnet skridt uden gemt id endnu — gem diagrammet først (det
      // giver det et rigtigt ProcessStep-id), åbn så Skridtdetaljer, som nu
      // vil vise det i listen.
      handleSave();
      setPanel("detaljer");
      setFocusStepId(null);
      return;
    }
    setPanel("detaljer");
    setFocusStepId(info.stepId);
  }

  function handleAddLaneRequested(nearLaneId: string) {
    setPanel(null);
    // Positionen beregnes ud fra den svimlane "+"-ikonet sad på, men boksen
    // selv åbner i opret-tilstand ("__new__"), ikke redigér-tilstand for den.
    setLanePopover({ ...popoverNear(nearLaneId), laneId: "__new__" });
  }

  // Samme opret-boks som bpmn-js's egne "+"-ikoner ved en svimlane
  // (handleAddLaneRequested), men fra en synlig knap i topbjælken — så det
  // ikke kun kan opdages ved først at klikke en svimlane og lede efter et
  // lille ikon i dens context pad.
  function handleAddLaneButtonClick() {
    setPanel(null);
    const rect = addLaneButtonRef.current?.getBoundingClientRect();
    const x = Math.min((rect?.left ?? 200), window.innerWidth - 300);
    const y = Math.max(Math.min((rect?.bottom ?? 120) + 8, window.innerHeight - 220), 72);
    setLanePopover({ laneId: "__new__", x, y });
  }

  const drawerRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const lanePopoverRef = useRef<HTMLDivElement>(null);
  const addLaneButtonRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<BpmnEditorHandle>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [generating, startGenerateTransition] = useTransition();
  const [generateError, setGenerateError] = useState<string | null>(null);

  const router = useRouter();

  // Hånd-tegnede figurer har kun bpmn-js's eget midlertidige id, indtil
  // lærredet næste gang genindlæses med den XML gemningen selv udløste (der
  // matcher dem til deres nye ProcessStep-id via nid(), se lib/bpmn.ts) — men
  // klikker man Gem igen FØR den genindlæsning er nået frem, ser den samme
  // figur stadig ud som "ny" og oprettes en gang til. router.refresh()
  // ventes derfor eksplicit igennem her, så knappen ikke kan trykkes igen
  // (den er disabled mens pending er true) før tegningen faktisk er i sync.
  function handleSave() {
    const nodes = editorRef.current?.getOrderedNodes();
    if (!nodes) return;
    startTransition(async () => {
      await saveDiagram(processId, subProcessId, nodes);
      router.refresh();
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function handleGenerateFromInterview() {
    setGenerateError(null);
    startGenerateTransition(async () => {
      try {
        await generateStepsFromInterviewAction(processId, subProcessId);
      } catch (e) {
        setGenerateError(e instanceof Error ? e.message : "Kunne ikke generere kortlægningen.");
      }
    });
  }

  // Luk panelet med Escape eller ved klik udenfor — det skal føles som et
  // overlay, ikke en fast del af siden. Svimlane-popoveren lukkes på samme
  // måde, men er sin egen boks (lanePopoverRef), uafhængig af drawerRef.
  useEffect(() => {
    if (!panel && !lanePopover) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPanel(null);
        setLanePopover(null);
      }
    }
    function onClick(e: MouseEvent) {
      const target = e.target as Node;
      if (drawerRef.current?.contains(target) || dockRef.current?.contains(target)) return;
      if (lanePopoverRef.current?.contains(target)) return;
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

  const validationTone: Tone | null =
    validations.length === 0
      ? null
      : validations.every((v) => v.verdict === "APPROVED")
        ? "ok"
        : "warn";

  const badgeFor: Record<DockKey, number | null> = {
    ansvarlig: null,
    haendelser: startEvents.length + endEvents.length || null,
    detaljer: steps.filter((s) => s.actorRoleId).length || null,
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
        {bpmnXml && (
          <button
            ref={addLaneButtonRef}
            type="button"
            onClick={handleAddLaneButtonClick}
            title="Tilføj en ny svimlane"
            className="flex items-center gap-1.5 rounded-md border border-(--color-line) bg-(--color-surface) px-3 py-2 text-[12px] text-(--color-muted) shadow-sm transition-colors hover:border-(--color-clay-line) hover:text-(--color-text)"
          >
            + Svimlane
          </button>
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
            onElementClick={handleElementClick}
            onAddLaneRequested={handleAddLaneRequested}
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

      {/*
        Broen mellem interviewet og lærredet: så snart interviewet har givet
        transskription men ingen skridt er tegnet endnu, tilbyder vi at lade
        agenten udlede dem selv i stedet for at underprocesejeren skal tegne
        alt fra bunden af hukommelsen. Forsvinder for evigt så snart der er
        ét skridt — den må aldrig kunne overskrive noget der er tegnet i hånden.
      */}
      {canGenerateFromInterview && (
        <div className="pointer-events-none absolute inset-0 top-16 z-10 flex items-start justify-center pt-10">
          <div className="pointer-events-auto max-w-sm rounded-lg border border-(--color-clay-line) bg-(--color-surface) p-4 text-center shadow-md">
            <div className="text-[13px] font-medium text-(--color-text)">
              Interviewet er klar til at blive kortlagt
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-(--color-muted)">
              Lad agenten udlede skridtene fra transskriptionen i stedet for at
              tegne dem fra bunden.
            </p>
            {generateError && (
              <p className="mt-2 text-[11.5px] text-(--color-alert)">{generateError}</p>
            )}
            <ClayButton
              onClick={handleGenerateFromInterview}
              disabled={generating}
              className="mt-3 !py-2 !text-[12.5px]"
            >
              {generating ? "Genererer…" : "Generér kortlægning fra interview"}
            </ClayButton>
          </div>
        </div>
      )}

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
              onClick={() => {
                setLanePopover(null);
                setPanel((p) => (p === d.key ? null : d.key));
              }}
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

      {/* Panelet der glider ind fra højre med dock-indholdet — svimlaner er
          ALDRIG herinde, kun Skridtdetaljer og de andre faste funktioner. */}
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
            roles={roles}
            systems={systems}
            dataObjects={dataObjects}
            steps={steps}
            focusStepId={focusStepId}
          />
        </div>
      )}

      {/* Svimlane-editoren — en lille flydende boks tæt på den svimlane man
          klikkede (eller bad om at tilføje en ny ud fra), ALDRIG i den faste
          sidebjælke ovenfor. Åbnes ved klik på en svimlanes header i lærredet
          eller ved klik på bpmn-js's egne "+"-ikoner ved en valgt svimlane
          (se onAddLaneRequested/BpmnViewer). */}
      {lanePopover && (
        <div
          ref={lanePopoverRef}
          style={{ left: lanePopover.x, top: lanePopover.y }}
          className="absolute z-20 w-[280px] rounded-lg border border-(--color-line) bg-(--color-surface) p-3.5 shadow-lg"
        >
          <LaneEditor
            processId={processId}
            subProcessId={sp.id}
            laneId={lanePopover.laneId}
            lanes={lanes}
            roles={roles}
            systems={systems}
            onDone={() => setLanePopover(null)}
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
  roles,
  systems,
  dataObjects,
  steps,
  focusStepId,
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
  roles: RoleOption[];
  systems: SystemOption[];
  dataObjects: DataObjectOption[];
  steps: StepOption[];
  focusStepId: string | null;
}): ReactNode {
  switch (panel) {
    case "detaljer":
      return (
        <div>
          <DrawerHeader label="Skridtdetaljer" />
          <StepDetailsPanel
            processId={processId}
            subProcessId={sp.id}
            steps={steps}
            roles={roles}
            systems={systems}
            dataObjects={dataObjects}
            focusStepId={focusStepId}
          />
        </div>
      );
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
      return (
        <InsightsPanel
          processId={processId}
          subProcessId={sp.id}
          notes={notes}
          logs={improvementLogs}
        />
      );
  }
}

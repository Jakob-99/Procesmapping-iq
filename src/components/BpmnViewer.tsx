"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
import "bpmn-js/dist/assets/bpmn-js.css";

type CanvasModule = { zoom: (a: string | number, b?: string) => void };
type BusinessObject = { id: string; name?: string; $type: string; flowNodeRef?: { id: string }[] };
type BpmnElement = {
  id: string;
  type: string;
  businessObject: BusinessObject;
  outgoing?: { id: string; target: BpmnElement }[];
};
type PositionedElement = BpmnElement & { y: number };
type ElementRegistry = {
  getAll: () => PositionedElement[];
  get: (id: string) => PositionedElement | undefined;
};
type ModelerInstance = {
  destroy: () => void;
  importXML: (xml: string) => Promise<unknown>;
  get: (module: string) => unknown;
};

export type DiagramNode = {
  id: string;
  name: string;
  type: "task" | "gateway";
  manual: boolean;
  // Samme "Lane_<ProcessLane.id>"-præfiks-strip som classifyClick — null når
  // figuren (usandsynligt, men muligt for en hånd-tegnet figur uden for
  // enhver lane-boks) ikke sidder i nogen kendt svimlane, så serveren ved at
  // lade dens aktør være urørt i stedet for fejlagtigt at nulstille den.
  laneId: string | null;
};

// Diagram-js's element.parent er IKKE til at stole på her — figurer der kom
// ind via importXML (dvs. alt der ikke lige er trukket i denne session) får
// "Process_1" som forælder uanset hvilken svimlane de reelt sidder i, selvom
// XML'en tydeligt lister dem i deres Lanes flowNodeRef (afprøvet direkte i
// bpmn-js). Den lane et skridt FAKTISK sidder i — både ved almindelig
// visning og efter et træk hen over en svimlanegrænse — er derfor kun
// pålidelig via Lane.businessObject.flowNodeRef, den samme liste bpmn-js's
// egen UpdateFlowNodeRefsBehavior holder opdateret ved et træk.
function buildLaneOfNodeId(elementRegistry: ElementRegistry): Map<string, string> {
  const laneOfNodeId = new Map<string, string>();
  for (const el of elementRegistry.getAll()) {
    if (el.businessObject?.$type !== "bpmn:Lane") continue;
    const laneId = el.id.replace(/^Lane_/, "");
    for (const ref of el.businessObject.flowNodeRef ?? []) {
      laneOfNodeId.set(ref.id, laneId);
    }
  }
  return laneOfNodeId;
}

export type BpmnEditorHandle = {
  getOrderedNodes: () => DiagramNode[];
};

export type ElementClickInfo =
  | { kind: "task" | "ctxIn" | "ctxOut" | "system"; stepId: string }
  | { kind: "lane"; laneId: string }
  // Et aktivitets-/gateway-ikon brugeren lige har tegnet selv, som endnu ikke
  // er gemt og derfor ikke har et rigtigt ProcessStep-id (bpmn-js's egen
  // auto-id starter med "Activity_"/"Gateway_", ikke vores "Task_"/"Gateway_
  // <rigtigt id>") — se FLOW_TYPES-tjekket i eventBus-lytteren nedenfor.
  | { kind: "unsaved" };

// Start og slut styres altid af underprocessens egne felter, og svimlanens
// navn styres altid af skridtenes actorRoleId/actorSystemId (se setStepActor)
// — ingen af dem kan slettes eller omdøbes direkte i tegningen, uanset hvad
// brugeren prøver (bpmn-js's indbyggede dobbeltklik-til-at-omdøbe ville ellers
// lade en skrive en fri tekst ind som aldrig gemmes nogen steder — precis det
// der skal undgås, aktøren vælges kun via Skridtdetaljer-panelet). Der kan
// være flere af start/slut ("StartEvent_0", "StartEvent_1", ...), én pr.
// hændelse.
const isLockedId = (id: string) =>
  id.startsWith("StartEvent_") || id.startsWith("EndEvent_") || id.startsWith("Lane_");

const CLICK_KIND: Record<string, ElementClickInfo["kind"]> = {
  Task: "task",
  CtxIn: "ctxIn",
  CtxOut: "ctxOut",
  Sys: "system",
};

// Genkender klik på et skridt eller en af dets tilknyttede bokse (kontekst
// eller systemer) og finder tilbage til det rigtige ProcessStep-id — samme
// præfiks-strip som stepIdFromNodeId på serveren (se
// processes/[processId]/[subId]/actions.ts), da id'et er sat med samme nid()
// (lib/bpmn.ts). Labels er et separat diagram-js-element med samme
// id-præfiks/navn som deres mål og skal ALDRIG matches her (se
// bpmn-canvas-editor-memoryens faldgrube #1) — ellers "åbner" et klik på selve
// teksten under et ikon panelet lige så vel som et klik på ikonet.
//
// En svimlane (Lane_<ProcessLane.id>, se lib/bpmn.ts) matcher samme mønster
// — ProcessLane-id'er er cuid'er (kun bogstaver/tal), så nid()'s
// tegn-oprensning er et no-op og laneId'et ruller tilbage 1:1, uden tab.
function classifyClick(el: {
  id: string;
  type?: string;
  labelTarget?: unknown;
}): ElementClickInfo | null {
  if (el.type === "label" || el.labelTarget || el.id.endsWith("_label")) return null;
  const m = el.id.match(/^(Task|CtxIn|CtxOut|Sys)_(.+)$/);
  if (m) return { stepId: m[2], kind: CLICK_KIND[m[1]] } as ElementClickInfo;
  const laneMatch = el.id.match(/^Lane_(.+)$/);
  if (laneMatch) return { kind: "lane", laneId: laneMatch[1] };
  return null;
}

const FLOW_TYPES = new Set([
  "bpmn:Task",
  "bpmn:ManualTask",
  "bpmn:ServiceTask",
  "bpmn:ExclusiveGateway",
]);

function toDiagramNode(el: BpmnElement, laneOfNodeId: Map<string, string>): DiagramNode {
  const isGateway = el.businessObject.$type === "bpmn:ExclusiveGateway";
  return {
    id: el.id,
    name: el.businessObject.name ?? "",
    type: isGateway ? "gateway" : "task",
    manual: el.businessObject.$type === "bpmn:ManualTask",
    laneId: laneOfNodeId.get(el.businessObject.id) ?? null,
  };
}

// Følger pilene fra start til slut. Sletter man en figur midt i kæden uden at
// tegne en ny pil forbi den, falder resten af skridtene ud af rækkefølgen —
// de samles så op bagefter, sorteret efter deres lodrette placering, i stedet
// for stiltiende at forsvinde.
function walkOrderedNodes(elementRegistry: ElementRegistry): DiagramNode[] {
  const nodes: DiagramNode[] = [];
  const all = elementRegistry.getAll();
  const laneOfNodeId = buildLaneOfNodeId(elementRegistry);
  const visited = new Set<string>(all.filter((el) => isLockedId(el.id)).map((el) => el.id));
  let current = all.find((el) => el.businessObject.$type === "bpmn:StartEvent");

  while (current) {
    const next: BpmnElement | undefined = current.outgoing?.[0]?.target;
    if (!next || visited.has(next.id) || next.businessObject.$type === "bpmn:EndEvent") break;
    visited.add(next.id);
    nodes.push(toDiagramNode(next, laneOfNodeId));
    current = next;
  }

  const stray = elementRegistry
    .getAll()
    .filter((el) => FLOW_TYPES.has(el.businessObject.$type) && !visited.has(el.id))
    .sort((a, b) => a.y - b.y);

  for (const el of stray) nodes.push(toDiagramNode(el, laneOfNodeId));

  return nodes;
}

/*
  bpmn-js indlæses først i browseren — biblioteket rører document ved import,
  så det kan ikke server-renderes. I redigerbar tilstand bruges den fulde
  Modeler (palet + kontekstpanel), så man selv kan slette og tegne nye figurer
  og pile — ikke kun se dem.
*/
export const BpmnViewer = forwardRef<BpmnEditorHandle, {
  xml: string;
  className?: string;
  bare?: boolean;
  editable?: boolean;
  onDirty?: () => void;
  onElementClick?: (info: ElementClickInfo) => void;
  // Bruges af "+"-ikonerne bpmn-js selv tegner ved en svimlane (context pad,
  // se overridet nedenfor) — kaldes med den svimlane konteksten blev åbnet
  // fra, så overfladen kan placere sin egen (ikke-sidebjælke) svimlane-editor
  // tæt på den samme svimlane.
  onAddLaneRequested?: (nearLaneId: string) => void;
}>(function BpmnViewer(
  {
    xml,
    className = "h-[380px]",
    bare = false,
    editable = false,
    onDirty,
    onElementClick,
    onAddLaneRequested,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<ModelerInstance | null>(null);
  const canvasRef = useRef<CanvasModule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useImperativeHandle(ref, () => ({
    getOrderedNodes: () => {
      const registry = instanceRef.current?.get("elementRegistry") as
        | ElementRegistry
        | undefined;
      return registry ? walkOrderedNodes(registry) : [];
    },
  }));

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    setLoading(true);

    (async () => {
      try {
        const mod = editable
          ? await import("bpmn-js/lib/Modeler")
          : await import("bpmn-js/lib/NavigatedViewer");
        if (cancelled || !hostRef.current) return;

        const { ctxIconModule } = await import("@/lib/bpmnCustomRenderer");
        const Ctor = mod.default;
        const v = new Ctor({
          container: hostRef.current,
          additionalModules: [ctxIconModule],
        }) as unknown as ModelerInstance;
        instanceRef.current = v;

        await v.importXML(xml);
        const canvas = v.get("canvas") as CanvasModule;
        canvasRef.current = canvas;

        // Ved opstart har værtsdivens layout (padding til den flydende
        // topbjælke m.m.) ikke nødvendigvis sat sig endnu — fit-viewport for
        // tidligt regner forkert og klipper toppen af tegningen af.
        requestAnimationFrame(() => {
          if (!cancelled) canvas.zoom("fit-viewport", "auto");
        });

        if (editable) {
          const eventBus = v.get("eventBus") as {
            on: (event: string, priority: number, cb: (e: { element?: { id: string } }) => unknown) => void;
          };
          eventBus.on("commandStack.shape.delete.canExecute", 2000, (e) => {
            const id = (e as unknown as { context: { shape: { id: string } } }).context?.shape?.id;
            if (id && isLockedId(id)) return false;
          });
          eventBus.on("element.dblclick", 2000, (e) => {
            if (e.element && isLockedId(e.element.id)) return false;
          });
          eventBus.on("commandStack.changed", 1000, () => onDirty?.());
          eventBus.on("element.click", 1000, (e) => {
            const el = e.element as
              | { id: string; type?: string; labelTarget?: unknown; businessObject?: { $type?: string } }
              | undefined;
            if (!el) return;
            const info = classifyClick(el);
            if (info) return onElementClick?.(info);
            // Et hånd-tegnet aktivitets-/gateway-ikon uden et rigtigt
            // ProcessStep-id endnu (se ElementClickInfo["unsaved"]) — skal
            // stadig åbne Skridtdetaljer, ikke gøre ingenting.
            if (el.type === "label" || el.labelTarget || el.id.endsWith("_label")) return;
            if (el.businessObject?.$type && FLOW_TYPES.has(el.businessObject.$type)) {
              onElementClick?.({ kind: "unsaved" });
            }
          });

          // bpmn-js's egne "+"-ikoner ved en valgt svimlane (Add lane above/
          // below) redigerer strukturen direkte i det levende bpmn-js-diagram
          // — men vores tegning er aldrig et dokument, den regenereres fra
          // ProcessLane/ProcessStep hver gang (se lib/bpmn.ts), så en sådan
          // strukturel ændring ville bare forsvinde ved næste re-render uden
          // nogensinde at være gemt. "Divide into lanes" giver slet ingen
          // mening (deler én lane i flere uden nogen aktør-tilknytning).
          // Erstat dem i stedet med vores egen "opret svimlane"-handling —
          // samme ikoner, samme placering (brugeren beder om "+ ved poolen"),
          // men koblet til den rigtige datamodel. Lavere prioritet (500) end
          // standard-context-pad'ets default — den behandles sidst i
          // reduce'en og kan derfor overskrive/slette entries den allerede
          // har sat (samme mønster som CtxPaletteProvider i
          // bpmnCustomRenderer.ts).
          const contextPad = v.get("contextPad") as {
            registerProvider: (priority: number, provider: unknown) => void;
          };
          contextPad.registerProvider(500, {
            getContextPadEntries(element: { id: string; businessObject?: { $type?: string } }) {
              return (entries: Record<string, { action?: unknown } | undefined>) => {
                if (element.businessObject?.$type !== "bpmn:Lane") return entries;
                delete entries["lane-divide-two"];
                delete entries["lane-divide-three"];
                // Papirkurven ville alligevel altid blive blokeret af
                // commandStack.shape.delete.canExecute (isLockedId ovenfor) —
                // svimlaner slettes kun via sidebjælken, aldrig direkte i
                // tegningen. Vis den ikke, den ville bare være et ikon der
                // ser ud som en handling men aldrig gør noget.
                delete entries["delete"];
                // Samme "Lane_<ProcessLane.id>"-præfiks-strip som classifyClick.
                const laneId = element.id.replace(/^Lane_/, "");
                const addLane = { click: () => onAddLaneRequested?.(laneId) };
                if (entries["lane-insert-above"]) {
                  entries["lane-insert-above"] = { ...entries["lane-insert-above"], action: addLane };
                }
                if (entries["lane-insert-below"]) {
                  entries["lane-insert-below"] = { ...entries["lane-insert-below"], action: addLane };
                }
                return entries;
              };
            },
          });
        }

        // bpmn-js cacher sin egen viewport-størrelse ved opstart — hvis
        // værtsdivens størrelse ændrer sig bagefter (vinduet resizes, sidepanel
        // åbnes), skal den fortælles det eksplicit for ikke at tegne i tomrum.
        if (hostRef.current) {
          resizeObserver = new ResizeObserver(() => {
            (canvas as unknown as { resized: () => void }).resized();
            canvas.zoom("fit-viewport", "auto");
          });
          resizeObserver.observe(hostRef.current);
        }

        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      canvasRef.current = null;
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xml, editable]);

  if (error) {
    return (
      <div className="py-6 text-[13px] text-(--color-alert)">
        Diagrammet kunne ikke tegnes: {error}
      </div>
    );
  }

  const zoomBy = (factor: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const current = (canvas as unknown as { zoom: () => number }).zoom();
    canvas.zoom((current || 1) * factor);
  };

  const zoomControls = (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col overflow-hidden rounded-md border border-(--color-line) bg-(--color-surface) shadow-sm">
      <button
        title="Zoom ind"
        onClick={() => zoomBy(1.2)}
        className="flex h-8 w-8 items-center justify-center text-(--color-muted) transition-colors hover:bg-(--color-sunken) hover:text-(--color-text)"
      >
        +
      </button>
      <div className="h-px bg-(--color-line)" />
      <button
        title="Zoom ud"
        onClick={() => zoomBy(1 / 1.2)}
        className="flex h-8 w-8 items-center justify-center text-(--color-muted) transition-colors hover:bg-(--color-sunken) hover:text-(--color-text)"
      >
        −
      </button>
      <div className="h-px bg-(--color-line)" />
      <button
        title="Tilpas til skærm"
        onClick={() => canvasRef.current?.zoom("fit-viewport", "auto")}
        className="flex h-8 w-8 items-center justify-center text-[10px] font-medium text-(--color-muted) transition-colors hover:bg-(--color-sunken) hover:text-(--color-text)"
      >
        ⤢
      </button>
    </div>
  );

  const spinner = loading && (
    <div className="absolute inset-0 z-10 flex items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-(--color-line) border-t-(--color-clay)" />
    </div>
  );

  if (bare) {
    return (
      <div className={`relative w-full ${className} ${editable ? "bpmn-editable" : ""}`}>
        {spinner}
        <div className="bpmn-host h-full w-full" ref={hostRef} />
        {!loading && zoomControls}
        {!editable && (
          <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[11px] text-(--color-faint) shadow-sm">
            Træk for at panorere · scroll for at zoome
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden border-y border-(--color-line)">
      <div className={`relative w-full bg-(--color-raised) ${className}`}>
        {spinner}
        <div className="bpmn-host h-full w-full" ref={hostRef} />
      </div>
      <div className="border-t border-(--color-line) px-1 py-2 text-[11px] text-(--color-faint)">
        BPMN 2.0 · genereret ud fra de kortlagte skridt · træk for at panorere,
        scroll for at zoome
      </div>
    </div>
  );
});

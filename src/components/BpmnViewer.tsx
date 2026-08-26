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
type BusinessObject = { name?: string; $type: string };
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
};

export type BpmnEditorHandle = {
  getOrderedNodes: () => DiagramNode[];
};

// Start og slut styres altid af underprocessens egne felter — de kan ikke
// slettes eller omdøbes i tegningen, uanset hvad brugeren prøver. Der kan
// være flere af hver ("StartEvent_0", "StartEvent_1", ...), én pr. hændelse.
const isLockedId = (id: string) => id.startsWith("StartEvent_") || id.startsWith("EndEvent_");

const FLOW_TYPES = new Set([
  "bpmn:Task",
  "bpmn:ManualTask",
  "bpmn:ServiceTask",
  "bpmn:ExclusiveGateway",
]);

function toDiagramNode(el: BpmnElement): DiagramNode {
  const isGateway = el.businessObject.$type === "bpmn:ExclusiveGateway";
  return {
    id: el.id,
    name: el.businessObject.name ?? "",
    type: isGateway ? "gateway" : "task",
    manual: el.businessObject.$type === "bpmn:ManualTask",
  };
}

// Følger pilene fra start til slut. Sletter man en figur midt i kæden uden at
// tegne en ny pil forbi den, falder resten af skridtene ud af rækkefølgen —
// de samles så op bagefter, sorteret efter deres lodrette placering, i stedet
// for stiltiende at forsvinde.
function walkOrderedNodes(elementRegistry: ElementRegistry): DiagramNode[] {
  const nodes: DiagramNode[] = [];
  const all = elementRegistry.getAll();
  const visited = new Set<string>(all.filter((el) => isLockedId(el.id)).map((el) => el.id));
  let current = all.find((el) => el.businessObject.$type === "bpmn:StartEvent");

  while (current) {
    const next: BpmnElement | undefined = current.outgoing?.[0]?.target;
    if (!next || visited.has(next.id) || next.businessObject.$type === "bpmn:EndEvent") break;
    visited.add(next.id);
    nodes.push(toDiagramNode(next));
    current = next;
  }

  const stray = elementRegistry
    .getAll()
    .filter((el) => FLOW_TYPES.has(el.businessObject.$type) && !visited.has(el.id))
    .sort((a, b) => a.y - b.y);

  for (const el of stray) nodes.push(toDiagramNode(el));

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
}>(function BpmnViewer({ xml, className = "h-[380px]", bare = false, editable = false, onDirty }, ref) {
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

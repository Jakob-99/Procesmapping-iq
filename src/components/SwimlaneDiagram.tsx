"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isGateway } from "@/lib/domain";
import { docsLifted, layoutGrid, sharedDocs } from "@/lib/swimlane-layout";

/*
  Svimlane-diagrammet — samme notation som Cornerstones' procesmodel
  (Cornerstones Procesmodel.html): én pool med titel, lodrette svimlaner pr.
  aktør, forløbet løber nedad med ét skridt pr. række. Aktiviteter er
  afrundede bokse med [systemer] under teksten, data er dokument-ikoner ved
  siden af med stiplede pile ind/ud, beslutninger er X-gateways med
  etiketter på pilene, timere er dobbeltcirkler med et ur, start er en tynd
  cirkel og slut en tyk.

  Figurerne er almindelig DOM i et CSS-grid; pilene tegnes bagefter i ét
  SVG-lag ud fra de målte positioner (samme fremgangsmåde som HTML-filen),
  og tegnes om ved resize.
*/

export type DiagramLane = { id: string; name: string; isDefault: boolean; poolId: string | null };
// poolId null = hovedpoolen, hvis titel er underprocessens navn.
export type DiagramPool = { id: string; name: string };
export type DiagramStep = {
  id: string;
  type: string; // se STEP_TYPES i lib/domain.ts
  name: string;
  laneId: string;
  systems: string[];
  data: { name: string; dir: "in" | "out" }[];
};
export type DiagramFlow = { from: string; to: string; label: string | null; kind: string };

const ROW_H = 112;

type Rect = { l: number; r: number; t: number; b: number; cx: number; cy: number };
type Path = { d: string; kind: "seq" | "msg" | "data"; from?: string; to?: string };
type Label = { text: string; x: number; y: number };

/*
  Hvor en pils tekst skal stå: midt på det sidste stykke af pilen (det der
  er grenens eget), hvis det er langt nok til teksten — ellers midt på det
  længste stykke. Teksten tegnes med hvid baggrund oven på linjen, så
  linjen er brudt bag den, som i BPMN.
*/
function labelPoint(pts: number[][]): { x: number; y: number } {
  const segs = pts.slice(1).map((p, i) => {
    const q = pts[i];
    return { x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2, len: Math.hypot(p[0] - q[0], p[1] - q[1]) };
  });
  if (!segs.length) return { x: pts[0][0], y: pts[0][1] };
  const last = segs[segs.length - 1];
  const best = last.len >= 28 ? last : segs.reduce((m, s) => (s.len > m.len ? s : m), segs[0]);
  return { x: best.x, y: best.y };
}

function DocIcon() {
  return (
    <svg viewBox="0 0 80 48" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full">
      <path
        d="M1 1 H64 L79 16 V47 H1 Z"
        fill="var(--color-clay-wash)"
        stroke="var(--color-text)"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
      <path d="M64 1 V16 H79" fill="none" stroke="var(--color-text)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Symbolet inde i gateway-ruden, som i BPMN: X eksklusiv, + parallel,
// O inklusiv, og femkant i dobbeltcirkel for hændelsesbaseret.
function GatewayMarker({ type }: { type: string }) {
  const s = { fill: "none", stroke: "var(--color-text)", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 42 42" aria-hidden className="absolute inset-0 h-full w-full">
      {type === "DECISION" && (
        <path d="M15 15 L27 27 M27 15 L15 27" {...s} strokeWidth="2.6" />
      )}
      {type === "PARALLEL" && <path d="M21 13 V29 M13 21 H29" {...s} strokeWidth="2.6" />}
      {type === "INCLUSIVE" && <circle cx="21" cy="21" r="7.5" {...s} strokeWidth="2.4" />}
      {type === "EVENT_GATEWAY" && (
        <>
          <circle cx="21" cy="21" r="9.5" {...s} strokeWidth="1.1" />
          <circle cx="21" cy="21" r="7.8" {...s} strokeWidth="1.1" />
          <path d="M21 16.2 L25.6 19.5 L23.8 24.9 H18.2 L16.4 19.5 Z" {...s} strokeWidth="1.2" />
        </>
      )}
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="h-[18px] w-[18px]">
      <circle cx="9" cy="9" r="7" fill="none" stroke="var(--color-text)" strokeWidth="1.3" />
      <path d="M9 4.5 V9 L12 10.5" fill="none" stroke="var(--color-text)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function SwimlaneDiagram({
  title,
  pools = [],
  lanes,
  steps,
  flows,
  focusStepId,
  selectedFlow,
  connecting,
  onStepClick,
  onLaneClick,
  onPoolClick,
  onFlowClick,
  onStepDrop,
  overlay,
  scale = 1,
}: {
  title: string;
  pools?: DiagramPool[];
  lanes: DiagramLane[];
  steps: DiagramStep[];
  flows: DiagramFlow[];
  focusStepId?: string | null;
  selectedFlow?: { from: string; to: string } | null;
  // Mens man vælger målet for en ny pil, markeres alle skridt som mulige mål.
  connecting?: boolean;
  onStepClick?: (stepId: string) => void;
  onLaneClick?: (laneId: string, rect: DOMRect) => void;
  onPoolClick?: (poolId: string, rect: DOMRect) => void;
  onFlowClick?: (from: string, to: string) => void;
  // Et skridt trukket hen i en svimlane: ny svimlane og den plads i
  // rækkefølgen det skal have (indeks i listen uden skridtet selv).
  onStepDrop?: (stepId: string, laneId: string, position: number) => void;
  // Lag oven på tegningen i samme koordinatsystem — bruges til noter.
  overlay?: ReactNode;
  // Zoom-faktoren fra ZoomableDiagram. Skærmmål (getBoundingClientRect)
  // divideres med den, så pile og træk regnes i diagrammets egne koordinater.
  scale?: number;
}) {
  const [dragOver, setDragOver] = useState<{ laneId: string; row: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const anchors = useRef(new Map<string, HTMLElement>());
  const docs = useRef(new Map<string, HTMLElement>());
  const laneEls = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<Path[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);

  // Den grundlæggende "Proces"-lane vises kun når den bruges, eller når der
  // slet ingen andre svimlaner er endnu.
  const visibleLanes = lanes.filter(
    (l) => !l.isDefault || steps.some((s) => s.laneId === l.id) || lanes.length === 1,
  );
  const grid = useMemo(() => layoutGrid(steps, flows), [steps, flows]);
  const rowOf = grid.rows;
  const offOf = grid.offs;
  const sameOff = (a: string, b: string) => Math.abs((offOf.get(a) ?? 0) - (offOf.get(b) ?? 0)) < 0.01;
  const rowCount = Math.max(1, ...rowOf.values());
  const laneOf = new Map(steps.map((s) => [s.id, s.laneId]));
  // Input-dokumenter der genbruger et dokument lige ovenover (se sharedDocs).
  const shared = useMemo(() => sharedDocs(steps, grid.rows, grid.offs), [steps, grid]);
  // Svimlanerne fra venstre: hovedpoolen først, så de ekstra pools.
  const laneOrder = [
    ...visibleLanes.filter((l) => !l.poolId || !pools.some((p) => p.id === l.poolId)),
    ...pools.flatMap((p) => visibleLanes.filter((l) => l.poolId === p.id)),
  ].map((l) => l.id);
  const lifted = docsLifted(steps, flows, grid.rows, laneOrder);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base = canvas.getBoundingClientRect();
    const rect = (el: HTMLElement): Rect => {
      const r = el.getBoundingClientRect();
      return {
        l: (r.left - base.left) / scale,
        r: (r.right - base.left) / scale,
        t: (r.top - base.top) / scale,
        b: (r.bottom - base.top) / scale,
        cx: ((r.left + r.right) / 2 - base.left) / scale,
        cy: ((r.top + r.bottom) / 2 - base.top) / scale,
      };
    };
    // Hele pixels, så lodrette og vandrette stykker står skarpt og lige.
    const toD = (pts: number[][]) =>
      pts.map((q, i) => `${i ? "L" : "M"}${Math.round(q[0])} ${Math.round(q[1])}`).join(" ");

    // Antal pile ind i / ud af hvert skridt — bruges til at lade pile der
    // samles eller deler sig knække i samme højde.
    const inCount = new Map<string, number>();
    const outCount = new Map<string, number>();
    for (const f of flows) {
      inCount.set(f.to, (inCount.get(f.to) ?? 0) + 1);
      outCount.set(f.from, (outCount.get(f.from) ?? 0) + 1);
    }

    const nextPaths: Path[] = [];
    const nextLabels: Label[] = [];
    const typeOf = new Map(steps.map((s) => [s.id, s.type]));
    // Pile der går uden om i samme svimlane og side får hver sin afstand,
    // så de ikke lægger sig oven i hinanden.
    const detours = new Map<string, number>();
    const detourOffset = (lane: string | undefined, side: "l" | "r") => {
      const key = `${lane}:${side}`;
      const n = detours.get(key) ?? 0;
      detours.set(key, n + 1);
      return 16 + n * 10;
    };

    for (const f of flows) {
      const aEl = anchors.current.get(f.from);
      const bEl = anchors.current.get(f.to);
      if (!aEl || !bEl) continue;
      const a = rect(aEl);
      const b = rect(bEl);
      const aRow = rowOf.get(f.from) ?? 0;
      const bRow = rowOf.get(f.to) ?? 0;
      const sameLane = laneOf.get(f.from) === laneOf.get(f.to);
      // Samme kolonne i samme svimlane = lige ned; ellers et knæk hen over.
      const sameCol = sameLane && sameOff(f.from, f.to);
      const kind = f.kind === "MESSAGE" ? "msg" : "seq";
      let pts: number[][];

      if (sameCol) {
        const blockers = steps.filter(
          (s) =>
            s.laneId === laneOf.get(f.from) &&
            sameOff(s.id, f.from) &&
            (rowOf.get(s.id) ?? 0) > Math.min(aRow, bRow) &&
            (rowOf.get(s.id) ?? 0) < Math.max(aRow, bRow),
        );
        if (!blockers.length && bRow > aRow) {
          pts = [
            [a.cx, a.b],
            [a.cx, b.t],
          ];
        } else if (isGateway(typeOf.get(f.from) ?? "") && bRow > aRow) {
          // En gren fra en gateway i samme svimlane går ud til HØJRE og uden
          // om — så den ikke forveksles med en løkke tilbage (venstre side).
          let xr = Math.max(a.r, b.r);
          for (const s of blockers) {
            const el = anchors.current.get(s.id);
            if (el) xr = Math.max(xr, rect(el).r);
          }
          const laneEl = laneEls.current.get(laneOf.get(f.from) ?? "");
          const off = detourOffset(laneOf.get(f.from), "r");
          xr = Math.min(xr + off, laneEl ? rect(laneEl).r - 4 : xr + off);
          // Ud af bunden og til højre lige under ruden — ikke vandret ud af
          // siden, hvor gatewayens spørgsmål står.
          const y0 = a.b + 12;
          pts = [
            [a.cx, a.b],
            [a.cx, y0],
            [xr, y0],
            [xr, b.cy],
            [b.r, b.cy],
          ];
        } else {
          // Uden om til venstre — både når noget står i vejen, og når pilen
          // går tilbage op i forløbet (en løkke).
          let x0 = Math.min(a.l, b.l);
          for (const s of blockers) {
            const el = anchors.current.get(s.id);
            if (el) x0 = Math.min(x0, rect(el).l);
          }
          const laneEl = laneEls.current.get(laneOf.get(f.from) ?? "");
          const off = detourOffset(laneOf.get(f.from), "l");
          x0 = Math.max(x0 - off, laneEl ? rect(laneEl).l + 4 : x0 - off);
          pts = [
            [a.l, a.cy],
            [x0, a.cy],
            [x0, b.cy],
            [b.l, b.cy],
          ];
        }
      } else if (aRow === bRow) {
        // Samme række, to svimlaner: vandret pil.
        const right = b.cx > a.cx;
        const sx = right ? a.r : a.l;
        const ex = right ? b.l : b.r;
        const mx = (sx + ex) / 2;
        pts =
          Math.abs(a.cy - b.cy) < 2
            ? [
                [sx, a.cy],
                [ex, b.cy],
              ]
            : [
                [sx, a.cy],
                [mx, a.cy],
                [mx, b.cy],
                [ex, b.cy],
              ];
      } else if (!sameLane && isGateway(typeOf.get(f.from) ?? "") && bRow > aRow) {
        // Fra en beslutning ud af siden, hen over og ned i målet.
        const toRight = b.cx > a.cx;
        const sx = toRight ? a.r : a.l;
        pts = [
          [sx, a.cy],
          [b.cx, a.cy],
          [b.cx, b.t],
        ];
      } else if (bRow <= aRow) {
        // Tilbage op i en anden svimlane: ud til venstre, op langs
        // svimlanens venstre kant, og ind i målet fra siden — uden om alt
        // hvad der står imellem.
        const laneEl = laneEls.current.get(laneOf.get(f.from) ?? "");
        const xl = laneEl ? rect(laneEl).l + 12 : a.l - 16;
        const ex = b.cx > xl ? b.l : b.r;
        pts = [
          [a.l, a.cy],
          [xl, a.cy],
          [xl, b.cy],
          [ex, b.cy],
        ];
      } else {
        // Nedad til en anden svimlane. Står der noget i kildens svimlane
        // imellem, drejes der med det samme; står der noget i målets, drejes
        // der først lige over målet; ellers midt imellem.
        const between = (id: string) =>
          steps.some((s) => {
            const r = rowOf.get(s.id) ?? 0;
            return s.laneId === laneOf.get(id) && sameOff(s.id, id) && r > aRow && r < bRow;
          });
        const sy = a.b;
        const ey = b.t;
        // Hvor pilen knækker vandret. Samles flere pile i ét skridt, knækker
        // de alle i samme højde lige over målet; deler et skridt sig i flere
        // grene, knækker de alle i samme højde lige under kilden — så de
        // vandrette stykker flugter i stedet for at stå i hver sin højde.
        const y1 = between(f.from)
          ? sy + 16
          : between(f.to)
            ? ey - 16
            : (inCount.get(f.to) ?? 0) > 1
              ? Math.max(sy + 8, ey - 18)
              : (outCount.get(f.from) ?? 0) > 1
                ? Math.min(ey - 8, sy + 18)
                : Math.max(sy + 10, (sy + ey) / 2);
        pts =
          Math.abs(a.cx - b.cx) < 2
            ? [
                [a.cx, sy],
                [a.cx, ey],
              ]
            : [
                [a.cx, sy],
                [a.cx, y1],
                [b.cx, y1],
                [b.cx, ey],
              ];
      }
      if (f.label) nextLabels.push({ text: f.label, ...labelPoint(pts) });
      nextPaths.push({ d: toD(pts), kind, from: f.from, to: f.to });
    }

    for (const s of steps) {
      const anchor = anchors.current.get(s.id);
      if (!anchor) continue;
      s.data.forEach((d, i) => {
        const act = rect(anchor);
        // Genbrugt dokument: pil fra dokumentet ovenover, ned og ind i
        // aktiviteten fra højre.
        const source = shared.get(`${s.id}:${i}`);
        if (source) {
          const srcEl = docs.current.get(source);
          if (!srcEl) return;
          const doc = rect(srcEl);
          nextPaths.push({
            d: toD([
              [doc.cx, doc.b],
              [doc.cx, act.cy],
              [act.r, act.cy],
            ]),
            kind: "data",
          });
          return;
        }
        const docEl = docs.current.get(`${s.id}:${i}`);
        if (!docEl) return;
        const doc = rect(docEl);
        // Dokumenterne står til højre for aktiviteten: ind = pil fra
        // dokumentet mod venstre ind i aktiviteten, ud = pil fra aktiviteten.
        nextPaths.push({
          d:
            d.dir === "in"
              ? toD([
                  [doc.l, doc.cy],
                  [act.r, doc.cy],
                ])
              : toD([
                  [act.r, doc.cy],
                  [doc.l, doc.cy],
                ]),
          kind: "data",
        });
      });
    }

    setPaths(nextPaths);
    setLabels(nextLabels);
    // rowOf/laneOf afledes af steps — steps er den reelle afhængighed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, flows, scale, shared]);

  useLayoutEffect(() => {
    draw();
  }, [draw, lanes, pools]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    if (document.fonts?.ready) document.fonts.ready.then(() => draw());
    return () => ro.disconnect();
  }, [draw]);

  const setAnchor = (id: string) => (el: HTMLElement | null) => {
    if (el) anchors.current.set(id, el);
    else anchors.current.delete(id);
  };

  function clickable(stepId: string, children: ReactNode, className = "", isAnchor = false) {
    const focused = focusStepId === stepId;
    return (
      <button
        ref={isAnchor ? setAnchor(stepId) : undefined}
        type="button"
        draggable={!!onStepDrop}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/step-id", stepId);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => setDragOver(null)}
        onClick={() => onStepClick?.(stepId)}
        className={`${className} ${onStepDrop ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} transition-shadow ${
          focused
            ? "shadow-[0_0_0_3px_var(--color-clay-line)]"
            : connecting
              ? "shadow-[0_0_0_2px_var(--color-clay-wash)] hover:shadow-[0_0_0_3px_var(--color-clay)]"
              : "hover:shadow-[0_0_0_3px_var(--color-clay-wash)]"
        }`}
      >
        {children}
      </button>
    );
  }

  function renderNode(s: DiagramStep) {
    if (s.type === "START" || s.type === "END") {
      const circle = (
        <span
          ref={setAnchor(s.id)}
          className={`block h-[34px] w-[34px] shrink-0 rounded-full bg-(--color-surface) ${
            s.type === "START" ? "border-[1.5px]" : "border-[3.5px]"
          } border-(--color-text)`}
        />
      );
      const caption = <span className="text-center text-[12px] leading-snug text-(--color-text)">{s.name}</span>;
      return clickable(
        s.id,
        <>
          {s.type === "START" ? caption : circle}
          {s.type === "START" ? circle : caption}
        </>,
        "flex w-[150px] flex-col items-center gap-1.5 rounded-md bg-transparent",
      );
    }

    if (isGateway(s.type) || s.type === "TIMER") {
      return (
        <div className="relative flex w-[150px] items-center justify-center">
          {clickable(
            s.id,
            isGateway(s.type) ? (
              <span ref={setAnchor(s.id)} className="relative block h-[42px] w-[42px]">
                <span className="absolute inset-[6px] rotate-45 border-[1.5px] border-(--color-text) bg-(--color-surface)" />
                <GatewayMarker type={s.type} />
              </span>
            ) : (
              <span
                ref={setAnchor(s.id)}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-4 border-double border-(--color-text) bg-(--color-surface)"
              >
                <ClockIcon />
              </span>
            ),
            "rounded-full",
          )}
          {s.name && (
            <span className="pointer-events-none absolute left-[calc(50%+29px)] top-1/2 w-[112px] -translate-y-1/2 text-left text-[11.5px] leading-tight text-(--color-muted)">
              {s.name}
            </span>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-[22px]">
        {clickable(
          s.id,
          <>
            <span className="block">{s.name}</span>
            {s.systems.length > 0 && (
              <span className="mt-2 block text-[12px] font-bold">[{s.systems.join(", ")}]</span>
            )}
          </>,
          "w-[150px] rounded-[10px] border-[1.5px] border-(--color-text) bg-(--color-surface) px-2 py-[9px] text-center text-[12.5px] leading-[1.3] text-(--color-text)",
          true,
        )}
        {s.data.some((_, i) => !shared.has(`${s.id}:${i}`)) && (
          <div
            className="flex flex-col gap-2"
            // Løftet op over en vandret pil til højre (se docsLifted).
            style={lifted.has(s.id) ? { transform: "translateY(calc(-50% - 6px))" } : undefined}
          >
            {s.data.map((d, i) => shared.has(`${s.id}:${i}`) ? null : (
              <div
                key={i}
                ref={(el) => {
                  const key = `${s.id}:${i}`;
                  if (el) docs.current.set(key, el);
                  else docs.current.delete(key);
                }}
                className="relative flex min-h-[50px] w-[90px] items-center justify-center pb-[7px] pl-1.5 pr-3.5 pt-[9px] text-center text-[11px] leading-tight text-(--color-text)"
              >
                <DocIcon />
                <span className="relative">{d.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const markerId = "sl-m";

  // Hovedpoolen først, derefter de ekstra pools. En ekstra pool uden
  // svimlaner vises stadig (tom), så den kan ses og redigeres.
  const poolBoxes = [
    { id: null as string | null, name: title, lanes: visibleLanes.filter((l) => !l.poolId || !pools.some((p) => p.id === l.poolId)) },
    ...pools.map((p) => ({ id: p.id as string | null, name: p.name, lanes: visibleLanes.filter((l) => l.poolId === p.id) })),
  ];

  return (
    <div ref={canvasRef} className="relative inline-block min-w-full">
      <div className="flex items-start gap-5">
      {poolBoxes.map((pool) => (
      <div
        key={pool.id ?? "main"}
        className="border-[1.5px] border-(--color-text) bg-(--color-surface)"
        style={{ width: "max-content", minWidth: pool.lanes.length ? undefined : 180 }}
      >
        {pool.id ? (
          <button
            type="button"
            onClick={(e) => onPoolClick?.(pool.id!, e.currentTarget.getBoundingClientRect())}
            title="Rediger pool"
            className="flex h-10 w-full items-center border-b-[1.5px] border-(--color-text) px-3.5 text-left text-[16px] font-semibold text-(--color-text) transition-colors hover:bg-(--color-raised)"
          >
            {pool.name}
          </button>
        ) : (
          <div className="flex h-10 items-center border-b-[1.5px] border-(--color-text) px-3.5 text-[16px] font-semibold text-(--color-text)">
            {pool.name}
          </div>
        )}
        <div className="flex">
          {pool.lanes.length === 0 && (
            <div className="flex h-24 w-full items-center justify-center px-4 text-center text-[11.5px] text-(--color-faint)">
              Ingen svimlaner endnu
            </div>
          )}
          {pool.lanes.map((lane) => {
            const laneSteps = steps.filter((s) => s.laneId === lane.id);
            const hasDocs = laneSteps.some((s) => s.data.length > 0);
            // Svimlanen bliver så bred som dens yderste skridt til hver side.
            const laneOffs = laneSteps.map((s) => offOf.get(s.id) ?? 0);
            const minOff = laneOffs.length ? Math.min(...laneOffs) : 0;
            const maxOff = laneOffs.length ? Math.max(...laneOffs) : 0;
            const laneCols = maxOff - minOff + 1;
            const colWidth = hasDocs ? 292 : 210;
            return (
              <div
                key={lane.id}
                ref={(el) => {
                  if (el) laneEls.current.set(lane.id, el);
                  else laneEls.current.delete(lane.id);
                }}
                className="flex-none border-r border-(--color-text) last:border-r-0"
                style={{ width: colWidth * laneCols }}
              >
                <button
                  type="button"
                  onClick={(e) => onLaneClick?.(lane.id, e.currentTarget.getBoundingClientRect())}
                  title="Rediger svimlane"
                  className="flex h-11 w-full items-center justify-center border-b border-(--color-text) px-2 text-center text-[13.5px] font-semibold text-(--color-text) transition-colors hover:bg-(--color-raised)"
                >
                  {lane.name}
                </button>
                <div
                  className="relative grid pb-[22px] pt-3.5"
                  style={{ gridTemplateRows: `repeat(${rowCount}, ${ROW_H}px)` }}
                  onDragOver={(e) => {
                    if (!onStepDrop || !e.dataTransfer.types.includes("text/step-id")) return;
                    e.preventDefault();
                    const top = e.currentTarget.getBoundingClientRect().top;
                    const row = Math.max(1, Math.min(rowCount + 1, Math.floor(((e.clientY - top) / scale - 14) / ROW_H) + 1));
                    if (dragOver?.laneId !== lane.id || dragOver.row !== row) setDragOver({ laneId: lane.id, row });
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                  }}
                  onDrop={(e) => {
                    const stepId = e.dataTransfer.getData("text/step-id");
                    setDragOver(null);
                    if (!stepId || !onStepDrop) return;
                    e.preventDefault();
                    const top = e.currentTarget.getBoundingClientRect().top;
                    const row = Math.max(1, Math.floor(((e.clientY - top) / scale - 14) / ROW_H) + 1);
                    // Pladsen i rækkefølgen: før det første andet skridt der står
                    // på den række eller længere nede.
                    const others = steps.filter((s) => s.id !== stepId);
                    let position = others.findIndex((s) => (rowOf.get(s.id) ?? 0) >= row);
                    if (position < 0) position = others.length;
                    onStepDrop(stepId, lane.id, position);
                  }}
                >
                  {dragOver?.laneId === lane.id && (
                    <div
                      className="pointer-events-none absolute inset-x-2 rounded-md border-2 border-dashed border-(--color-clay-line) bg-(--color-clay-wash)/60"
                      style={{ top: 14 + (dragOver.row - 1) * ROW_H + 8, height: ROW_H - 16 }}
                    />
                  )}
                  {laneSteps.map((s) => (
                    <div
                      key={s.id}
                      className={`absolute flex min-w-0 items-center ${hasDocs ? "justify-start pl-[22px]" : "justify-center"}`}
                      style={{
                        top: 14 + ((rowOf.get(s.id) ?? 1) - 1) * ROW_H,
                        left: ((offOf.get(s.id) ?? 0) - minOff) * colWidth,
                        width: colWidth,
                        height: ROW_H,
                      }}
                    >
                      {renderNode(s)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      ))}
      </div>

      <svg className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <marker id={`${markerId}-filled`} markerUnits="userSpaceOnUse" orient="auto" markerWidth="10" markerHeight="10" refX="9" refY="5">
            <path d="M0,0.5 L9,5 L0,9.5 z" fill="var(--color-text)" />
          </marker>
          <marker id={`${markerId}-open`} markerUnits="userSpaceOnUse" orient="auto" markerWidth="10" markerHeight="10" refX="9" refY="5">
            <path d="M0,0.5 L9,5 L0,9.5" fill="none" stroke="var(--color-text)" strokeWidth="1.2" />
          </marker>
          <marker id={`${markerId}-hollow`} markerUnits="userSpaceOnUse" orient="auto" markerWidth="11" markerHeight="11" refX="10" refY="5.5">
            <path d="M0.5,0.5 L10,5.5 L0.5,10.5 z" fill="var(--color-surface)" stroke="var(--color-text)" strokeWidth="1.2" />
          </marker>
          <marker id={`${markerId}-circle`} markerUnits="userSpaceOnUse" orient="auto" markerWidth="10" markerHeight="10" refX="4" refY="5">
            <circle cx="5" cy="5" r="3.5" fill="var(--color-surface)" stroke="var(--color-text)" strokeWidth="1.2" />
          </marker>
        </defs>
        {/* Usynlige, brede streger under pilene, så de er nemme at klikke på */}
        {onFlowClick &&
          paths
            .filter((p) => p.from && p.to)
            .map((p, i) => (
              <path
                key={`hit-${i}`}
                d={p.d}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                pointerEvents="stroke"
                data-no-pan
                className="cursor-pointer"
                onClick={() => onFlowClick(p.from!, p.to!)}
              />
            ))}
        {paths.map((p, i) => {
          const selected = !!selectedFlow && selectedFlow.from === p.from && selectedFlow.to === p.to;
          return (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke={selected ? "var(--color-clay)" : "var(--color-text)"}
            strokeWidth={selected ? 2.4 : p.kind === "seq" ? 1.4 : 1.2}
            strokeDasharray={p.kind === "msg" ? "6 4" : p.kind === "data" ? "2 3" : undefined}
            markerStart={p.kind === "msg" ? `url(#${markerId}-circle)` : undefined}
            markerEnd={
              p.kind === "msg"
                ? `url(#${markerId}-hollow)`
                : p.kind === "data"
                  ? `url(#${markerId}-open)`
                  : `url(#${markerId}-filled)`
            }
          />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0">
        {labels.map((lb, i) => (
          <div
            key={i}
            className="absolute w-max max-w-[120px] -translate-x-1/2 -translate-y-1/2 bg-(--color-surface) px-1 py-px text-center text-[11px] leading-tight text-(--color-text)"
            style={{ left: lb.x, top: lb.y }}
          >
            {lb.text}
          </div>
        ))}
      </div>
      {overlay}
    </div>
  );
}

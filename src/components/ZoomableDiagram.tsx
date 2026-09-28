"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/*
  Diagrammet vises i en fast ramme, som et lærred: man zoomer (−/+, "Tilpas",
  Ctrl/⌘ + scroll) og flytter rundt ved at trække i den tomme baggrund.

  - Rammen har altid samme størrelse — den krymper ikke når man zoomer ud.
  - Mindste zoom er det punkt hvor hele diagrammet lige kan ses i rammen;
    længere ud giver kun tomt rum, så det kan man ikke.
  - Diagrammet skaleres med CSS-transform. Skalaen gives videre til
    diagrammet, fordi pile, træk-og-slip og noter regner i diagrammets egne
    (uskalerede) koordinater.
*/

const MAX = 2;
const STEPS = [0.2, 0.25, 0.3, 0.4, 0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
const PAD = 24; // luft om diagrammet inde i rammen

export function ZoomableDiagram({ children }: { children: (scale: number) => ReactNode }) {
  const [wanted, setWanted] = useState(1);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ w: 0, h: 0 });
  const [panning, setPanning] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

  // Diagrammets naturlige størrelse før transform. Det indre element har
  // width: max-content, så dets størrelse aldrig afhænger af rammen (ellers
  // krymper målingen for hvert zoom-trin). scrollWidth/-Height tager noter
  // uden for diagrammet med.
  const measure = () => {
    const el = innerRef.current;
    if (!el) return;
    const w = Math.max(el.offsetWidth, el.scrollWidth);
    const h = Math.max(el.offsetHeight, el.scrollHeight);
    setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
  };
  useLayoutEffect(measure);
  useLayoutEffect(() => {
    const el = innerRef.current;
    const vp = viewRef.current;
    if (!el || !vp) return;
    const measureView = () => setView({ w: vp.clientWidth, h: vp.clientHeight });
    measureView();
    const ro = new ResizeObserver(() => {
      measure();
      measureView();
    });
    ro.observe(el);
    ro.observe(vp);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Den zoom hvor hele diagrammet lige kan ses i rammen.
  const fitScale =
    size.w && view.w ? Math.min((view.w - PAD * 2) / size.w, (view.h - PAD * 2) / size.h) : 1;
  const minScale = Math.max(0.1, Math.min(1, fitScale));
  const scale = Math.min(MAX, Math.max(minScale, wanted));

  // Ctrl/⌘ + scroll zoomer. Ikke-passiv lytter, så browserens egen side-zoom
  // kan stoppes.
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setWanted((s) => round(s * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function step(dir: 1 | -1) {
    const next =
      dir > 0
        ? STEPS.find((v) => v > scale + 0.001) ?? MAX
        : [...STEPS].reverse().find((v) => v < scale - 0.001) ?? minScale;
    setWanted(Math.max(minScale, next));
  }

  // Træk i den tomme baggrund for at flytte rundt. Alt der selv kan klikkes
  // eller trækkes i (skridt, pile, noter, felter) er undtaget.
  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("button, input, textarea, select, a, [data-no-pan]")) return;
    const vp = viewRef.current!;
    pan.current = { x: e.clientX, y: e.clientY, left: vp.scrollLeft, top: vp.scrollTop };
    vp.setPointerCapture(e.pointerId);
    setPanning(true);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const p = pan.current;
    if (!p) return;
    const vp = viewRef.current!;
    vp.scrollLeft = p.left - (e.clientX - p.x);
    vp.scrollTop = p.top - (e.clientY - p.y);
  }
  function endPan() {
    pan.current = null;
    setPanning(false);
  }

  const btn =
    "flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[13px] text-(--color-muted) transition-colors hover:bg-(--color-sunken) hover:text-(--color-text) disabled:opacity-40";

  return (
    <div className="relative">
      <div className="absolute right-3 top-3 z-30 flex items-center gap-0.5 rounded-lg border border-(--color-line) bg-(--color-surface) p-0.5 shadow-[0_1px_2px_rgba(20,16,12,0.06)]">
        <button type="button" onClick={() => step(-1)} disabled={scale <= minScale + 0.001} title="Zoom ud" className={btn}>
          −
        </button>
        <button
          type="button"
          onClick={() => setWanted(1)}
          title="Nulstil til 100 %"
          className={`${btn} tabular w-12 font-mono text-[11.5px]`}
        >
          {Math.round(scale * 100)}%
        </button>
        <button type="button" onClick={() => step(1)} disabled={scale >= MAX} title="Zoom ind" className={btn}>
          +
        </button>
        <span className="mx-0.5 h-4 w-px bg-(--color-line)" />
        <button
          type="button"
          onClick={() => setWanted(Math.min(1.25, fitScale))}
          title="Vis hele diagrammet"
          className={`${btn} text-[12px]`}
        >
          Tilpas
        </button>
      </div>

      <div
        ref={viewRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        className={`h-[72vh] min-h-[420px] overflow-auto rounded-lg border border-(--color-line) bg-(--color-surface) ${
          panning ? "cursor-grabbing select-none" : "cursor-grab"
        }`}
      >
        {/* Mindst rammens størrelse, så et lille diagram centreres; ellers
            diagrammets størrelse, så der kan scrolles/trækkes hele vejen rundt.
            m-auto centrerer uden at noget havner uden for rækkevidde. */}
        <div className="flex" style={{ minWidth: "100%", minHeight: "100%", width: "max-content", padding: PAD }}>
          <div className="m-auto overflow-hidden" style={{ width: size.w * scale, height: size.h * scale }}>
            <div
              ref={innerRef}
              className="origin-top-left"
              style={{ width: "max-content", transform: scale === 1 ? undefined : `scale(${scale})` }}
            >
              {children(scale)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function round(v: number) {
  return Math.min(MAX, Math.max(0.1, Math.round(v * 100) / 100));
}

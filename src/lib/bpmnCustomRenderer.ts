/*
  Egne ikoner for kontekst-boksene — samme filikon (side med foldet hjørne)
  for begge, kun kanten adskiller dem: tynd for Input kontekst, tyk for
  Output kontekst — ligesom start- og sluthændelsen.

  Boksene tegnes UDELUKKENDE ud fra rigtige StepData/StepSystem-koblinger,
  oprettet via Skridtdetaljer-sidebjælken (se linkStepData/linkStepSystem i
  [subId]/actions.ts) — aldrig ved at brugeren selv tegner dem på lærredet.
  Derfor er paletens "Data object reference"/"Data store reference" (som
  tidligere blev erstattet med vores egne, håndtegnbare varianter) fjernet
  helt: en hånd-tegnet boks ville se identisk ud men aldrig svare til noget
  rigtigt link, hvilket kun forvirrer.
*/
import BaseRenderer from "diagram-js/lib/draw/BaseRenderer";
import { append as svgAppend, create as svgCreate } from "tiny-svg";

type El = {
  id: string;
  type?: string;
  width: number;
  height: number;
  labelTarget?: unknown;
  businessObject: { id?: string; name?: string };
};

const INK = "#14100c";
export const CTX_IN_NAME = "Input kontekst";
export const CTX_OUT_NAME = "Output kontekst";
export const SYS_NAME = "Systemer";

// Selve figuren, aldrig dens tekstlabel — labelen deler id-præfiks og navn
// med sit mål og skal bare vise tekst, ikke endnu et ikon.
function isLabel(el: El) {
  return el.type === "label" || !!el.labelTarget || el.id?.endsWith("_label");
}
function isCtxIn(el: El) {
  if (isLabel(el)) return false;
  return el.id?.startsWith("CtxIn_") || el.businessObject?.name === CTX_IN_NAME;
}
function isCtxOut(el: El) {
  if (isLabel(el)) return false;
  return el.id?.startsWith("CtxOut_") || el.businessObject?.name === CTX_OUT_NAME;
}
// Systemer-boksen — ren afspejling af StepSystem-links, aldrig noget brugeren
// selv tegner (intet palette-entry), derfor kun id-præfiks-match, intet
// navne-fallback nødvendigt.
function isSysIcon(el: El) {
  if (isLabel(el)) return false;
  return !!el.id?.startsWith("Sys_");
}

// Klassisk filikon: en side med et foldet hjørne øverst til højre.
function fileIconPath(w: number, h: number) {
  const fold = Math.min(w, h) * 0.32;
  return (
    `M 0 0 L ${w - fold} 0 L ${w} ${fold} L ${w} ${h} L 0 ${h} Z ` +
    `M ${w - fold} 0 L ${w - fold} ${fold} L ${w} ${fold}`
  );
}

function fileIcon(parent: SVGElement, el: El, weight: "thin" | "thick") {
  const group = svgCreate("g");
  svgAppend(parent, group);

  const path = svgCreate("path", {
    d: fileIconPath(el.width, el.height),
    fill: "#ffffff",
    stroke: INK,
    strokeWidth: weight === "thin" ? 1.5 : 3.5,
    strokeLinejoin: "round",
  });
  svgAppend(group, path);

  return group;
}

// Systemer-ikon: en afrundet skærm/vindue-kontur med en "titelbjælke" — visuelt
// tydeligt forskelligt fra kontekst-boksens filikon, samme sort-på-hvid stil.
function systemIcon(parent: SVGElement, el: El) {
  const group = svgCreate("g");
  svgAppend(parent, group);

  const { width: w, height: h } = el;
  const r = Math.min(w, h) * 0.16;
  const rect = svgCreate("rect", {
    x: 0,
    y: 0,
    width: w,
    height: h,
    rx: r,
    ry: r,
    fill: "#ffffff",
    stroke: INK,
    strokeWidth: 2,
  });
  svgAppend(group, rect);

  const barY = h * 0.34;
  const bar = svgCreate("line", {
    x1: 0,
    y1: barY,
    x2: w,
    y2: barY,
    stroke: INK,
    strokeWidth: 1.5,
  });
  svgAppend(group, bar);

  return group;
}

export class CtxIconRenderer extends BaseRenderer {
  static $inject = ["eventBus", "bpmnRenderer"];

  private bpmnRenderer: {
    canRender: (el: El) => boolean;
    drawShape: (parent: SVGElement, el: El) => SVGElement;
    getShapePath: (el: El) => string;
  };

  constructor(eventBus: unknown, bpmnRenderer: CtxIconRenderer["bpmnRenderer"]) {
    // Højere prioritet end standard-rendereren, så vores match vinder
    super(eventBus as never, 2000);
    this.bpmnRenderer = bpmnRenderer;
  }

  canRender(element: El) {
    return isCtxIn(element) || isCtxOut(element) || isSysIcon(element);
  }

  drawShape(parentNode: SVGElement, element: El) {
    if (isSysIcon(element)) return systemIcon(parentNode, element);
    return fileIcon(parentNode, element, isCtxIn(element) ? "thin" : "thick");
  }

  getShapePath(element: El) {
    return this.bpmnRenderer.getShapePath(element);
  }
}

/*
  Fjerner paletens indbyggede "Data object reference"/"Data store reference"
  helt (i stedet for at erstatte dem med håndtegnbare varianter, som tidligere)
  — kontekst-bokse må kun opstå via rigtige StepData-links fra
  Skridtdetaljer-panelet, aldrig ved frihåndstegning på lærredet.
  getPaletteEntries kan returnere en funktion i stedet for et objekt
  (diagram-js's Palette kalder den med de allerede-indsamlede entries og
  bruger dens return) — det er det der lader os SLETTE nøgler andre
  providers (standard-paletten, højere prioritet, kørt først) allerede har
  sat, i stedet for blot at undlade at tilføje egne.
*/
export class CtxPaletteProvider {
  static $inject = ["palette"];

  constructor(palette: { registerProvider: (priority: number, provider: unknown) => void }) {
    // Lavere prioritet end standard-paletten (1000) — vores provider behandles
    // sidst i reduce'en, så den kan slette entries den allerede har sat.
    palette.registerProvider(500, this);
  }

  getPaletteEntries() {
    return (entries: Record<string, unknown>) => {
      delete entries["create.data-object"];
      delete entries["create.data-store"];
      return entries;
    };
  }
}

export const ctxIconModule = {
  __init__: ["ctxIconRenderer", "ctxPaletteProvider"],
  ctxIconRenderer: ["type", CtxIconRenderer],
  ctxPaletteProvider: ["type", CtxPaletteProvider],
};

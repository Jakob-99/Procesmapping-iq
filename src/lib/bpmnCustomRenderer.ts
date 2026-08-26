/*
  Egne ikoner for kontekst-boksene — samme filikon (side med foldet hjørne)
  for begge, kun kanten adskiller dem: tynd for Input kontekst, tyk for
  Output kontekst — ligesom start- og sluthændelsen.

  Paletten (figurudvalget i kanten) skal også kunne sætte dem direkte på
  lærredet — ikke kun de auto-genererede fra kortlægningen — så de to
  standard-figurer "Data object"/"Data store" er erstattet med vores egne to.
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
    return isCtxIn(element) || isCtxOut(element);
  }

  drawShape(parentNode: SVGElement, element: El) {
    return fileIcon(parentNode, element, isCtxIn(element) ? "thin" : "thick");
  }

  getShapePath(element: El) {
    return this.bpmnRenderer.getShapePath(element);
  }
}

/*
  Erstatter paletens "Data object reference" og "Data store reference" med
  vores to figurer. Ikonet i selve panelet er en lille version af den samme
  boks-med-pil-tegning, så det matcher det man faktisk sætter på lærredet.
*/
function paletteIconHtml(direction: "in" | "out") {
  // Samme forhold mellem kant og figur som på selve lærredet (28×40, 1.5/3.5)
  // — en lille version af den tynde tegning bliver uforholdsmæssigt tyk hvis
  // kanten ikke skaleres ned med.
  const w = 14;
  const h = 20;
  const strokeW = direction === "in" ? 1.3 : 2.4;
  const d = fileIconPath(w, h);
  const pad = strokeW;
  // Paletens klik-håndtering og layout er bundet til ".entry" — uden den
  // klasse er ikonet usynligt og ikke-klikbart, selvom det står i DOM'en.
  // .entry centrerer skrifttype-ikoner via line-height — det virker ikke for
  // et inline <svg>, som i stedet lander foroven. Tving centrering med flex.
  return (
    `<div class="entry" draggable="true" style="display:flex;align-items:center;justify-content:center;line-height:normal;">` +
    `<svg width="17" height="24" viewBox="${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}" fill="none">` +
    `<path d="${d}" stroke="#14100c" stroke-width="${strokeW}" stroke-linejoin="round" fill="white"/>` +
    `</svg>` +
    `</div>`
  );
}

type ElementFactory = { createShape: (attrs: unknown) => El };
type Create = { start: (event: unknown, shape: El) => void };

export class CtxPaletteProvider {
  static $inject = ["palette", "create", "elementFactory"];

  constructor(palette: { registerProvider: (priority: number, provider: unknown) => void }, create: Create, elementFactory: ElementFactory) {
    this._create = create;
    this._elementFactory = elementFactory;
    // Lavere prioritet end standard-paletten (1000) — vores entries vinder ved samme nøgle.
    palette.registerProvider(500, this);
  }

  private _create: Create;
  private _elementFactory: ElementFactory;

  getPaletteEntries() {
    const create = this._create;
    const elementFactory = this._elementFactory;

    const makeAction = (type: string, name: string, direction: "in" | "out") => {
      const listener = (event: unknown) => {
        // Fast størrelse — bpmn-js's standardstørrelse for datalager er
        // større end for dataobjekt, og de to skal se lige store ud.
        const shape = elementFactory.createShape({ type, width: 28, height: 40 });
        shape.businessObject.name = name;
        // Præfikset id holder den i tråd med de auto-genererede fra
        // kortlægningen — samme CSS- og gem-logik gælder for begge.
        shape.businessObject.id = shape.id =
          (direction === "in" ? "CtxIn_" : "CtxOut_") + Math.random().toString(36).slice(2, 10);
        create.start(event, shape);
      };
      return {
        group: "data-store",
        html: paletteIconHtml(direction),
        title: `Opret ${name}`,
        action: { dragstart: listener, click: listener },
      };
    };

    return {
      "create.data-object": makeAction("bpmn:DataObjectReference", CTX_IN_NAME, "in"),
      "create.data-store": makeAction("bpmn:DataStoreReference", CTX_OUT_NAME, "out"),
    };
  }
}

export const ctxIconModule = {
  __init__: ["ctxIconRenderer", "ctxPaletteProvider"],
  ctxIconRenderer: ["type", CtxIconRenderer],
  ctxPaletteProvider: ["type", CtxPaletteProvider],
};

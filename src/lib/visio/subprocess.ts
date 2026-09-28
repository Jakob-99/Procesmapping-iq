import fs from "node:fs";
import path from "node:path";
import { isGateway } from "@/lib/domain";
import { docsLifted, layoutGrid, sharedDocs } from "@/lib/swimlane-layout";
import { zip } from "@/lib/zip";

/*
  Et svimlanediagram som Visio-fil (.vsdx) — samme opbygning som diagrammet
  i appen: pools side om side med titel øverst, lodrette svimlaner, ét skridt
  pr. række (lib/swimlane-layout), aktiviteter som afrundede bokse med
  [systemer], gateways som ruder med markør, start tynd cirkel, slut tyk,
  timer dobbeltcirkel, dokumenter til højre for aktiviteten.

  Pilene lægges efter samme regler som i SwimlaneDiagram.tsx og limes til
  figurerne, så de følger med, når man flytter rundt i Visio.

  Pakken bygges fra bunden; kun stilark og tema (Visios standardtema
  "Simple") hentes fra lib/visio/template.
*/

export type VisioInput = {
  title: string;
  pools: { id: string; name: string }[];
  lanes: { id: string; name: string; isDefault: boolean; poolId: string | null }[];
  steps: { id: string; type: string; name: string; laneId: string; systems: string[]; data: { name: string; dir: "in" | "out" }[] }[];
  flows: { from: string; to: string; label: string | null; kind: string }[];
};

// Målene er de samme pixels som i appen; 96 px = 1 tomme i Visio.
const PX = 1 / 96;
const ROW_H = 112;
const POOL_HEAD = 40;
const LANE_HEAD = 44;
const TOP_PAD = 14;
const BOTTOM_PAD = 22;
const POOL_GAP = 20;
const MARGIN = 24;
const TASK_W = 150;
const DOC_W = 90;
const DOC_H = 50;

const INK = "#241c17";
const MUTED = "#6b5a4c";
const PAPER = "#ffffff";

type Rect = { l: number; r: number; t: number; b: number; cx: number; cy: number };

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Groft skøn over hvor mange linjer en tekst fylder i en given bredde.
function lineCount(text: string, widthPx: number, charPx = 6.6) {
  const perLine = Math.max(1, Math.floor(widthPx / charPx));
  let lines = 0;
  for (const para of text.split("\n")) {
    let cur = 0;
    let n = 1;
    for (const w of para.split(/\s+/).filter(Boolean)) {
      if (cur && cur + 1 + w.length > perLine) {
        n++;
        cur = w.length;
      } else cur += (cur ? 1 : 0) + w.length;
    }
    lines += n;
  }
  return lines;
}

const cell = (n: string, v: string | number, extra = "") =>
  `<Cell N="${n}" V="${typeof v === "number" ? +v.toFixed(6) : esc(v)}"${extra}/>`;

type ShapeOpts = {
  x: number; // centrum, px (y nedad)
  y: number;
  w: number;
  h: number;
  geom?: "rect" | "ellipse" | "diamond" | "doc" | "none";
  rounding?: number;
  line?: number; // pt, 0 = ingen streg
  lineColor?: string;
  dashed?: boolean;
  fill?: string | null;
  text?: string;
  size?: number; // pt
  bold?: boolean;
  color?: string;
  align?: 0 | 1; // 0 venstre, 1 midt
  vAlign?: 0 | 1 | 2;
  // Tekstblok flyttet ud af figuren (fx navnet under en cirkel), px relativt til figurens øverste venstre hjørne.
  textBox?: { x: number; y: number; w: number; h: number };
  extraText?: { text: string; size: number; bold?: boolean };
  name?: string;
};

class Page {
  shapes: string[] = [];
  connects: string[] = [];
  id = 1;
  constructor(public height: number) {}

  // px → tommer, med y vendt (Visio har origo nederst til venstre).
  X = (x: number) => x * PX;
  Y = (y: number) => (this.height - y) * PX;

  shape(o: ShapeOpts) {
    const id = this.id++;
    const W = o.w * PX;
    const H = o.h * PX;
    const cells: string[] = [
      cell("PinX", this.X(o.x)),
      cell("PinY", this.Y(o.y)),
      cell("Width", W),
      cell("Height", H),
      cell("LocPinX", W / 2),
      cell("LocPinY", H / 2),
      cell("Angle", 0),
      cell("LineWeight", (o.line ?? 1) / 72, ' U="PT"'),
      cell("LineColor", o.lineColor ?? INK),
      cell("LinePattern", o.line === 0 ? 0 : o.dashed ? 2 : 1),
      cell("FillForegnd", o.fill ?? PAPER),
      cell("FillPattern", o.fill === null ? 0 : 1),
      cell("ShdwPattern", 0),
      cell("Rounding", (o.rounding ?? 0) * PX),
      cell("VerticalAlign", o.vAlign ?? 1),
      cell("LeftMargin", 4 * PX),
      cell("RightMargin", 4 * PX),
      cell("TopMargin", 2 * PX),
      cell("BottomMargin", 2 * PX),
      cell("TextBkgnd", 0),
    ];
    if (o.textBox) {
      const tw = o.textBox.w * PX;
      const th = o.textBox.h * PX;
      cells.push(
        cell("TxtPinX", (o.textBox.x + o.textBox.w / 2) * PX),
        cell("TxtPinY", H - (o.textBox.y + o.textBox.h / 2) * PX),
        cell("TxtWidth", tw),
        cell("TxtHeight", th),
        cell("TxtLocPinX", tw / 2),
        cell("TxtLocPinY", th / 2),
        cell("TxtAngle", 0),
      );
    }
    // Ekstra tegnrækker arver ikke fra stilarket — uden FontScale får de
    // bredden 0 %, og bogstaverne lægger sig oven i hinanden.
    const charRow = (ix: number, size: number, bold?: boolean) =>
      `<Row IX="${ix}">${cell("Font", "Calibri")}${cell("Color", o.color ?? INK)}${cell("Size", size / 72, ' U="PT"')}${cell("Style", bold ? 1 : 0)}${cell("FontScale", 1)}${cell("Letterspace", 0)}${cell("Case", 0)}${cell("Pos", 0)}${cell("ColorTrans", 0)}</Row>`;
    const chars = [charRow(0, o.size ?? 9, o.bold)];
    if (o.extraText) chars.push(charRow(1, o.extraText.size, o.extraText.bold));
    const para = `<Section N="Paragraph"><Row IX="0">${cell("HorzAlign", o.align ?? 1)}${cell("SpLine", -1.1)}</Row></Section>`;
    const geom = this.geometry(o.geom ?? "rect", W, H, o.fill === null, o.line === 0);
    const text =
      o.text || o.extraText
        ? `<Text><cp IX="0"/><pp IX="0"/>${esc(o.text ?? "")}${o.extraText ? `\n<cp IX="1"/>${esc(o.extraText.text)}` : ""}</Text>`
        : "";
    this.shapes.push(
      `<Shape ID="${id}" Type="Shape" LineStyle="3" FillStyle="3" TextStyle="3"${o.name ? ` NameU="${esc(o.name)}" Name="${esc(o.name)}"` : ""}>${cells.join("")}<Section N="Character">${chars.join("")}</Section>${para}${geom}${text}</Shape>`,
    );
    return id;
  }

  geometry(kind: NonNullable<ShapeOpts["geom"]>, W: number, H: number, noFill: boolean, noLine: boolean) {
    if (kind === "none") return "";
    const head = `<Section N="Geometry" IX="0">${cell("NoFill", noFill ? 1 : 0)}${cell("NoLine", noLine ? 1 : 0)}${cell("NoShow", 0)}${cell("NoSnap", 0)}`;
    const pts = (list: number[][]) =>
      list
        .map(
          ([x, y], i) =>
            `<Row T="${i ? "LineTo" : "MoveTo"}" IX="${i + 1}">${cell("X", x)}${cell("Y", y)}</Row>`,
        )
        .join("");
    if (kind === "ellipse")
      return `${head}<Row T="Ellipse" IX="1">${cell("X", W / 2)}${cell("Y", H / 2)}${cell("A", W)}${cell("B", H / 2)}${cell("C", W / 2)}${cell("D", H)}</Row></Section>`;
    if (kind === "diamond")
      return `${head}${pts([
        [W / 2, 0],
        [W, H / 2],
        [W / 2, H],
        [0, H / 2],
        [W / 2, 0],
      ])}</Section>`;
    if (kind === "doc") {
      const f = Math.min(W, H) * 0.28;
      return `${head}${pts([
        [0, 0],
        [W, 0],
        [W, H - f],
        [W - f, H],
        [0, H],
        [0, 0],
      ])}</Section><Section N="Geometry" IX="1">${cell("NoFill", 1)}${cell("NoLine", 0)}${cell("NoShow", 0)}${cell("NoSnap", 0)}${pts([
        [W - f, H],
        [W - f, H - f],
        [W, H - f],
      ])}</Section>`;
    }
    return `${head}${pts([
      [0, 0],
      [W, 0],
      [W, H],
      [0, H],
      [0, 0],
    ])}</Section>`;
  }

  /*
    En pil som Visios egen "Dynamic connector" (master 1 i
    template/masters.xml), limet til de to figurer. Så opfører den sig som
    en pil man selv har tegnet i Visio: den lægges pænt om, når man flytter
    en figur, og teksten bliver stående vandret på linjen. Punkterne (px)
    er ruten fra appen, så pilen står rigtigt, til man ændrer noget.

    Som i Visio selv er geometrien ikke drejet: Width/Height er afstanden
    fra begin til slut, og punkterne regnes fra begin.
  */
  line(
    pts: number[][],
    o: { dashed?: boolean; label?: string | null; labelAt?: { x: number; y: number }; from: number; to: number },
  ) {
    const id = this.id++;
    const P = pts.map(([x, y]) => [this.X(x), this.Y(y)]);
    const [bx, by] = P[0];
    const [ex, ey] = P[P.length - 1];
    const local = ([x, y]: number[]) => [x - bx, y - by];
    const glue = (n: string, trig: string) => `<Cell N="${n}" V="${+(n.startsWith("Begin") ? (n.endsWith("X") ? bx : by) : n.endsWith("X") ? ex : ey).toFixed(6)}" F="_WALKGLUE(${trig})"/>`;
    // Formlerne arves fra masteret (F="Inh"); V er den værdi Visio viser,
    // indtil noget regnes om — den skal derfor være rigtig fra start.
    const inh = (n: string, v: number) => `<Cell N="${n}" V="${+v.toFixed(6)}" F="Inh"/>`;
    const cells = [
      inh("PinX", (bx + ex) / 2),
      inh("PinY", (by + ey) / 2),
      inh("Width", ex - bx),
      inh("Height", ey - by),
      inh("LocPinX", (ex - bx) / 2),
      inh("LocPinY", (ey - by) / 2),
      glue("BeginX", "BegTrigger,EndTrigger,WalkPreference"),
      glue("BeginY", "BegTrigger,EndTrigger,WalkPreference"),
      glue("EndX", "EndTrigger,BegTrigger,WalkPreference"),
      glue("EndY", "EndTrigger,BegTrigger,WalkPreference"),
      `<Cell N="BegTrigger" V="2" F="_XFTRIGGER(Sheet.${o.from}!EventXFMod)"/>`,
      `<Cell N="EndTrigger" V="2" F="_XFTRIGGER(Sheet.${o.to}!EventXFMod)"/>`,
      cell("ConFixedCode", 6),
      cell("LineWeight", 1 / 72, ' U="PT"'),
      cell("LineColor", INK),
      cell("LinePattern", o.dashed ? 2 : 1),
      cell("EndArrow", 13),
      cell("EndArrowSize", 1),
      cell("BeginArrow", 0),
      cell("Rounding", 0),
      cell("ShdwPattern", 0),
    ];
    this.connects.push(
      `<Connect FromSheet="${id}" FromCell="BeginX" FromPart="9" ToSheet="${o.from}" ToCell="PinX" ToPart="3"/>`,
      `<Connect FromSheet="${id}" FromCell="EndX" FromPart="12" ToSheet="${o.to}" ToCell="PinX" ToPart="3"/>`,
    );
    let extra = "";
    if (o.label) {
      // Tekstens plads styres af masterets TextPosition-håndtag.
      const at = o.labelAt ?? { x: (pts[0][0] + pts[pts.length - 1][0]) / 2, y: (pts[0][1] + pts[pts.length - 1][1]) / 2 };
      const [lx, ly] = local([this.X(at.x), this.Y(at.y)]);
      const tw = (o.label.length * 5.2 + 8) * PX;
      const th = 14 * PX;
      cells.push(
        cell("TextBkgnd", "#ffffff"),
        inh("TxtPinX", lx),
        inh("TxtPinY", ly),
        inh("TxtWidth", tw),
        inh("TxtHeight", th),
        inh("TxtLocPinX", tw / 2),
        inh("TxtLocPinY", th / 2),
      );
      extra = `<Section N="Control"><Row N="TextPosition">${cell("X", lx)}${cell("Y", ly)}${inh("XDyn", lx)}${inh("YDyn", ly)}<Cell N="XCon" V="0" F="Inh"/></Row></Section><Section N="Character"><Row IX="0">${cell("Font", "Calibri")}${cell("Color", INK)}${cell("Size", 8.5 / 72, ' U="PT"')}${cell("FontScale", 1)}</Row></Section>`;
    }
    // Masteret har tre punkter; en lige pil med to skal slette det tredje,
    // ellers arves det.
    const geom = `<Section N="Geometry" IX="0">${P.map((p, i) => {
      const [x, y] = local(p);
      return `<Row T="${i ? "LineTo" : "MoveTo"}" IX="${i + 1}">${cell("X", x)}${cell("Y", y)}</Row>`;
    }).join("")}${P.length < 3 ? `<Row T="LineTo" IX="3" Del="1"/>` : ""}</Section>`;
    this.shapes.push(
      `<Shape ID="${id}" NameU="Dynamic connector" Name="Dynamic connector" Type="Shape" Master="1">${cells.join("")}${extra}${geom}${o.label ? `<Text>${esc(o.label)}</Text>` : ""}</Shape>`,
    );
    return id;
  }
}

// Hvor en pils tekst skal stå — samme regel som i appen.
function labelPoint(pts: number[][]) {
  const segs = pts.slice(1).map((p, i) => {
    const q = pts[i];
    return { x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2, len: Math.hypot(p[0] - q[0], p[1] - q[1]) };
  });
  if (!segs.length) return { x: pts[0][0], y: pts[0][1] };
  const last = segs[segs.length - 1];
  const best = last.len >= 28 ? last : segs.reduce((m, s) => (s.len > m.len ? s : m), segs[0]);
  return { x: best.x, y: best.y };
}

const MARKER: Record<string, string> = { DECISION: "X", PARALLEL: "+", INCLUSIVE: "O", EVENT_GATEWAY: "◎" };

export function buildSubProcessVsdx(input: VisioInput): Uint8Array {
  const { steps, flows } = input;
  const visibleLanes = input.lanes.filter(
    (l) => !l.isDefault || steps.some((s) => s.laneId === l.id) || input.lanes.length === 1,
  );
  const { rows, offs } = layoutGrid(steps, flows);
  const rowCount = Math.max(1, ...rows.values());
  const bodyH = TOP_PAD + rowCount * ROW_H + BOTTOM_PAD;

  const poolBoxes = [
    { name: input.title, lanes: visibleLanes.filter((l) => !l.poolId || !input.pools.some((p) => p.id === l.poolId)) },
    ...input.pools.map((p) => ({ name: p.name, lanes: visibleLanes.filter((l) => l.poolId === p.id) })),
  ];

  // Vandret opmåling: pools side om side, svimlanerne så brede som deres
  // yderste skridt kræver.
  type LaneBox = { id: string; name: string; l: number; w: number; minOff: number; colW: number; hasDocs: boolean };
  const laneBoxes: LaneBox[] = [];
  const poolRects: { name: string; l: number; w: number }[] = [];
  let x = MARGIN;
  for (const pool of poolBoxes) {
    const start = x;
    if (pool.lanes.length === 0) x += 180;
    for (const lane of pool.lanes) {
      const ls = steps.filter((s) => s.laneId === lane.id);
      const hasDocs = ls.some((s) => s.data.length > 0);
      const o = ls.map((s) => offs.get(s.id) ?? 0);
      const minOff = o.length ? Math.min(...o) : 0;
      const maxOff = o.length ? Math.max(...o) : 0;
      const colW = hasDocs ? 292 : 210;
      const w = colW * (maxOff - minOff + 1);
      laneBoxes.push({ id: lane.id, name: lane.name, l: x, w, minOff, colW, hasDocs });
      x += w;
    }
    poolRects.push({ name: pool.name, l: start, w: x - start });
    x += POOL_GAP;
  }
  const pageW = x - POOL_GAP + MARGIN;
  const pageH = MARGIN + POOL_HEAD + LANE_HEAD + bodyH + MARGIN;
  const page = new Page(pageH);
  const top = MARGIN;
  const bodyTop = top + POOL_HEAD + LANE_HEAD;

  // Pools og svimlaner (tegnes først, så de ligger bagerst).
  for (const p of poolRects) {
    page.shape({ x: p.l + p.w / 2, y: top + (POOL_HEAD + LANE_HEAD + bodyH) / 2, w: p.w, h: POOL_HEAD + LANE_HEAD + bodyH, line: 1.5, fill: PAPER, name: "Pool" });
    page.shape({ x: p.l + p.w / 2, y: top + POOL_HEAD / 2, w: p.w, h: POOL_HEAD, line: 1.5, fill: PAPER, text: p.name, size: 12, bold: true, align: 0, name: "Pooltitel" });
  }
  for (const lb of laneBoxes) {
    page.shape({ x: lb.l + lb.w / 2, y: top + POOL_HEAD + (LANE_HEAD + bodyH) / 2, w: lb.w, h: LANE_HEAD + bodyH, line: 0.75, fill: null, name: "Svimlane" });
    page.shape({ x: lb.l + lb.w / 2, y: top + POOL_HEAD + LANE_HEAD / 2, w: lb.w, h: LANE_HEAD, line: 0.75, fill: PAPER, text: lb.name, size: 10, bold: true, name: "Svimlanetitel" });
  }

  // Skridtene.
  const laneById = new Map(laneBoxes.map((l) => [l.id, l]));
  const shapeOf = new Map<string, number>();
  const rectOf = new Map<string, Rect>();
  const R = (cx: number, cy: number, w: number, h: number): Rect => ({ l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2, cx, cy });
  const docLines: { from: Rect; fromId: number; doc: Rect; docId: number; dir: "in" | "out" }[] = [];
  const docRect = new Map<string, { rect: Rect; id: number }>();
  const sharedLines: { to: Rect; toId: number; source: string }[] = [];
  const shared = sharedDocs(steps, rows, offs);
  const lifted = docsLifted(steps, flows, rows, laneBoxes.map((l) => l.id));

  for (const s of steps) {
    const lb = laneById.get(s.laneId);
    if (!lb) continue;
    const cellL = lb.l + ((offs.get(s.id) ?? 0) - lb.minOff) * lb.colW;
    const cx = lb.hasDocs ? cellL + 22 + TASK_W / 2 : cellL + lb.colW / 2;
    const cy = bodyTop + TOP_PAD + ((rows.get(s.id) ?? 1) - 1) * ROW_H + ROW_H / 2;

    if (s.type === "START" || s.type === "END") {
      const cyC = s.type === "START" ? cy + 11 : cy - 11;
      const id = page.shape({
        x: cx, y: cyC, w: 34, h: 34, geom: "ellipse", line: s.type === "START" ? 1.25 : 3,
        text: s.name, size: 9,
        textBox: s.type === "START" ? { x: -58, y: -22, w: 150, h: 18 } : { x: -58, y: 38, w: 150, h: 18 },
        name: s.type === "START" ? "Start" : "Slut",
      });
      shapeOf.set(s.id, id);
      rectOf.set(s.id, R(cx, cyC, 34, 34));
    } else if (isGateway(s.type)) {
      const id = page.shape({
        x: cx, y: cy, w: 42, h: 42, geom: "diamond", line: 1.25,
        text: MARKER[s.type] ?? "X", size: 14, bold: s.type !== "EVENT_GATEWAY", name: "Gateway",
      });
      if (s.name) page.shape({ x: cx + 29 + 56, y: cy, w: 112, h: 40, geom: "none", line: 0, fill: null, text: s.name, size: 8.5, color: MUTED, align: 0, name: "Gatewaytekst" });
      shapeOf.set(s.id, id);
      rectOf.set(s.id, R(cx, cy, 42, 42));
    } else if (s.type === "TIMER") {
      const id = page.shape({ x: cx, y: cy, w: 34, h: 34, geom: "ellipse", line: 2.5, text: "⏱", size: 11, name: "Timer" });
      if (s.name) page.shape({ x: cx + 29 + 56, y: cy, w: 112, h: 40, geom: "none", line: 0, fill: null, text: s.name, size: 8.5, color: MUTED, align: 0, name: "Timertekst" });
      shapeOf.set(s.id, id);
      rectOf.set(s.id, R(cx, cy, 34, 34));
    } else {
      const sys = s.systems.length ? `[${s.systems.join(", ")}]` : "";
      const h = Math.max(46, 18 + lineCount(s.name, TASK_W - 16) * 16 + (sys ? 8 + lineCount(sys, TASK_W - 16, 7) * 15 : 0));
      const id = page.shape({
        x: cx, y: cy, w: TASK_W, h, rounding: 10, line: 1.25, text: s.name, size: 9.5,
        extraText: sys ? { text: sys, size: 9, bold: true } : undefined, name: "Aktivitet",
      });
      shapeOf.set(s.id, id);
      const act = R(cx, cy, TASK_W, h);
      rectOf.set(s.id, act);
      // Dokumenterne til højre for aktiviteten, stablet om dens midte.
      // Genbrugte dokumenter (se sharedDocs) tegnes ikke igen.
      const own = s.data.map((d, i) => ({ d, i })).filter(({ i }) => !shared.has(`${s.id}:${i}`));
      const total = own.length * DOC_H + (own.length - 1) * 8;
      own.forEach(({ d, i }, k) => {
        // Løftet op over en vandret pil til højre (se docsLifted).
        const top0 = lifted.has(s.id) ? cy - 6 - total : cy - total / 2;
        const dcy = top0 + DOC_H / 2 + k * (DOC_H + 8);
        const dcx = act.r + 22 + DOC_W / 2;
        const docId = page.shape({ x: dcx, y: dcy, w: DOC_W, h: DOC_H, geom: "doc", line: 1, text: d.name, size: 8.5, name: "Dokument" });
        const doc = R(dcx, dcy, DOC_W, DOC_H);
        docRect.set(`${s.id}:${i}`, { rect: doc, id: docId });
        docLines.push({ from: act, fromId: id, doc, docId, dir: d.dir });
      });
      s.data.forEach((_, i) => {
        const source = shared.get(`${s.id}:${i}`);
        if (source) sharedLines.push({ to: act, toId: id, source });
      });
    }
  }

  // Pilene — samme regler som SwimlaneDiagram.tsx.
  const laneOf = new Map(steps.map((s) => [s.id, s.laneId]));
  const typeOf = new Map(steps.map((s) => [s.id, s.type]));
  const sameOff = (a: string, b: string) => Math.abs((offs.get(a) ?? 0) - (offs.get(b) ?? 0)) < 0.01;
  const laneRect = (id: string | undefined) => {
    const lb = id ? laneById.get(id) : undefined;
    return lb ? { l: lb.l, r: lb.l + lb.w } : null;
  };
  const inCount = new Map<string, number>();
  const outCount = new Map<string, number>();
  for (const f of flows) {
    inCount.set(f.to, (inCount.get(f.to) ?? 0) + 1);
    outCount.set(f.from, (outCount.get(f.from) ?? 0) + 1);
  }
  const detours = new Map<string, number>();
  const detourOffset = (lane: string | undefined, side: "l" | "r") => {
    const key = `${lane}:${side}`;
    const n = detours.get(key) ?? 0;
    detours.set(key, n + 1);
    return 16 + n * 10;
  };

  for (const f of flows) {
    const a = rectOf.get(f.from);
    const b = rectOf.get(f.to);
    if (!a || !b) continue;
    const aRow = rows.get(f.from) ?? 0;
    const bRow = rows.get(f.to) ?? 0;
    const sameLane = laneOf.get(f.from) === laneOf.get(f.to);
    const sameCol = sameLane && sameOff(f.from, f.to);
    let pts: number[][];

    if (sameCol) {
      const blockers = steps.filter(
        (s) =>
          s.laneId === laneOf.get(f.from) &&
          sameOff(s.id, f.from) &&
          (rows.get(s.id) ?? 0) > Math.min(aRow, bRow) &&
          (rows.get(s.id) ?? 0) < Math.max(aRow, bRow),
      );
      const lane = laneRect(laneOf.get(f.from));
      if (!blockers.length && bRow > aRow) {
        pts = [
          [a.cx, a.b],
          [a.cx, b.t],
        ];
      } else if (isGateway(typeOf.get(f.from) ?? "") && bRow > aRow) {
        let xr = Math.max(a.r, b.r);
        for (const s of blockers) xr = Math.max(xr, rectOf.get(s.id)?.r ?? xr);
        const off = detourOffset(laneOf.get(f.from), "r");
        xr = Math.min(xr + off, lane ? lane.r - 4 : xr + off);
        const y0 = a.b + 12;
        pts = [
          [a.cx, a.b],
          [a.cx, y0],
          [xr, y0],
          [xr, b.cy],
          [b.r, b.cy],
        ];
      } else {
        let x0 = Math.min(a.l, b.l);
        for (const s of blockers) x0 = Math.min(x0, rectOf.get(s.id)?.l ?? x0);
        const off = detourOffset(laneOf.get(f.from), "l");
        x0 = Math.max(x0 - off, lane ? lane.l + 4 : x0 - off);
        pts = [
          [a.l, a.cy],
          [x0, a.cy],
          [x0, b.cy],
          [b.l, b.cy],
        ];
      }
    } else if (aRow === bRow) {
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
      const toRight = b.cx > a.cx;
      pts = [
        [toRight ? a.r : a.l, a.cy],
        [b.cx, a.cy],
        [b.cx, b.t],
      ];
    } else if (bRow <= aRow) {
      const lane = laneRect(laneOf.get(f.from));
      const xl = lane ? lane.l + 12 : a.l - 16;
      const ex = b.cx > xl ? b.l : b.r;
      pts = [
        [a.l, a.cy],
        [xl, a.cy],
        [xl, b.cy],
        [ex, b.cy],
      ];
    } else {
      const between = (id: string) =>
        steps.some((s) => {
          const r = rows.get(s.id) ?? 0;
          return s.laneId === laneOf.get(id) && sameOff(s.id, id) && r > aRow && r < bRow;
        });
      const sy = a.b;
      const ey = b.t;
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
    const fromId = shapeOf.get(f.from);
    const toId = shapeOf.get(f.to);
    if (fromId == null || toId == null) continue;
    page.line(pts, {
      dashed: f.kind === "MESSAGE",
      label: f.label,
      labelAt: f.label ? labelPoint(pts) : undefined,
      from: fromId,
      to: toId,
    });
  }

  for (const d of docLines) {
    const pts =
      d.dir === "in"
        ? [
            [d.doc.l, d.doc.cy],
            [d.from.r, d.doc.cy],
          ]
        : [
            [d.from.r, d.doc.cy],
            [d.doc.l, d.doc.cy],
          ];
    page.line(pts, d.dir === "in" ? { dashed: true, from: d.docId, to: d.fromId } : { dashed: true, from: d.fromId, to: d.docId });
  }
  for (const s of sharedLines) {
    const src = docRect.get(s.source);
    if (!src) continue;
    const doc = src.rect;
    page.line(
      [
        [doc.cx, doc.b],
        [doc.cx, s.to.cy],
        [s.to.r, s.to.cy],
      ],
      { dashed: true, from: src.id, to: s.toId },
    );
  }

  return packVsdx(input.title, pageW * PX, pageH * PX, page);
}

function packVsdx(title: string, wIn: number, hIn: number, page: Page) {
  const tpl = (f: string) => fs.readFileSync(path.join(process.cwd(), "src", "lib", "visio", "template", f), "utf8");
  const pageName = title.slice(0, 31) || "Diagram";

  const pageXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xml:space="preserve"><Shapes>${page.shapes.join("")}</Shapes>${
    page.connects.length ? `<Connects>${page.connects.join("")}</Connects>` : ""
  }</PageContents>`;

  const pagesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xml:space="preserve"><Page ID="0" NameU="${esc(pageName)}" Name="${esc(pageName)}" ViewScale="-1" ViewCenterX="${+(wIn / 2).toFixed(4)}" ViewCenterY="${+(hIn / 2).toFixed(4)}"><PageSheet LineStyle="0" FillStyle="0" TextStyle="0">${cell("PageWidth", wIn)}${cell("PageHeight", hIn)}${cell("ShdwOffsetX", 0.118)}${cell("ShdwOffsetY", -0.118)}${cell("PageScale", 1, ' U="IN_F"')}${cell("DrawingScale", 1, ' U="IN_F"')}${cell("DrawingSizeType", 0)}${cell("DrawingScaleType", 0)}${cell("InhibitSnap", 0)}${cell("PrintPageOrientation", wIn > hIn ? 2 : 1)}${cell("PageShapeSplit", 1)}</PageSheet><Rel r:id="rId1"/></Page></Pages>`;

  const files = [
    {
      path: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/><Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/><Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/><Override PartName="/visio/windows.xml" ContentType="application/vnd.ms-visio.windows+xml"/><Override PartName="/visio/masters/masters.xml" ContentType="application/vnd.ms-visio.masters+xml"/><Override PartName="/visio/masters/master1.xml" ContentType="application/vnd.ms-visio.master+xml"/><Override PartName="/visio/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/visio/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
    },
    {
      path: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/document" Target="visio/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
    },
    {
      path: "docProps/core.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>Corner IQ</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`,
    },
    {
      path: "docProps/app.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft Visio</Application><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Pages</vt:lpstr></vt:variant><vt:variant><vt:i4>1</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="1" baseType="lpstr"><vt:lpstr>${esc(pageName)}</vt:lpstr></vt:vector></TitlesOfParts><AppVersion>16.0000</AppVersion></Properties>`,
    },
    { path: "visio/document.xml", data: tpl("document.xml") },
    {
      path: "visio/_rels/document.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme2.xml"/><Relationship Id="rId4" Type="http://schemas.microsoft.com/visio/2010/relationships/windows" Target="windows.xml"/><Relationship Id="rId5" Type="http://schemas.microsoft.com/visio/2010/relationships/masters" Target="masters/masters.xml"/></Relationships>`,
    },
    // Visios eget "Dynamic connector"-master, som pilene bygger på.
    { path: "visio/masters/masters.xml", data: tpl("masters.xml") },
    { path: "visio/masters/master1.xml", data: tpl("connector-master.xml") },
    {
      path: "visio/masters/_rels/masters.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="master1.xml"/></Relationships>`,
    },
    {
      path: "visio/pages/_rels/page1.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="../masters/master1.xml"/></Relationships>`,
    },
    // Visio nægter at åbne en pakke uden vinduesopsætning.
    {
      path: "visio/windows.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Windows ClientWidth="1200" ClientHeight="800" xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xml:space="preserve"><Window ID="0" WindowType="Drawing" WindowState="1073741824" WindowLeft="0" WindowTop="0" WindowWidth="1200" WindowHeight="800" ContainerType="Page" Page="0" ViewScale="-1" ViewCenterX="${+(wIn / 2).toFixed(4)}" ViewCenterY="${+(hIn / 2).toFixed(4)}"><ShowRulers>1</ShowRulers><ShowGrid>0</ShowGrid><ShowPageBreaks>0</ShowPageBreaks><ShowGuides>1</ShowGuides><ShowConnectionPoints>1</ShowConnectionPoints><GlueSettings>9</GlueSettings><SnapSettings>65847</SnapSettings><SnapExtensions>34</SnapExtensions><SnapAngles/><DynamicGridEnabled>1</DynamicGridEnabled><TabSplitterPos>0.5</TabSplitterPos></Window></Windows>`,
    },
    { path: "visio/theme/theme1.xml", data: tpl("theme1.xml") },
    { path: "visio/theme/theme2.xml", data: tpl("theme2.xml") },
    { path: "visio/pages/pages.xml", data: pagesXml },
    {
      path: "visio/pages/_rels/pages.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/page" Target="page1.xml"/></Relationships>`,
    },
    { path: "visio/pages/page1.xml", data: pageXml },
  ];
  return zip(files);
}

import { isGateway, isStart, isStartOrEnd } from "@/lib/domain";
import { docsLifted, layoutGrid, sharedDocs } from "@/lib/swimlane-layout";
import { labelPoint, routeFlows, type Rect } from "@/lib/swimlane-routing";
import { zip } from "@/lib/zip";
import {
  placeConnector,
  placeInstance,
  stencil,
  stencilFile,
  stencilMasterFiles,
  type GluePoints,
  type Side,
  type StencilKey,
} from "./stencil";

/*
  Et svimlanediagram som Visio-fil (.vsdx) — samme opbygning som diagrammet
  i appen: pools side om side med titel øverst, lodrette svimlaner, ét skridt
  pr. række (lib/swimlane-layout), dokumenter til højre for aktiviteten.

  Aktiviteter, start/slut, timere, gateways og pile er figurerne fra
  Cornerstones' stencil (lib/visio/stencil.ts), så diagrammet kan arbejdes
  videre med i Visio som ethvert andet procesdiagram. Pools, svimlaner og
  dokumenter findes ikke i stencilet og tegnes som almindelige figurer —
  pools og svimlaner som Visio-containere (skridt og dokumenter er
  medlemmer), og gateway-/timertekster som callouts til deres figur, så de
  følger med, når man flytter rundt (se Page.contain/callout).

  Pilene lægges efter samme regler som i SwimlaneDiagram.tsx og limes til
  figurerne, så de følger med, når man flytter rundt i Visio.
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
// Stencilets mål (px): Activity er gemt 150 px bred som boksen i appen (se
// scripts/visio/build-stencil-template.ps1) og findes i fire højder.
const TASK_W = 150;
const TASK_HEIGHTS = [76, 100, 124, 148];
const GW_W = 47.2;
const GW_H = 37.8;
const EVENT_D = 37.8;
const DOC_W = 90;
const DOC_H = 50;

const INK = "#241c17";
const MUTED = "#6b5a4c";
const PAPER = "#ffffff";

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

// Den side af figuren, et punkt på ruten ligger nærmest (px, y nedad).
function nearestSide([x, y]: number[], b: Rect): Side {
  const d: [Side, number][] = [
    ["t", Math.abs(y - b.t)],
    ["b", Math.abs(y - b.b)],
    ["l", Math.abs(x - b.l)],
    ["r", Math.abs(x - b.r)],
  ];
  return d.reduce((m, c) => (c[1] < m[1] ? c : m))[0];
}

/*
  Flyt rutens første punkt til midten af siden. Står det allerede der, eller
  ligger næste punkt på samme linje ud fra midten, er der intet at gøre;
  ellers lægges et knæk midt imellem, så pilen stadig går vinkelret ud.
*/
function snapToMiddle(pts: number[][], side: Side, b: Rect, upper = false) {
  const mid =
    side === "t" ? [b.cx, b.t] : side === "b" ? [b.cx, b.b] : side === "l" ? [b.l, b.cy] : [b.r, upper ? b.t + (b.b - b.t) / 4 : b.cy];
  const [p, n] = pts;
  if (Math.abs(p[0] - mid[0]) < 0.5 && Math.abs(p[1] - mid[1]) < 0.5) return pts;
  const vertical = side === "t" || side === "b";
  if (!n) return [mid];
  if (vertical ? Math.abs(n[0] - mid[0]) < 0.5 : Math.abs(n[1] - mid[1]) < 0.5) return [mid, ...pts.slice(1)];
  // Knækket midt imellem siden og næste punkt, vinkelret ud fra siden.
  const knee = vertical
    ? [
        [mid[0], (mid[1] + n[1]) / 2],
        [n[0], (mid[1] + n[1]) / 2],
      ]
    : [
        [(mid[0] + n[0]) / 2, mid[1]],
        [(mid[0] + n[0]) / 2, n[1]],
      ];
  return [mid, ...knee, ...pts.slice(1)];
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
  // Et hoved af denne højde (px) med streg under — pool- og svimlanetitlen.
  headLine?: number;
  // Kun hovedet og kanten kan gribes; resten er gennemsigtigt, så man kan
  // klikke og trække en markering om skridtene uden at tage svimlanen med.
  hollow?: boolean;
  // Visios egne strukturtyper: en container (pool, svimlane) eller en callout
  // (dokument, gatewaytekst), der følger den figur, den hører til.
  structure?: "Container" | "Callout";
  // Forbindelsespunkter midt på hver side, så pile kan limes til figuren.
  connections?: boolean;
};

class Page {
  shapes = new Map<number, string>();
  connects: string[] = [];
  rels = new Map<number, Map<number, number[]>>();
  id = 1;
  constructor(public height: number) {}

  /*
    Relationerne skrives præcis som Visio selv gemmer dem (Relationships-
    cellen): en container kender sine medlemmer (1) og et medlem sin
    container (4); en figur kender sine callouts (3) og en callout sin figur
    (6). Så flytter Visio svimlanens skridt med, når man trækker i
    svimlanen, og dokumenter/gatewaytekster følger deres figur.
  */
  private relate(from: number, type: number, to: number) {
    const byType = this.rels.get(from) ?? new Map<number, number[]>();
    byType.set(type, [...(byType.get(type) ?? []), to]);
    this.rels.set(from, byType);
  }
  contain(container: number, member: number) {
    this.relate(container, 1, member);
    this.relate(member, 4, container);
  }
  callout(target: number, callout: number) {
    this.relate(target, 3, callout);
    this.relate(callout, 6, target);
  }

  xml() {
    return [...this.shapes]
      .map(([id, xml]) => {
        const byType = this.rels.get(id);
        if (!byType) return xml;
        const deps = [...byType].map(([type, ids]) => `DEPENDSON(${type},${ids.map((i) => `Sheet.${i}!SheetRef()`).join(",")})`);
        return xml.replace(/^(<Shape\b[^>]*>)/, `$1<Cell N="Relationships" V="0" F="SUM(${deps.join(",")})"/>`);
      })
      .join("");
  }

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
    let geom = this.geometry(o.geom ?? "rect", W, H, o.fill === null || !!o.hollow, o.line === 0);
    if (o.headLine) {
      const y = H - o.headLine * PX;
      const head = [
        [0, y],
        [W, y],
        [W, H],
        [0, H],
        [0, y],
      ]
        .map(([px, py], i) => `<Row T="${i ? "LineTo" : "MoveTo"}" IX="${i + 1}">${cell("X", px)}${cell("Y", py)}</Row>`)
        .join("");
      geom += `<Section N="Geometry" IX="1">${cell("NoFill", o.fill === null ? 1 : 0)}${cell("NoLine", 0)}${cell("NoShow", 0)}${cell("NoSnap", 0)}${head}</Section>`;
    }
    const user = o.structure
      ? `<Section N="User"><Row N="msvStructureType"><Cell N="Value" V="${o.structure}" U="STR"/><Cell N="Prompt" V=""/></Row></Section>`
      : "";
    const connections = o.connections
      ? `<Section N="Connection">${[
          [0.5, 1],
          [1, 0.5],
          [0.5, 0],
          [0, 0.5],
        ]
          .map(
            ([fx, fy], i) =>
              `<Row T="Connection" IX="${i}"><Cell N="X" V="${+(W * fx).toFixed(6)}" F="Width*${fx}"/><Cell N="Y" V="${+(H * fy).toFixed(6)}" F="Height*${fy}"/>${cell("DirX", 0)}${cell("DirY", 0)}${cell("Type", 0)}${cell("AutoGen", 0)}</Row>`,
          )
          .join("")}</Section>`
      : "";
    const text =
      o.text || o.extraText
        ? `<Text><cp IX="0"/><pp IX="0"/>${esc(o.text ?? "")}${o.extraText ? `\n<cp IX="1"/>${esc(o.extraText.text)}` : ""}</Text>`
        : "";
    // Punkterne står i rækkefølgen top, højre, bund, venstre (se ovenfor).
    if (o.connections) this.glue.set(id, { sheet: id, ix: { t: 0, r: 1, b: 2, l: 3 } });
    // Navne skal være unikke på siden — Visios egen form er "Navn.ID".
    this.shapes.set(
      id,
      `<Shape ID="${id}" Type="Shape" LineStyle="3" FillStyle="3" TextStyle="3"${o.name ? ` NameU="${esc(o.name)}.${id}" Name="${esc(o.name)}.${id}"` : ""}>${cells.join("")}${user}<Section N="Character">${chars.join("")}</Section>${para}${connections}${geom}${text}</Shape>`,
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

  // En figur fra Cornerstones' stencil (se lib/visio/stencil.ts), placeret i px.
  stencil(key: StencilKey, o: { name: string; x: number; y: number; text?: string; bpmnName?: string; textBelow?: { w: number; h: number; above?: boolean } }) {
    const r = placeInstance(key, () => this.id++, { ...o, x: this.X(o.x), y: this.Y(o.y) });
    this.shapes.set(r.id, r.xml);
    this.glue.set(r.id, r.glue);
    return r.id;
  }

  // Punkterne midt på hver side, som pilene limes til (se lib/visio/stencil.ts).
  glue = new Map<number, GluePoints>();

  /*
    En pil fra stencilet — Sequence Flow, eller Message Flow mellem pools —
    limet til punktet midt på den side af hver figur, ruten går ud og ind
    ad, så enderne bliver midt på siden, også når man flytter rundt i Visio.
    Punkterne (px) er ruten fra appen; står en ende ikke midt på siden
    (fx en dokumentpil i dokumentets højde), flyttes den derhen med et knæk.
    Dokumentpile er stiplede sekvenspile.
  */
  line(
    route: number[][],
    o: {
      message?: boolean;
      dashed?: boolean;
      label?: string | null;
      labelAt?: { x: number; y: number };
      from: number;
      to: number;
      fromBox: Rect;
      toBox: Rect;
      // Enden ved aktiviteten øverst på højre side i stedet for midt på (se GluePoint).
      upperRight?: "from" | "to";
    },
  ) {
    let pts = route.map((p) => [...p]);
    const fromSide = nearestSide(pts[0], o.fromBox);
    const toSide = nearestSide(pts[pts.length - 1], o.toBox);
    const upper = (which: "from" | "to", side: Side, shape: number) =>
      o.upperRight === which && side === "r" && this.glue.get(shape)?.ix.ru != null;
    const fromUpper = upper("from", fromSide, o.from);
    const toUpper = upper("to", toSide, o.to);
    pts = snapToMiddle(pts, fromSide, o.fromBox, fromUpper);
    pts = snapToMiddle(pts.reverse(), toSide, o.toBox, toUpper).reverse();
    const end = (shape: number, side: Side, up: boolean) => {
      const g = this.glue.get(shape);
      if (!g) throw new Error(`Figur ${shape} har ingen forbindelsespunkter`);
      return { sheet: g.sheet, ix: up ? g.ix.ru! : g.ix[side] };
    };
    const r = placeConnector(o.message ? "REF_MSG" : "REF_SEQ", () => this.id++, {
      name: o.message ? "Message Flow" : "Sequence Flow",
      pts: pts.map(([x, y]) => [this.X(x), this.Y(y)]),
      from: end(o.from, fromSide, fromUpper),
      to: end(o.to, toSide, toUpper),
      label: o.label,
      labelAt: o.labelAt ? [this.X(o.labelAt.x), this.Y(o.labelAt.y)] : undefined,
      dashed: o.dashed,
    });
    this.shapes.set(r.id, r.xml);
    this.connects.push(...r.connects);
    return r.id;
  }
}

// Aktivitetens tekst (navn og [systemer]) og den stencil-højde, den kræver.
function taskBox(s: { name: string; systems: string[] }) {
  const sys = s.systems.length ? `[${s.systems.join(", ")}]` : "";
  const text = sys ? `${s.name}\n${sys}` : s.name;
  const need = 16 + lineCount(text, TASK_W - 10, 6.2) * 14;
  const h = TASK_HEIGHTS.find((th) => th >= need) ?? TASK_HEIGHTS[TASK_HEIGHTS.length - 1];
  return { text, h };
}

export function buildSubProcessVsdx(input: VisioInput): Uint8Array {
  const { steps, flows } = input;
  const visibleLanes = input.lanes.filter(
    (l) => !l.isDefault || steps.some((s) => s.laneId === l.id) || input.lanes.length === 1,
  );
  const { rows, offs } = layoutGrid(steps, flows);
  const rowCount = Math.max(1, ...rows.values());
  // Rækkerne skal være høje nok til den højeste aktivitet.
  const rowH = Math.max(ROW_H, ...steps.filter((s) => s.type === "TASK").map((s) => taskBox(s).h + 32));
  const bodyH = TOP_PAD + rowCount * rowH + BOTTOM_PAD;

  const poolBoxes = [
    { name: input.title, lanes: visibleLanes.filter((l) => !l.poolId || !input.pools.some((p) => p.id === l.poolId)) },
    ...input.pools.map((p) => ({ name: p.name, lanes: visibleLanes.filter((l) => l.poolId === p.id) })),
  ];

  // Vandret opmåling: pools side om side, svimlanerne så brede som deres
  // yderste skridt kræver.
  type LaneBox = { id: string; name: string; pool: number; l: number; w: number; minOff: number; colW: number; hasDocs: boolean; shapeId: number };
  const laneBoxes: LaneBox[] = [];
  const poolRects: { name: string; l: number; w: number }[] = [];
  let x = MARGIN;
  for (const [poolIx, pool] of poolBoxes.entries()) {
    const start = x;
    if (pool.lanes.length === 0) x += 180;
    for (const lane of pool.lanes) {
      const ls = steps.filter((s) => s.laneId === lane.id);
      const hasDocs = ls.some((s) => s.data.length > 0);
      const o = ls.map((s) => offs.get(s.id) ?? 0);
      const minOff = o.length ? Math.min(...o) : 0;
      const maxOff = o.length ? Math.max(...o) : 0;
      // Skridtene står midt i deres kolonne; med dokumenter skal der være
      // plads til dem til højre for en centreret aktivitet.
      const colW = hasDocs ? 2 * (TASK_W / 2 + 22 + DOC_W + 16) : 210;
      const w = colW * (maxOff - minOff + 1);
      laneBoxes.push({ id: lane.id, name: lane.name, pool: poolIx, l: x, w, minOff, colW, hasDocs, shapeId: 0 });
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

  // Pools og svimlaner (tegnes først, så de ligger bagerst) — som Visio-
  // containere med titlen i hovedet, så en svimlane tager sine skridt med,
  // når man flytter den, og et skridt skifter svimlane, når man trækker det over.
  const poolIds = poolRects.map((p) => {
    const h = POOL_HEAD + LANE_HEAD + bodyH;
    return page.shape({
      x: p.l + p.w / 2, y: top + h / 2, w: p.w, h, line: 1.5, fill: PAPER,
      text: p.name, size: 12, bold: true, align: 0, textBox: { x: 0, y: 0, w: p.w, h: POOL_HEAD }, headLine: POOL_HEAD, hollow: true,
      structure: "Container", name: "Pool",
    });
  });
  for (const lb of laneBoxes) {
    const h = LANE_HEAD + bodyH;
    lb.shapeId = page.shape({
      x: lb.l + lb.w / 2, y: top + POOL_HEAD + h / 2, w: lb.w, h, line: 0.75, fill: PAPER,
      text: lb.name, size: 10, bold: true, textBox: { x: 0, y: 0, w: lb.w, h: LANE_HEAD }, headLine: LANE_HEAD, hollow: true,
      structure: "Container", name: "Svimlane",
    });
    page.contain(poolIds[lb.pool], lb.shapeId);
  }

  // Skridtene.
  const laneById = new Map(laneBoxes.map((l) => [l.id, l]));
  const shapeOf = new Map<string, number>();
  const rectOf = new Map<string, Rect>();
  const R = (cx: number, cy: number, w: number, h: number): Rect => ({ l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2, cx, cy });
  const docLines: { from: Rect; fromId: number; doc: Rect; docId: number; dir: "in" | "out"; lifted: boolean }[] = [];
  const docRect = new Map<string, { rect: Rect; id: number }>();
  const sharedLines: { to: Rect; toId: number; source: string }[] = [];
  const shared = sharedDocs(steps, rows, offs);
  const lifted = docsLifted(steps, flows, rows, laneBoxes.map((l) => l.id));

  for (const s of steps) {
    const lb = laneById.get(s.laneId);
    if (!lb) continue;
    const cellL = lb.l + ((offs.get(s.id) ?? 0) - lb.minOff) * lb.colW;
    const cx = cellL + lb.colW / 2;
    const cy = bodyTop + TOP_PAD + ((rows.get(s.id) ?? 1) - 1) * rowH + rowH / 2;

    if (isStartOrEnd(s.type)) {
      const start = isStart(s.type);
      // Stencilets Start-End — til en start på et fast tidspunkt med
      // udløseren "Timer" (uret i ringen).
      const lines = lineCount(s.name, 140, 5.6);
      // Start har teksten over ringen (pilen går ud i bunden), slut under.
      const cyC = start ? cy + 10 : cy - 12;
      const id = page.stencil(s.type === "TIMER_START" ? "REF_START_TIMER" : start ? "REF_START" : "REF_END", {
        name: start ? "Start" : "Slut",
        x: cx, y: cyC, text: s.name, bpmnName: s.name,
        textBelow: { w: Math.min(140, s.name.length * 5.6 + 10) * PX, h: lines * 13 * PX, above: start },
      });
      page.contain(lb.shapeId, id);
      shapeOf.set(s.id, id);
      rectOf.set(s.id, R(cx, cyC, EVENT_D, EVENT_D));
    } else if (isGateway(s.type)) {
      const key = s.type === "PARALLEL" ? "REF_GW_P" : s.type === "INCLUSIVE" ? "REF_GW_O" : s.type === "EVENT_GATEWAY" ? "REF_GW_E" : "REF_GW_X";
      // Den hændelsesbaserede har sit eget mærke; stencilets "X" er gruppens tekst og skal væk.
      const id = page.stencil(key, { name: "Gateway", x: cx, y: cy, text: s.type === "EVENT_GATEWAY" ? "" : undefined });
      page.contain(lb.shapeId, id);
      if (s.name) {
        const label = page.shape({ x: cx + GW_W / 2 + 8 + 56, y: cy, w: 112, h: 40, geom: "none", line: 0, fill: null, text: s.name, size: 8.5, color: MUTED, align: 0, structure: "Callout", name: "Gatewaytekst" });
        page.callout(id, label);
      }
      shapeOf.set(s.id, id);
      rectOf.set(s.id, R(cx, cy, GW_W, GW_H));
    } else if (s.type === "TIMER") {
      const id = page.stencil("REF_TIMER", { name: "Timer", x: cx, y: cy });
      page.contain(lb.shapeId, id);
      if (s.name) {
        const label = page.shape({ x: cx + EVENT_D / 2 + 8 + 56, y: cy, w: 112, h: 40, geom: "none", line: 0, fill: null, text: s.name, size: 8.5, color: MUTED, align: 0, structure: "Callout", name: "Timertekst" });
        page.callout(id, label);
      }
      shapeOf.set(s.id, id);
      rectOf.set(s.id, R(cx, cy, EVENT_D, EVENT_D));
    } else {
      // Stencilets Activity i den laveste af de fire højder, teksten kan være i.
      const sys = s.systems.length ? `[${s.systems.join(", ")}]` : "";
      const text = sys ? `${s.name}\n${sys}` : s.name;
      const need = 16 + lineCount(text, TASK_W - 10, 6.2) * 14;
      const h = TASK_HEIGHTS.find((th) => th >= need) ?? TASK_HEIGHTS[TASK_HEIGHTS.length - 1];
      const id = page.stencil(`REF_TASK_${h}` as StencilKey, { name: "Aktivitet", x: cx, y: cy, text });
      page.contain(lb.shapeId, id);
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
        // Et almindeligt medlem af svimlanen — ikke en callout, for Visio
        // limer ikke pile til callouts, og så følger pilen ikke dokumentet.
        const docId = page.shape({ x: dcx, y: dcy, w: DOC_W, h: DOC_H, geom: "doc", line: 1, text: d.name, size: 8.5, connections: true, name: "Dokument" });
        page.contain(lb.shapeId, docId);
        const doc = R(dcx, dcy, DOC_W, DOC_H);
        docRect.set(`${s.id}:${i}`, { rect: doc, id: docId });
        docLines.push({ from: act, fromId: id, doc, docId, dir: d.dir, lifted: lifted.has(s.id) });
      });
      s.data.forEach((_, i) => {
        const source = shared.get(`${s.id}:${i}`);
        if (source) sharedLines.push({ to: act, toId: id, source });
      });
    }
  }

  // Pilene — samme regler som SwimlaneDiagram.tsx (lib/swimlane-routing).
  const routes = routeFlows({
    steps,
    flows,
    rows,
    offs,
    rect: (id) => rectOf.get(id),
    laneRect: (id) => {
      const lb = laneById.get(id);
      return lb ? { l: lb.l, r: lb.l + lb.w } : undefined;
    },
  });
  flows.forEach((f, i) => {
    const pts = routes[i];
    const fromId = shapeOf.get(f.from);
    const toId = shapeOf.get(f.to);
    if (!pts || fromId == null || toId == null) return;
    page.line(pts, {
      message: f.kind === "MESSAGE",
      label: f.label,
      labelAt: f.label ? labelPoint(pts) : undefined,
      from: fromId,
      to: toId,
      fromBox: rectOf.get(f.from)!,
      toBox: rectOf.get(f.to)!,
    });
  });

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
    page.line(
      pts,
      d.dir === "in"
        ? { dashed: true, from: d.docId, to: d.fromId, fromBox: d.doc, toBox: d.from, upperRight: d.lifted ? "to" : undefined }
        : { dashed: true, from: d.fromId, to: d.docId, fromBox: d.from, toBox: d.doc, upperRight: d.lifted ? "from" : undefined },
    );
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
      { dashed: true, from: src.id, to: s.toId, fromBox: doc, toBox: s.to },
    );
  }

  return packVsdx(input.title, pageW * PX, pageH * PX, page);
}

function packVsdx(title: string, wIn: number, hIn: number, page: Page) {
  const masterFiles = stencilMasterFiles();
  const pageName = title.slice(0, 31) || "Diagram";

  const pageXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<PageContents xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xml:space="preserve"><Shapes>${page.xml()}</Shapes>${
    page.connects.length ? `<Connects>${page.connects.join("")}</Connects>` : ""
  }</PageContents>`;

  const pagesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Pages xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xml:space="preserve"><Page ID="0" NameU="${esc(pageName)}" Name="${esc(pageName)}" ViewScale="-1" ViewCenterX="${+(wIn / 2).toFixed(4)}" ViewCenterY="${+(hIn / 2).toFixed(4)}"><PageSheet LineStyle="0" FillStyle="0" TextStyle="0">${cell("PageWidth", wIn)}${cell("PageHeight", hIn)}${cell("ShdwOffsetX", 0.118)}${cell("ShdwOffsetY", -0.118)}${cell("PageScale", 1, ' U="IN_F"')}${cell("DrawingScale", 1, ' U="IN_F"')}${cell("DrawingSizeType", 0)}${cell("DrawingScaleType", 0)}${cell("InhibitSnap", 0)}${cell("PrintPageOrientation", wIn > hIn ? 2 : 1)}${cell("PageShapeSplit", 1)}${stencil().layers}</PageSheet><Rel r:id="rId1"/></Page></Pages>`;

  const files = [
    {
      path: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/><Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/><Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/><Override PartName="/visio/windows.xml" ContentType="application/vnd.ms-visio.windows+xml"/><Override PartName="/visio/masters/masters.xml" ContentType="application/vnd.ms-visio.masters+xml"/>${masterFiles.map((m) => `<Override PartName="/visio/masters/${m}" ContentType="application/vnd.ms-visio.master+xml"/>`).join("")}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`,
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
    // Stilark og masters fra Cornerstones' stencil (lib/visio/stencil).
    { path: "visio/document.xml", data: stencilFile("document.xml") },
    {
      path: "visio/_rels/document.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/visio/2010/relationships/pages" Target="pages/pages.xml"/><Relationship Id="rId4" Type="http://schemas.microsoft.com/visio/2010/relationships/windows" Target="windows.xml"/><Relationship Id="rId5" Type="http://schemas.microsoft.com/visio/2010/relationships/masters" Target="masters/masters.xml"/></Relationships>`,
    },
    { path: "visio/masters/masters.xml", data: stencilFile("masters/masters.xml") },
    { path: "visio/masters/_rels/masters.xml.rels", data: stencilFile("masters/_rels/masters.xml.rels") },
    ...masterFiles.map((m) => ({ path: `visio/masters/${m}`, data: stencilFile(`masters/${m}`) })),
    {
      path: "visio/pages/_rels/page1.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${masterFiles.map((m, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.microsoft.com/visio/2010/relationships/master" Target="../masters/${m}"/>`).join("")}</Relationships>`,
    },
    // Visio nægter at åbne en pakke uden vinduesopsætning.
    {
      path: "visio/windows.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Windows ClientWidth="1200" ClientHeight="800" xmlns="http://schemas.microsoft.com/office/visio/2012/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xml:space="preserve"><Window ID="0" WindowType="Drawing" WindowState="1073741824" WindowLeft="0" WindowTop="0" WindowWidth="1200" WindowHeight="800" ContainerType="Page" Page="0" ViewScale="-1" ViewCenterX="${+(wIn / 2).toFixed(4)}" ViewCenterY="${+(hIn / 2).toFixed(4)}"><ShowRulers>1</ShowRulers><ShowGrid>0</ShowGrid><ShowPageBreaks>0</ShowPageBreaks><ShowGuides>1</ShowGuides><ShowConnectionPoints>1</ShowConnectionPoints><GlueSettings>9</GlueSettings><SnapSettings>65847</SnapSettings><SnapExtensions>34</SnapExtensions><SnapAngles/><DynamicGridEnabled>1</DynamicGridEnabled><TabSplitterPos>0.5</TabSplitterPos></Window></Windows>`,
    },
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

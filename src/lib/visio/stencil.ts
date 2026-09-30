import fs from "node:fs";
import path from "node:path";

/*
  Figurerne fra Cornerstones' stencil ("Process Diagram - Stencil.vssx"),
  sådan som Visio selv har gemt dem (se scripts/visio). En figur kopieres
  ind på siden med nye ID'er, et unikt navn, ny placering og ny tekst —
  resten står præcis som Visio skrev det, fordi figurerne er formelstyrede
  grupper, som Visio ikke regner om, når filen åbnes.
*/

export type StencilKey =
  | "REF_START"
  | "REF_START_TIMER"
  | "REF_END"
  | "REF_TIMER"
  | "REF_TASK_76"
  | "REF_TASK_100"
  | "REF_TASK_124"
  | "REF_TASK_148"
  | "REF_GW_X"
  | "REF_GW_P"
  | "REF_GW_O"
  | "REF_GW_E"
  | "REF_SEQ"
  | "REF_MSG";

const DIR = path.join(process.cwd(), "src", "lib", "visio", "stencil");
let cache: { layers: string; instances: Record<string, string> } | null = null;
// Filerne indlejret i stedet for læst fra DIR — procesdiagram-skillens script
// har dem med sig (se scripts/skill/build-procesdiagram.ts).
let embedded: Record<string, string> | null = null;

export function setStencilFiles(files: Record<string, string>) {
  embedded = files;
  cache = null;
}

export function stencilFile(rel: string) {
  if (!embedded) return fs.readFileSync(path.join(DIR, rel), "utf8");
  const f = embedded[rel];
  if (f == null) throw new Error(`Stencil-filen ${rel} mangler`);
  return f;
}

export function stencil() {
  if (!cache) cache = JSON.parse(stencilFile("instances.json"));
  return cache!;
}

export function stencilMasterFiles() {
  const names = embedded
    ? Object.keys(embedded).filter((k) => k.startsWith("masters/")).map((k) => k.slice(8))
    : fs.readdirSync(path.join(DIR, "masters"));
  return names
    .filter((f) => /^master\d+\.xml$/.test(f))
    .sort((a, b) => parseInt(a.slice(6)) - parseInt(b.slice(6)));
}

// Visio skriver attributter i enkelte anførselstegn.
export function escA(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&apos;").replace(/"/g, "&quot;");
}

const num = (v: number) => String(+v.toFixed(6));
// Start-End-figurens højde i stencilet (tommer).
const EVENT_H = 0.3937007874015748;

// Figurens egne celler står før dens underfigurer (<Shapes>); kun den del ændres.
function splitHead(xml: string) {
  const i = xml.indexOf("<Shapes>");
  return i < 0 ? [xml, ""] : [xml.slice(0, i), xml.slice(i)];
}

export function setCell(head: string, name: string, v: number | string, formula?: string) {
  const val = typeof v === "number" ? num(v) : escA(v);
  const re = new RegExp(`<Cell N='${name}' V='[^']*'([^>]*?)/>`);
  if (re.test(head)) {
    return head.replace(re, (_m, rest: string) => {
      const kept = formula == null ? rest : rest.replace(/ F='[^']*'/, "");
      return `<Cell N='${name}' V='${val}'${kept}${formula != null ? ` F='${escA(formula)}'` : ""}/>`;
    });
  }
  const cell = `<Cell N='${name}' V='${val}'${formula != null ? ` F='${escA(formula)}'` : " F='Inh'"}/>`;
  return head.replace(/^(<Shape\b[^>]*>)/, `$1${cell}`);
}

function setText(head: string, text: string | null) {
  const t = text == null ? "" : `<Text>${escA(text)}</Text>`;
  if (/<Text>[\s\S]*?<\/Text>/.test(head)) return head.replace(/<Text>[\s\S]*?<\/Text>/, t);
  if (text == null) return head;
  return head.replace(/(<\/Shape>)?$/, (m) => `${t}${m}`);
}

function setProp(head: string, row: string, value: string) {
  return head.replace(new RegExp(`(<Row N='${row}'><Cell N='Value' V=')[^']*(')`), `$1${escA(value)}$2`);
}

/*
  Kopiér en figur. alloc() giver næste ledige ID på siden. Navnet bliver
  "<name>.<id>" som Visio selv navngiver — navne skal være unikke på siden.
*/
export function cloneInstance(key: StencilKey, alloc: () => number, name: string) {
  let xml = stencil().instances[key];
  if (!xml) throw new Error(`Stencil-figuren ${key} mangler`);
  const map = new Map<string, string>();
  for (const m of xml.matchAll(/\bID='(\d+)'/g)) if (!map.has(m[1])) map.set(m[1], String(alloc()));
  xml = xml
    .replace(/\bID='(\d+)'/g, (_m, id: string) => `ID='${map.get(id)}'`)
    .replace(/Sheet\.(\d+)!/g, (m, id: string) => (map.has(id) ? `Sheet.${map.get(id)}!` : m))
    .replace(new RegExp(`NameU='${key}' IsCustomNameU='1' Name='${key}'`), `NameU='${escA(name)}' IsCustomNameU='1' Name='${escA(name)}'`)
    .replace(
      /<Shape ID='(\d+)' NameU='([^']*?)(?:\.\d+)?' IsCustomNameU='1' Name='[^']*'/g,
      (_m, id: string, base: string) => `<Shape ID='${id}' NameU='${base}.${id}' IsCustomNameU='1' Name='${base}.${id}'`,
    );
  const id = Number(map.values().next().value);
  return { id, xml, map };
}

/*
  Midten af hver side — de forbindelsespunkter pilene limes til. En figur
  fra stencilet har flere punkter pr. side (Activity: ved ¼, ½ og ¾), og
  limer man til hele figuren, vælger Visio frit mellem dem, når den lægger
  pilen om. Så pilene limes i stedet til punktet midt på siden.

  sheet er den figur punkterne sidder på: i Activity og Time event en
  gruppe inde i figuren, i de andre selve figuren. ix er punktets række
  (Connections.X<ix+1>).
*/
export type Side = "t" | "r" | "b" | "l";
// "ru": højre side, øverste fjerdedel — til dokumentpilen, når siden midt på
// allerede bruges af en vandret pil ud til højre (se docsLifted).
export type GluePoint = Side | "ru";
export type GluePoints = { sheet: number; ix: Record<Side, number> & { ru?: number } };

const sideOf: Record<string, GluePoint> = { "0.5,1": "t", "1,0.5": "r", "0.5,0": "b", "0,0.5": "l", "1,0.75": "ru" };
const masterPoints = new Map<string, { owner: string; top: boolean; ix: GluePoints["ix"] }>();

function pointsOfMaster(masterId: string) {
  const known = masterPoints.get(masterId);
  if (known) return known;
  const rid = stencilFile("masters/masters.xml").match(new RegExp(`<Master ID='${masterId}'[\\s\\S]*?<Rel r:id='(rId\\d+)'/>`))?.[1];
  const file = rid && stencilFile("masters/_rels/masters.xml.rels").match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1];
  if (!file) throw new Error(`Master ${masterId} findes ikke i stencilet`);
  const xml = stencilFile(`masters/${file}`);
  const at = xml.indexOf("<Section N='Connection'>");
  if (at < 0) throw new Error(`Master ${masterId} har ingen forbindelsespunkter`);
  const owner = [...xml.slice(0, at).matchAll(/<Shape ID='(\d+)'/g)].pop()![1];
  const top = xml.match(/<Shape ID='(\d+)'/)![1] === owner;
  const section = xml.slice(at, xml.indexOf("</Section>", at));
  const ix = {} as GluePoints["ix"];
  for (const m of section.matchAll(/IX='(\d+)'><Cell N='X' V='[^']*'(?: U='\w+')? F='Width\*([\d.]+)'\/><Cell N='Y' V='[^']*'(?: U='\w+')? F='Height\*([\d.]+)'/g)) {
    const side = sideOf[`${+m[2]},${+m[3]}`];
    if (side && ix[side] == null) ix[side] = Number(m[1]);
  }
  for (const s of ["t", "r", "b", "l"] as Side[]) if (ix[s] == null) throw new Error(`Master ${masterId} mangler et punkt midt på siden ${s}`);
  const info = { owner, top, ix };
  masterPoints.set(masterId, info);
  return info;
}

function gluePoints(xml: string, map: Map<string, string>, id: number): GluePoints {
  const masterId = xml.match(/^<Shape\b[^>]*\bMaster='(\d+)'/)![1];
  const p = pointsOfMaster(masterId);
  if (p.top) return { sheet: id, ix: p.ix };
  // Punkterne sidder på en figur inde i gruppen: den med MasterShape=owner.
  const inner = xml.match(new RegExp(`<Shape ID='(\\d+)'[^>]*\\bMasterShape='${p.owner}'`))?.[1];
  if (!inner) throw new Error(`Figuren med forbindelsespunkterne mangler i master ${masterId}`);
  return { sheet: Number(inner), ix: p.ix };
}

// Placér, navngiv og tekst — til figurerne (grupper).
export function placeInstance(
  key: StencilKey,
  alloc: () => number,
  o: { name: string; x: number; y: number; text?: string | null; bpmnName?: string; textBelow?: { w: number; h: number; above?: boolean } },
) {
  const { id, xml, map } = cloneInstance(key, alloc, o.name);
  const glue = gluePoints(xml, map, id);
  let [head, rest] = splitHead(xml);
  head = setCell(head, "PinX", o.x);
  head = setCell(head, "PinY", o.y);
  if (o.text !== undefined) head = setText(head, o.text);
  if (o.bpmnName != null) head = setProp(head, "BpmnName", o.bpmnName);
  if (o.textBelow) {
    // Teksten under en hændelse: blokkens mål skal passe til teksten, ellers
    // bruges den gemte bredde (fra ordet "Start") og teksten brydes pr. bogstav.
    head = setCell(head, "TxtWidth", o.textBelow.w);
    head = setCell(head, "TxtHeight", o.textBelow.h);
    head = setCell(head, "TxtLocPinX", o.textBelow.w / 2);
    head = setCell(head, "TxtLocPinY", o.textBelow.h / 2);
    // Over figuren i stedet, når en pil går ud i bunden (start).
    head = setCell(head, "TxtPinY", o.textBelow.above ? EVENT_H + o.textBelow.h / 2 : -o.textBelow.h / 2);
  }
  return { id, xml: head + rest, glue };
}

/*
  En pil fra stencilet (Sequence Flow / Message Flow), limet til punktet
  midt på en side af hver figur — skrevet præcis som Visio selv gemmer
  punktlim (PAR(PNT(...)) og en Connect til Connections.X<n>), så enden
  bliver siddende midt på siden, når figuren flyttes. Punkterne (tommer,
  Visios koordinater) er ruten fra appen; som i Visio regnes geometrien fra
  begin og er ikke drejet.
*/
export type GlueEnd = { sheet: number; ix: number };

export function placeConnector(
  key: "REF_SEQ" | "REF_MSG",
  alloc: () => number,
  o: { name: string; pts: number[][]; from: GlueEnd; to: GlueEnd; label?: string | null; labelAt?: number[]; dashed?: boolean },
) {
  const { id, xml } = cloneInstance(key, alloc, o.name);
  const [bx, by] = o.pts[0];
  const [ex, ey] = o.pts[o.pts.length - 1];
  let x = xml;
  x = setCell(x, "PinX", (bx + ex) / 2);
  x = setCell(x, "PinY", (by + ey) / 2);
  x = setCell(x, "Width", ex - bx, "GUARD(EndX-BeginX)");
  x = setCell(x, "Height", ey - by, "GUARD(EndY-BeginY)");
  x = setCell(x, "LocPinX", (ex - bx) / 2);
  x = setCell(x, "LocPinY", (ey - by) / 2);
  const pnt = (g: GlueEnd) => `PAR(PNT(Sheet.${g.sheet}!Connections.X${g.ix + 1},Sheet.${g.sheet}!Connections.Y${g.ix + 1}))`;
  x = setCell(x, "BeginX", bx, pnt(o.from));
  x = setCell(x, "BeginY", by, pnt(o.from));
  x = setCell(x, "EndX", ex, pnt(o.to));
  x = setCell(x, "EndY", ey, pnt(o.to));
  x = setCell(x, "BegTrigger", 2, `_XFTRIGGER(Sheet.${o.from.sheet}!EventXFMod)`);
  x = setCell(x, "EndTrigger", 2, `_XFTRIGGER(Sheet.${o.to.sheet}!EventXFMod)`);
  if (o.dashed) x = x.replace(/^(<Shape\b[^>]*>)/, "$1<Cell N='LinePattern' V='2'/>");

  const [lx, ly] = o.labelAt ? [o.labelAt[0] - bx, o.labelAt[1] - by] : [(ex - bx) / 2, (ey - by) / 2];
  const label = o.label ?? "";
  const tw = (label.length * 5.2 + 8) / 96;
  const th = 14 / 96;
  x = setCell(x, "TxtPinX", lx);
  x = setCell(x, "TxtPinY", ly);
  x = setCell(x, "TxtWidth", tw);
  x = setCell(x, "TxtHeight", th);
  x = setCell(x, "TxtLocPinX", tw / 2);
  x = setCell(x, "TxtLocPinY", th / 2);
  x = x.replace(
    /<Row N='TextPosition'>[\s\S]*?<\/Row>/,
    `<Row N='TextPosition'><Cell N='X' V='${num(lx)}'/><Cell N='Y' V='${num(ly)}'/><Cell N='XDyn' V='${num(lx)}' F='Inh'/><Cell N='YDyn' V='${num(ly)}' F='Inh'/><Cell N='XCon' V='0' F='Inh'/></Row>`,
  );
  x = setProp(x, "BpmnName", label);
  x = setText(x, o.label ? o.label : null);

  const rows = o.pts
    .map(([px, py], i) => `<Row T='${i ? "LineTo" : "MoveTo"}' IX='${i + 1}'><Cell N='X' V='${num(px - bx)}'/><Cell N='Y' V='${num(py - by)}'/></Row>`)
    .join("");
  x = x.replace(/<Section N='Geometry' IX='0'>[\s\S]*?<\/Section>/, `<Section N='Geometry' IX='0'>${rows}</Section>`);

  const connects = [
    `<Connect FromSheet='${id}' FromCell='BeginX' FromPart='9' ToSheet='${o.from.sheet}' ToCell='Connections.X${o.from.ix + 1}' ToPart='${100 + o.from.ix}'/>`,
    `<Connect FromSheet='${id}' FromCell='EndX' FromPart='12' ToSheet='${o.to.sheet}' ToCell='Connections.X${o.to.ix + 1}' ToPart='${100 + o.to.ix}'/>`,
  ];
  return { id, xml: x, connects };
}

import { isGateway, isStart, isStartOrEnd } from "@/lib/domain";
import { docsLifted, layoutGrid, sharedDocs } from "@/lib/swimlane-layout";
import { labelPoint, routeFlows, type Rect } from "@/lib/swimlane-routing";
import type { VisioInput } from "@/lib/visio/subprocess";

/*
  Svimlanediagrammet som en selvstændig side — samme opbygning og mål som
  SwimlaneDiagram.tsx i Corner IQ, bare som almindelig DOM uden React:
  figurerne i et gitter pr. svimlane, pilene tegnet bagefter i ét SVG-lag
  ud fra de målte positioner (lib/swimlane-routing, som Visio-eksporten).
  render.ts lægger modellen ind i siden som JSON.
*/

type Step = VisioInput["steps"][number];

const ROW_H = 112;
const SVG = "http://www.w3.org/2000/svg";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function svg(markup: string, cls: string, viewBox: string, preserve?: string) {
  const s = document.createElementNS(SVG, "svg");
  s.setAttribute("viewBox", viewBox);
  s.setAttribute("aria-hidden", "true");
  s.setAttribute("class", cls);
  if (preserve) s.setAttribute("preserveAspectRatio", preserve);
  s.innerHTML = markup;
  return s;
}

const T = 'stroke="var(--d-text)"';
const docIcon = () =>
  svg(
    `<path d="M1 1 H64 L79 16 V47 H1 Z" fill="var(--d-clay-wash)" ${T} stroke-width="1.2" vector-effect="non-scaling-stroke"/><path d="M64 1 V16 H79" fill="none" ${T} stroke-width="1.2" vector-effect="non-scaling-stroke"/>`,
    "doc-icon",
    "0 0 80 48",
    "none",
  );

function gatewayMarker(type: string) {
  const s = `fill="none" ${T} stroke-linecap="round" stroke-linejoin="round"`;
  const inner =
    type === "DECISION"
      ? `<path d="M15 15 L27 27 M27 15 L15 27" ${s} stroke-width="2.6"/>`
      : type === "PARALLEL"
        ? `<path d="M21 13 V29 M13 21 H29" ${s} stroke-width="2.6"/>`
        : type === "INCLUSIVE"
          ? `<circle cx="21" cy="21" r="7.5" ${s} stroke-width="2.4"/>`
          : `<circle cx="21" cy="21" r="9.5" ${s} stroke-width="1.1"/><circle cx="21" cy="21" r="7.8" ${s} stroke-width="1.1"/><path d="M21 16.2 L25.6 19.5 L23.8 24.9 H18.2 L16.4 19.5 Z" ${s} stroke-width="1.2"/>`;
  return svg(inner, "gw-marker", "0 0 42 42");
}

const clockIcon = () =>
  svg(
    `<circle cx="9" cy="9" r="7" fill="none" ${T} stroke-width="1.3"/><path d="M9 4.5 V9 L12 10.5" fill="none" ${T} stroke-width="1.3" stroke-linecap="round"/>`,
    "clock",
    "0 0 18 18",
  );

export function renderDiagram(root: HTMLElement, input: VisioInput) {
  const { title, pools, lanes, steps, flows } = input;
  const anchors = new Map<string, HTMLElement>();
  const docs = new Map<string, HTMLElement>();
  const laneEls = new Map<string, HTMLElement>();

  const grid = layoutGrid(steps, flows);
  const { rows, offs } = grid;
  const rowCount = Math.max(1, ...rows.values());
  const shared = sharedDocs(steps, rows, offs);
  const laneOrder = [
    ...lanes.filter((l) => !l.poolId || !pools.some((p) => p.id === l.poolId)),
    ...pools.flatMap((p) => lanes.filter((l) => l.poolId === p.id)),
  ].map((l) => l.id);
  const lifted = docsLifted(steps, flows, rows, laneOrder);

  function node(s: Step) {
    if (isStartOrEnd(s.type)) {
      const start = isStart(s.type);
      const wrap = el("div", "event");
      const circle = el("span", `event-ring ${start ? "start" : "end"}`);
      // Start på et fast tidspunkt: uret i den tynde startcirkel.
      if (s.type === "TIMER_START") circle.append(clockIcon());
      anchors.set(s.id, circle);
      const caption = el("span", "event-caption", s.name);
      wrap.append(...(start ? [caption, circle] : [circle, caption]));
      return wrap;
    }
    if (isGateway(s.type) || s.type === "TIMER") {
      const wrap = el("div", "marker-cell");
      let mark: HTMLElement;
      if (isGateway(s.type)) {
        mark = el("span", "gateway");
        mark.append(el("span", "gateway-diamond"), gatewayMarker(s.type));
      } else {
        mark = el("span", "timer");
        mark.append(clockIcon());
      }
      anchors.set(s.id, mark);
      wrap.append(mark);
      if (s.name) wrap.append(el("span", "marker-label", s.name));
      return wrap;
    }
    const wrap = el("div", "task-cell");
    const box = el("div", "task");
    box.append(el("span", "task-name", s.name));
    if (s.systems.length) box.append(el("span", "task-systems", `[${s.systems.join(", ")}]`));
    anchors.set(s.id, box);
    wrap.append(box);
    if (s.data.some((_, i) => !shared.has(`${s.id}:${i}`))) {
      const col = el("div", `docs${lifted.has(s.id) ? " lifted" : ""}`);
      s.data.forEach((d, i) => {
        if (shared.has(`${s.id}:${i}`)) return;
        const doc = el("div", "doc");
        doc.append(docIcon(), el("span", "doc-name", d.name));
        docs.set(`${s.id}:${i}`, doc);
        col.append(doc);
      });
      wrap.append(col);
    }
    return wrap;
  }

  const canvas = el("div", "canvas");
  const poolRow = el("div", "pools");
  const poolBoxes = [
    { name: title, lanes: lanes.filter((l) => !l.poolId || !pools.some((p) => p.id === l.poolId)) },
    ...pools.map((p) => ({ name: p.name, lanes: lanes.filter((l) => l.poolId === p.id) })),
  ];
  for (const pool of poolBoxes) {
    const box = el("div", "pool");
    if (!pool.lanes.length) box.style.minWidth = "180px";
    box.append(el("div", "pool-head", pool.name));
    const laneRow = el("div", "lanes");
    if (!pool.lanes.length) laneRow.append(el("div", "no-lanes", "Ingen svimlaner endnu"));
    for (const lane of pool.lanes) {
      const laneSteps = steps.filter((s) => s.laneId === lane.id);
      const hasDocs = laneSteps.some((s) => s.data.length > 0);
      const lo = laneSteps.map((s) => offs.get(s.id) ?? 0);
      const minOff = lo.length ? Math.min(...lo) : 0;
      const maxOff = lo.length ? Math.max(...lo) : 0;
      const colW = hasDocs ? 292 : 210;
      const laneEl = el("div", "lane");
      laneEl.style.width = `${colW * (maxOff - minOff + 1)}px`;
      laneEls.set(lane.id, laneEl);
      laneEl.append(el("div", "lane-head", lane.name));
      const body = el("div", "lane-body");
      body.style.gridTemplateRows = `repeat(${rowCount}, ${ROW_H}px)`;
      for (const s of laneSteps) {
        const cell = el("div", `cell${hasDocs ? " with-docs" : ""}`);
        cell.style.top = `${14 + ((rows.get(s.id) ?? 1) - 1) * ROW_H}px`;
        cell.style.left = `${((offs.get(s.id) ?? 0) - minOff) * colW}px`;
        cell.style.width = `${colW}px`;
        cell.style.height = `${ROW_H}px`;
        cell.append(node(s));
        body.append(cell);
      }
      laneEl.append(body);
      laneRow.append(laneEl);
    }
    box.append(laneRow);
    poolRow.append(box);
  }
  canvas.append(poolRow);

  const layer = document.createElementNS(SVG, "svg");
  layer.setAttribute("class", "arrows");
  layer.setAttribute("aria-hidden", "true");
  const labelLayer = el("div", "labels");
  canvas.append(layer, labelLayer);
  root.replaceChildren(canvas);

  // Pilene ud fra de målte figurer. scale er zoomen på siden.
  function draw(scale: number) {
    const base = canvas.getBoundingClientRect();
    const rect = (e: HTMLElement): Rect => {
      const r = e.getBoundingClientRect();
      return {
        l: (r.left - base.left) / scale,
        r: (r.right - base.left) / scale,
        t: (r.top - base.top) / scale,
        b: (r.bottom - base.top) / scale,
        cx: ((r.left + r.right) / 2 - base.left) / scale,
        cy: ((r.top + r.bottom) / 2 - base.top) / scale,
      };
    };
    const toD = (pts: number[][]) => pts.map((q, i) => `${i ? "L" : "M"}${Math.round(q[0])} ${Math.round(q[1])}`).join(" ");
    const paths: { d: string; kind: "seq" | "msg" | "data" }[] = [];
    const labels: { text: string; x: number; y: number }[] = [];

    const routes = routeFlows({
      steps,
      flows,
      rows,
      offs,
      rect: (id) => {
        const a = anchors.get(id);
        return a ? rect(a) : undefined;
      },
      laneRect: (id) => {
        const l = laneEls.get(id);
        return l ? rect(l) : undefined;
      },
    });
    flows.forEach((f, i) => {
      const pts = routes[i];
      if (!pts) return;
      if (f.label) labels.push({ text: f.label, ...labelPoint(pts) });
      paths.push({ d: toD(pts), kind: f.kind === "MESSAGE" ? "msg" : "seq" });
    });

    for (const s of steps) {
      const anchor = anchors.get(s.id);
      if (!anchor) continue;
      s.data.forEach((d, i) => {
        const act = rect(anchor);
        const source = shared.get(`${s.id}:${i}`);
        if (source) {
          const src = docs.get(source);
          if (!src) return;
          const doc = rect(src);
          paths.push({ d: toD([[doc.cx, doc.b], [doc.cx, act.cy], [act.r, act.cy]]), kind: "data" });
          return;
        }
        const docEl = docs.get(`${s.id}:${i}`);
        if (!docEl) return;
        const doc = rect(docEl);
        paths.push({
          d: d.dir === "in" ? toD([[doc.l, doc.cy], [act.r, doc.cy]]) : toD([[act.r, doc.cy], [doc.l, doc.cy]]),
          kind: "data",
        });
      });
    }

    layer.innerHTML = `<defs>
<marker id="m-filled" markerUnits="userSpaceOnUse" orient="auto" markerWidth="10" markerHeight="10" refX="9" refY="5"><path d="M0,0.5 L9,5 L0,9.5 z" fill="var(--d-text)"/></marker>
<marker id="m-open" markerUnits="userSpaceOnUse" orient="auto" markerWidth="10" markerHeight="10" refX="9" refY="5"><path d="M0,0.5 L9,5 L0,9.5" fill="none" stroke="var(--d-text)" stroke-width="1.2"/></marker>
<marker id="m-hollow" markerUnits="userSpaceOnUse" orient="auto" markerWidth="11" markerHeight="11" refX="10" refY="5.5"><path d="M0.5,0.5 L10,5.5 L0.5,10.5 z" fill="var(--d-surface)" stroke="var(--d-text)" stroke-width="1.2"/></marker>
<marker id="m-circle" markerUnits="userSpaceOnUse" orient="auto" markerWidth="10" markerHeight="10" refX="4" refY="5"><circle cx="5" cy="5" r="3.5" fill="var(--d-surface)" stroke="var(--d-text)" stroke-width="1.2"/></marker>
</defs>${paths
      .map(
        (p) =>
          `<path d="${p.d}" fill="none" stroke="var(--d-text)" stroke-width="${p.kind === "seq" ? 1.4 : 1.2}"${
            p.kind === "msg" ? ' stroke-dasharray="6 4" marker-start="url(#m-circle)" marker-end="url(#m-hollow)"' : p.kind === "data" ? ' stroke-dasharray="2 3" marker-end="url(#m-open)"' : ' marker-end="url(#m-filled)"'
          }/>`,
      )
      .join("")}`;
    labelLayer.replaceChildren(
      ...labels.map((lb) => {
        const e = el("div", "flow-label", lb.text);
        e.style.left = `${lb.x}px`;
        e.style.top = `${lb.y}px`;
        return e;
      }),
    );
  }
  return { canvas, draw };
}

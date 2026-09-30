import { isGateway } from "@/lib/domain";

/*
  Pilenes forløb i svimlanediagrammet — samme regler som SwimlaneDiagram.tsx,
  delt mellem Visio-eksporten (lib/visio) og procesdiagram-skillens side
  (scripts/skill/procesdiagram), der begge kender figurernes placering.
  Rektanglerne er i px med y nedad.
*/

export type Rect = { l: number; r: number; t: number; b: number; cx: number; cy: number };

export function routeFlows(o: {
  steps: { id: string; type: string; laneId: string }[];
  flows: { from: string; to: string }[];
  rows: Map<string, number>;
  offs: Map<string, number>;
  rect: (stepId: string) => Rect | undefined;
  laneRect: (laneId: string) => { l: number; r: number } | undefined;
}): (number[][] | null)[] {
  const { steps, flows, rows, offs } = o;
  const laneOf = new Map(steps.map((s) => [s.id, s.laneId]));
  const typeOf = new Map(steps.map((s) => [s.id, s.type]));
  const sameOff = (a: string, b: string) => Math.abs((offs.get(a) ?? 0) - (offs.get(b) ?? 0)) < 0.01;
  const laneRect = (id: string | undefined) => (id ? o.laneRect(id) : undefined);

  // Antal pile ind i / ud af hvert skridt — pile der samles eller deler sig
  // knækker i samme højde.
  const inCount = new Map<string, number>();
  const outCount = new Map<string, number>();
  for (const f of flows) {
    inCount.set(f.to, (inCount.get(f.to) ?? 0) + 1);
    outCount.set(f.from, (outCount.get(f.from) ?? 0) + 1);
  }
  // Pile der går uden om i samme svimlane og side får hver sin afstand.
  const detours = new Map<string, number>();
  const detourOffset = (lane: string | undefined, side: "l" | "r") => {
    const key = `${lane}:${side}`;
    const n = detours.get(key) ?? 0;
    detours.set(key, n + 1);
    return 16 + n * 10;
  };

  return flows.map((f) => {
    const a = o.rect(f.from);
    const b = o.rect(f.to);
    if (!a || !b) return null;
    const aRow = rows.get(f.from) ?? 0;
    const bRow = rows.get(f.to) ?? 0;
    const sameLane = laneOf.get(f.from) === laneOf.get(f.to);
    const sameCol = sameLane && sameOff(f.from, f.to);

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
        return [
          [a.cx, a.b],
          [a.cx, b.t],
        ];
      }
      if (isGateway(typeOf.get(f.from) ?? "") && bRow > aRow) {
        // En gren fra en gateway går ud til højre og uden om — så den ikke
        // forveksles med en løkke tilbage (venstre side).
        let xr = Math.max(a.r, b.r);
        for (const s of blockers) xr = Math.max(xr, o.rect(s.id)?.r ?? xr);
        const off = detourOffset(laneOf.get(f.from), "r");
        xr = Math.min(xr + off, lane ? lane.r - 4 : xr + off);
        const y0 = a.b + 12;
        return [
          [a.cx, a.b],
          [a.cx, y0],
          [xr, y0],
          [xr, b.cy],
          [b.r, b.cy],
        ];
      }
      // Uden om til venstre — når noget står i vejen, eller pilen går tilbage op.
      let x0 = Math.min(a.l, b.l);
      for (const s of blockers) x0 = Math.min(x0, o.rect(s.id)?.l ?? x0);
      const off = detourOffset(laneOf.get(f.from), "l");
      x0 = Math.max(x0 - off, lane ? lane.l + 4 : x0 - off);
      return [
        [a.l, a.cy],
        [x0, a.cy],
        [x0, b.cy],
        [b.l, b.cy],
      ];
    }
    if (aRow === bRow) {
      // Samme række, to svimlaner: vandret pil.
      const right = b.cx > a.cx;
      const sx = right ? a.r : a.l;
      const ex = right ? b.l : b.r;
      const mx = (sx + ex) / 2;
      return Math.abs(a.cy - b.cy) < 2
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
    }
    if (!sameLane && isGateway(typeOf.get(f.from) ?? "") && bRow > aRow) {
      // Fra en beslutning ud af siden, hen over og ned i målet.
      const toRight = b.cx > a.cx;
      return [
        [toRight ? a.r : a.l, a.cy],
        [b.cx, a.cy],
        [b.cx, b.t],
      ];
    }
    if (bRow <= aRow) {
      // Tilbage op i en anden svimlane: op langs svimlanens venstre kant.
      const lane = laneRect(laneOf.get(f.from));
      const xl = lane ? lane.l + 12 : a.l - 16;
      const ex = b.cx > xl ? b.l : b.r;
      return [
        [a.l, a.cy],
        [xl, a.cy],
        [xl, b.cy],
        [ex, b.cy],
      ];
    }
    // Nedad til en anden svimlane — knækket lægges så det går fri af det,
    // der står imellem.
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
    return Math.abs(a.cx - b.cx) < 2
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
  });
}

// Hvor en pils tekst skal stå: midt på det sidste stykke, hvis det er langt
// nok — ellers midt på det længste.
export function labelPoint(pts: number[][]) {
  const segs = pts.slice(1).map((p, i) => {
    const q = pts[i];
    return { x: (p[0] + q[0]) / 2, y: (p[1] + q[1]) / 2, len: Math.hypot(p[0] - q[0], p[1] - q[1]) };
  });
  if (!segs.length) return { x: pts[0][0], y: pts[0][1] };
  const last = segs[segs.length - 1];
  const best = last.len >= 28 ? last : segs.reduce((m, s) => (s.len > m.len ? s : m), segs[0]);
  return { x: best.x, y: best.y };
}

/*
  Række og kolonne pr. skridt i svimlanediagrammet — delt mellem diagrammet
  i appen (SwimlaneDiagram.tsx) og Visio-eksporten (lib/visio), så de to
  står ens.

  Et skridt står én række under det seneste af de skridt der peger på det
  (kun pile fremad i listen — en løkke tilbage må ikke skubbe noget ned). Så
  kan skridt der sker samtidig dele række, både i forskellige svimlaner og —
  som grene fra samme gateway — side om side i samme svimlane.

  Den vandrette plads er en forskydning fra svimlanens midte, målt i
  kolonnebredder: hovedforløbet står i midten (0), og grene fra samme skridt
  fordeles symmetrisk om deres forgænger (to grene: −½ og +½, tre: −1, 0,
  +1). Et skridt arver sin forgængers forskydning, så en gren bliver i sin
  kolonne nedad, og når grene samles igen, lægges skridtet midt imellem
  dem. Svimlanen bliver så bred som dens yderste skridt kræver.
*/
/*
  Dokumenter der går videre i forløbet. Bruger et skridt et dokument som
  input, som et tidligere skridt allerede har ved siden af sig (fx
  "Stillingsopslag", der skrives ét sted og sendes et andet), tegnes der
  ikke et nyt dokument: pilen går fra det eksisterende dokument ned til
  aktiviteten — så længe den står lige under (samme svimlane og kolonne,
  højst to rækker nede, og intet andet dokument imellem). Ligger den
  længere væk, får aktiviteten sin egen kopi af dokumentet.

  Svaret er et kort fra "skridt:dataindeks" for input'et til
  "skridt:dataindeks" for det dokument pilen skal komme fra.
*/
export function sharedDocs(
  steps: { id: string; laneId: string; data: { name: string; dir: "in" | "out" }[] }[],
  rows: Map<string, number>,
  offs: Map<string, number>,
) {
  const shared = new Map<string, string>();
  const sameCol = (a: string, b: string) => Math.abs((offs.get(a) ?? 0) - (offs.get(b) ?? 0)) < 0.01;
  steps.forEach((b, bi) => {
    b.data.forEach((d, i) => {
      if (d.dir !== "in") return;
      const bRow = rows.get(b.id) ?? 0;
      // Det seneste tidligere skridt der har samme dokument ved siden af sig.
      for (let ai = bi - 1; ai >= 0; ai--) {
        const a = steps[ai];
        const j = a.data.findIndex((x) => x.name === d.name);
        if (j < 0) continue;
        const aKey = `${a.id}:${j}`;
        // Selv genbrugt? Så peger vi på den oprindelige.
        const source = shared.get(aKey) ?? aKey;
        const srcStep = source.split(":")[0];
        const aRow = rows.get(srcStep) ?? 0;
        const srcLane = steps.find((s) => s.id === srcStep)?.laneId;
        const near =
          srcLane === b.laneId &&
          sameCol(srcStep, b.id) &&
          bRow > aRow &&
          bRow - aRow <= 2 &&
          !steps.some(
            (s) =>
              s.laneId === b.laneId &&
              sameCol(s.id, b.id) &&
              (rows.get(s.id) ?? 0) > aRow &&
              (rows.get(s.id) ?? 0) < bRow &&
              s.data.length > 0,
          );
        if (near) shared.set(`${b.id}:${i}`, source);
        break;
      }
    });
  });
  return shared;
}

/*
  Skridt hvis dokumenter skal løftes op over midten, fordi en vandret pil
  går ud (eller ind) til højre på samme række — ellers lægger dokumentet sig
  oven på pilen. laneOrder er svimlanernes rækkefølge fra venstre.
*/
export function docsLifted(
  steps: { id: string; laneId: string }[],
  flows: { from: string; to: string }[],
  rows: Map<string, number>,
  laneOrder: string[],
) {
  const laneOf = new Map(steps.map((s) => [s.id, s.laneId]));
  const idx = (id: string) => laneOrder.indexOf(laneOf.get(id) ?? "");
  const lifted = new Set<string>();
  for (const f of flows) {
    if ((rows.get(f.from) ?? 0) !== (rows.get(f.to) ?? 0)) continue;
    if (laneOf.get(f.from) === laneOf.get(f.to)) continue;
    // Den af de to der står til venstre, har pilen på sin højre side.
    lifted.add(idx(f.from) < idx(f.to) ? f.from : f.to);
  }
  return lifted;
}

export function layoutGrid(steps: { id: string; laneId: string }[], flows: { from: string; to: string }[]) {
  const index = new Map(steps.map((s, i) => [s.id, i]));
  const laneOf = new Map(steps.map((s) => [s.id, s.laneId]));
  const rows = new Map<string, number>();
  const offs = new Map<string, number>();
  const placed: { lane: string; row: number; off: number }[] = [];
  let prevRow = 0;
  for (const s of steps) {
    const i = index.get(s.id)!;
    const preds = flows
      .filter((f) => f.to === s.id && (index.get(f.from) ?? Infinity) < i)
      .map((f) => f.from);
    const row = preds.length ? Math.max(...preds.map((p) => rows.get(p) ?? 0)) + 1 : prevRow + 1;

    const sameLanePreds = preds.filter((p) => laneOf.get(p) === s.laneId);
    let off = 0;
    if (sameLanePreds.length === 1) {
      const p = sameLanePreds[0];
      // Søskende: de skridt samme forgænger peger fremad på i samme svimlane.
      const siblings = flows
        .filter((f) => f.from === p && laneOf.get(f.to) === s.laneId && (index.get(f.to) ?? -1) > (index.get(p) ?? 0))
        .map((f) => f.to)
        .sort((a, b) => (index.get(a) ?? 0) - (index.get(b) ?? 0));
      const n = siblings.length;
      const k = siblings.indexOf(s.id);
      off = (offs.get(p) ?? 0) + (n > 1 && k >= 0 ? k - (n - 1) / 2 : 0);
    } else if (sameLanePreds.length > 1) {
      off = sameLanePreds.reduce((sum, p) => sum + (offs.get(p) ?? 0), 0) / sameLanePreds.length;
    }
    // Står der allerede noget på samme sted, rykkes der en kolonne til højre.
    while (placed.some((q) => q.lane === s.laneId && q.row === row && Math.abs(q.off - off) < 0.99)) off += 1;
    placed.push({ lane: s.laneId, row, off });
    rows.set(s.id, row);
    offs.set(s.id, off);
    prevRow = row;
  }
  return { rows, offs };
}

/*
  BPMN 2.0 genereret ud fra de kortlagte skridt.

  Vi gemmer ikke tegningen — vi tegner den. Det betyder at diagrammet aldrig kan
  komme ud af trit med data: retter nogen et skridt, ændrer tegningen sig med.
  Layoutet er bevidst simpelt, med en svimlane pr. aktør (rolle eller system)
  når mere end én aktør optræder, og dataobjekter hængt på de skridt der rører
  dem.

  Svimlanerne er altid lodrette kolonner side om side, med forløbet gående ned
  (Y vokser) — det er bevidst den eneste retning, ikke et valg brugeren kan
  ændre, fordi aktørens navn skal stå synligt og vandret øverst i sin kolonne
  hver gang, hvilket kun sker i den ene retning (en vandret bane ville i
  stedet rotere navnet ned langs venstre kant). Layout-matematikken er
  alligevel skrevet i abstrakte "main"/"cross"-akser (main = retningen
  forløbet bevæger sig i, cross = retningen svimlanerne ligger fordelt i) og
  omregnes til rigtige x/y kun via toXY() — en rest fra dengang begge
  retninger var understøttet, bevaret fordi det holder al positionerings-
  matematik i denne fil på én form.
*/

type Step = {
  id: string;
  name: string;
  stepType: string;
  isManual: boolean;
  // Rollens ELLER systemets navn, alt efter hvad aktøren er (se
  // ProcessStep.actorRoleId/actorSystemId) — én lane-nøgle uanset hvilken af
  // de to det er.
  actor: string | null;
  data?: { direction: string | null }[];
  systems?: unknown[];
};

// Svimlanerne er nu et selvstændigt, brugerstyret objekt (ProcessLane) —
// ikke længere kun stiltiende udledt af hvilke aktører der forekommer blandt
// skridtene. Der er ALTID mindst én (isDefault, ingen aktør) — se
// ownership/[subId]/actions.ts's createLane/setLaneActor/setStepActor.
type Lane = { id: string; isDefault: boolean; actorName: string | null };

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Rene ID'er — BPMN kræver at de starter med et bogstav.
const nid = (prefix: string, raw: string) => `${prefix}_${raw.replace(/[^\w]/g, "")}`;

const GAP = 50;
const TASK_W = 150;
const TASK_H = 70;
const GATE = 50;
const EVENT = 36;
const LANE_W = 220;
const DATA_OBJ = 40;
const DATA_OBJ_W = DATA_OBJ * 0.7;

export function buildBpmnXml(opts: {
  subProcessName: string;
  startEvents?: string[];
  endEvents?: string[];
  steps: Step[];
  lanes: Lane[];
}) {
  const { steps } = opts;
  const HORIZONTAL = false;

  // Eneste sted retningen faktisk forgrener koden — alt andet er skrevet i
  // main/cross og går igennem her.
  const toXY = (main: number, cross: number) =>
    HORIZONTAL ? { x: main, y: cross } : { x: cross, y: main };
  const mainSize = (w: number, h: number) => (HORIZONTAL ? w : h);
  const crossSize = (w: number, h: number) => (HORIZONTAL ? h : w);

  type Node = {
    id: string;
    tag: string;
    name: string;
    w: number;
    h: number;
    x: number;
    y: number;
    lane: string;
  };

  // Svimlaner — altid mindst den ene fundamentale (isDefault, kan ikke
  // slettes, men kan sagtens få tildelt en aktør ligesom enhver anden lane),
  // plus én bane pr. anden aktør (rolle ELLER system) i den rækkefølge de
  // blev bygget oven på den. Rene ProcessLane-id'er bruges som nøgle, ikke
  // aktørnavnet — så BpmnViewer kan finde tilbage til den rigtige
  // databaserække ved klik uden tab-behæftet id-oprensning.
  const lanes = opts.lanes;
  const defaultLane = lanes.find((l) => l.isDefault) ?? lanes[0];
  const laneCross = new Map(lanes.map((l, i) => [l.id, i * LANE_W]));
  const nameToLaneId = new Map(
    lanes.filter((l) => !l.isDefault && l.actorName).map((l) => [l.actorName as string, l.id]),
  );
  const laneLabel = new Map(lanes.map((l) => [l.id, l.actorName ?? "Proces"]));
  const laneOf = (s: { actor: string | null }) =>
    (s.actor ? nameToLaneId.get(s.actor) : undefined) ?? defaultLane.id;
  const centerCross = (lane: string, size: number) =>
    (laneCross.get(lane) ?? 0) + (LANE_W - size) / 2;
  const totalCross = lanes.length * LANE_W;

  const nodes: Node[] = [];
  let mainPos = 60;

  const push = (id: string, tag: string, name: string, w: number, h: number, lane: string) => {
    const { x, y } = toXY(mainPos, centerCross(lane, crossSize(w, h)));
    nodes.push({ id, tag, name, w, h, x, y, lane });
    mainPos += mainSize(w, h) + GAP;
  };

  // Flere starter/slutter-hændelser tegnes som hver sin cirkel side om side —
  // ikke som ét samlet navn — så det er tydeligt at underprocessen kan
  // udløses eller afsluttes ad flere veje. "Side om side" betyder langs
  // cross-aksen, ved en fast main-position.
  const layoutRow = (names: string[], rowMain: number, idPrefix: string, tag: string): Node[] => {
    const rowCrossSpan = names.length * EVENT + (names.length - 1) * 20;
    const rowStartCross = (totalCross - rowCrossSpan) / 2;
    return names.map((name, i) => {
      const { x, y } = toXY(rowMain, rowStartCross + i * (EVENT + 20));
      return { id: `${idPrefix}_${i}`, tag, name, w: EVENT, h: EVENT, x, y, lane: defaultLane.id };
    });
  };

  const startNames = opts.startEvents?.length ? opts.startEvents : ["Start"];
  const startNodes = layoutRow(startNames, mainPos, "StartEvent", "startEvent");
  nodes.push(...startNodes);
  mainPos += EVENT + GAP;

  const mainNodes: Node[] = [];
  for (const s of steps) {
    const lane = laneOf(s);
    if (s.stepType === "DECISION") {
      push(nid("Gateway", s.id), "exclusiveGateway", s.name, GATE, GATE, lane);
    } else {
      // Manuelt arbejde tegnes som manual task — det er hele pointen med kortlægningen
      const tag = s.isManual ? "manualTask" : "serviceTask";
      push(nid("Task", s.id), tag, s.name, TASK_W, TASK_H, lane);
    }
    mainNodes.push(nodes[nodes.length - 1]);
  }

  const endNames = opts.endEvents?.length ? opts.endEvents : ["Slut"];
  const endNodes = layoutRow(endNames, mainPos, "EndEvent", "endEvent");
  nodes.push(...endNodes);
  mainPos += EVENT + GAP;

  // Bipartit: hver start peger ind i det første skridt, skridtene kæder sig
  // som før, og det sidste skridt peger ud til hver slut-hændelse. Uden
  // skridt overhovedet forbindes hver start direkte til hver slut.
  const flows: { id: string; from: Node; to: Node }[] = [];
  let flowIndex = 0;
  const addFlow = (from: Node, to: Node) => {
    flows.push({ id: `Flow_${flowIndex++}`, from, to });
  };

  if (mainNodes.length === 0) {
    for (const s of startNodes) for (const e of endNodes) addFlow(s, e);
  } else {
    for (const s of startNodes) addFlow(s, mainNodes[0]);
    for (let i = 0; i < mainNodes.length - 1; i++) addFlow(mainNodes[i], mainNodes[i + 1]);
    for (const e of endNodes) addFlow(mainNodes[mainNodes.length - 1], e);
  }

  // Dataobjekter — højst to pr. skridt, uanset hvor mange konkrete
  // dataobjekter der reelt er koblet på: "Input kontekst" er det man skal
  // bruge for at udføre skridtet (dataobjekt-ikonet, tynd kant — som
  // starthændelsen), "Output kontekst" er det skridtet efterlader
  // (datalager-ikonet, tyk kant — som sluthændelsen). To forskellige figurer,
  // ikke bare to farver af den samme. Systemer-boksen er en tredje, samlet
  // boks pr. skridt. Alle tre placeres langs CROSS-aksen (side om side med
  // skridtet, ikke foran/efter det i forløbet) — kontekst-boksene på den
  // positive side, systemer-boksen på den negative.
  type DataNode = { id: string; name: string; x: number; y: number; kind: "in" | "out" | "sys" };
  const dataNodes: DataNode[] = [];
  const dataAssocs: { id: string; from: string; to: string }[] = [];

  const taskMainCenter = (task: Node) => (HORIZONTAL ? task.x + task.w / 2 : task.y + task.h / 2);

  for (const s of steps) {
    if (s.stepType === "DECISION") continue;
    const taskId = nid("Task", s.id);
    const task = nodes.find((n) => n.id === taskId);
    if (!task) continue;

    if (s.data?.length) {
      const hasIn = s.data.some((d) => d.direction !== "OUTPUT");
      const hasOut = s.data.some((d) => d.direction === "OUTPUT" || d.direction === "BOTH");

      const slots: { kind: "in" | "out"; name: string }[] = [
        ...(hasIn ? [{ kind: "in" as const, name: "Input kontekst" }] : []),
        ...(hasOut ? [{ kind: "out" as const, name: "Output kontekst" }] : []),
      ];

      slots.forEach((slot, i) => {
        const dObjId = nid(slot.kind === "in" ? "CtxIn" : "CtxOut", s.id);
        const crossOut = (HORIZONTAL ? task.y + task.h : task.x + task.w) + 40;
        const main = taskMainCenter(task) - mainSize(DATA_OBJ_W, DATA_OBJ) / 2 + i * (mainSize(DATA_OBJ_W, DATA_OBJ) + 12);
        const { x, y } = toXY(main, crossOut);
        dataNodes.push({ id: dObjId, name: slot.name, x, y, kind: slot.kind });
        dataAssocs.push({ id: nid("DataAssoc", `${s.id}_${slot.kind}`), from: taskId, to: dObjId });
      });
    }

    // Systemer-boksen — én samlet boks pr. skridt uanset hvor mange konkrete
    // StepSystem-koblinger der er, ligesom Input/Output kontekst — placeret
    // på cross-aksens NEGATIVE side af skridtet, så den ikke kolliderer med
    // kontekst-boksene (positiv side).
    if (s.systems?.length) {
      const sysId = nid("Sys", s.id);
      const crossIn = (HORIZONTAL ? task.y : task.x) - 40 - crossSize(DATA_OBJ_W, DATA_OBJ);
      const main = taskMainCenter(task) - mainSize(DATA_OBJ_W, DATA_OBJ) / 2;
      const { x, y } = toXY(main, crossIn);
      dataNodes.push({ id: sysId, name: "Systemer", x, y, kind: "sys" });
      dataAssocs.push({ id: nid("DataAssoc", `${s.id}_sys`), from: taskId, to: sysId });
    }
  }

  const elements = nodes
    .map((n) => {
      const incoming = flows.filter((f) => f.to.id === n.id).map((f) => f.id);
      const outgoing = flows.filter((f) => f.from.id === n.id).map((f) => f.id);
      const refs = [
        ...incoming.map((id) => `      <bpmn:incoming>${id}</bpmn:incoming>`),
        ...outgoing.map((id) => `      <bpmn:outgoing>${id}</bpmn:outgoing>`),
      ].join("\n");
      return `    <bpmn:${n.tag} id="${n.id}" name="${esc(n.name)}">\n${refs}\n    </bpmn:${n.tag}>`;
    })
    .join("\n");

  const flowXml = flows
    .map(
      (f) =>
        `    <bpmn:sequenceFlow id="${f.id}" sourceRef="${f.from.id}" targetRef="${f.to.id}" />`,
    )
    .join("\n");

  const dataObjectXml = dataNodes
    .map((d) => {
      const tag = d.kind === "out" ? "dataStoreReference" : "dataObjectReference";
      return `    <bpmn:${tag} id="${d.id}" name="${esc(d.name)}" />`;
    })
    .join("\n");

  const dataAssocXml = dataAssocs
    .map(
      (a) =>
        `    <bpmn:association id="${a.id}" sourceRef="${a.from}" targetRef="${a.to}" />`,
    )
    .join("\n");

  const laneSetXml = `    <bpmn:laneSet id="LaneSet_1">\n${lanes
    .map((l) => {
      const refs = nodes
        .filter((n) => n.lane === l.id)
        .map((n) => `        <bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`)
        .join("\n");
      return `      <bpmn:lane id="${nid("Lane", l.id)}" name="${esc(laneLabel.get(l.id) ?? "Proces")}">\n${refs}\n      </bpmn:lane>`;
    })
    .join("\n")}\n    </bpmn:laneSet>`;

  const shapes = nodes
    .map(
      (n) =>
        `      <bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}">\n` +
        `        <dc:Bounds x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" />\n` +
        `      </bpmndi:BPMNShape>`,
    )
    .join("\n");

  const dataShapes = dataNodes
    .map(
      (d) =>
        `      <bpmndi:BPMNShape id="${d.id}_di" bpmnElement="${d.id}">\n` +
        `        <dc:Bounds x="${d.x}" y="${d.y}" width="${DATA_OBJ_W}" height="${DATA_OBJ}" />\n` +
        `      </bpmndi:BPMNShape>`,
    )
    .join("\n");

  const mainAxisStart = 20;
  const mainAxisEnd = mainPos + 20;
  const laneShapes = lanes
        .map((l) => {
          const cross = laneCross.get(l.id) ?? 0;
          const bounds = HORIZONTAL
            ? { x: mainAxisStart, y: cross, width: mainAxisEnd - mainAxisStart, height: LANE_W }
            : { x: cross, y: mainAxisStart, width: LANE_W, height: mainAxisEnd - mainAxisStart };
          return (
            `      <bpmndi:BPMNShape id="${nid("Lane", l.id)}_di" bpmnElement="${nid("Lane", l.id)}" isHorizontal="${HORIZONTAL}">\n` +
            `        <dc:Bounds x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" />\n` +
            `      </bpmndi:BPMNShape>`
          );
        })
        .join("\n");

  // Kant-punkt for en pil ind/ud af en figur langs main-aksen (den led
  // forløbet faktisk bevæger sig ad), centreret på cross-aksen.
  const mainEdgeCross = (n: Node) => (HORIZONTAL ? n.y + n.h / 2 : n.x + n.w / 2);
  const flowPoint = (n: Node, side: "far" | "near") => {
    const main = HORIZONTAL
      ? side === "far"
        ? n.x + n.w
        : n.x
      : side === "far"
        ? n.y + n.h
        : n.y;
    return toXY(main, mainEdgeCross(n));
  };

  const edges = flows
    .map((f) => {
      const p1 = flowPoint(f.from, "far");
      const p2 = flowPoint(f.to, "near");
      return (
        `      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">\n` +
        `        <di:waypoint x="${p1.x}" y="${p1.y}" />\n` +
        `        <di:waypoint x="${p2.x}" y="${p2.y}" />\n` +
        `      </bpmndi:BPMNEdge>`
      );
    })
    .join("\n");

  const dataEdges = dataAssocs
    .map((a) => {
      const task = nodes.find((n) => n.id === a.from)!;
      const data = dataNodes.find((n) => n.id === a.to)!;
      // Systemer-boksen sidder på cross-aksens negative side af skridtet,
      // kontekst-boksene på den positive — pilen skal starte fra den kant der
      // faktisk vender mod boksen.
      const taskCross = data.kind === "sys" ? (HORIZONTAL ? task.y : task.x) : (HORIZONTAL ? task.y + task.h : task.x + task.w);
      const p1 = toXY(taskMainCenter(task), taskCross);
      // Boksens egen main-center (IKKE skridtets) — ved flere kontekst-bokse
      // pr. skridt (Input OG Output) sidder de forskudt langs main-aksen, så
      // hver pil skal pege på sin egen boks' faktiske position.
      const dataCross = HORIZONTAL ? data.y : data.x;
      const dataMain = HORIZONTAL ? data.x + DATA_OBJ_W / 2 : data.y + DATA_OBJ / 2;
      const p2 = toXY(dataMain, dataCross);
      return (
        `      <bpmndi:BPMNEdge id="${a.id}_di" bpmnElement="${a.id}">\n` +
        `        <di:waypoint x="${p1.x}" y="${p1.y}" />\n` +
        `        <di:waypoint x="${p2.x}" y="${p2.y}" />\n` +
        `      </bpmndi:BPMNEdge>`
      );
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1" targetNamespace="http://corneriq">
  <bpmn:process id="Process_1" name="${esc(opts.subProcessName)}" isExecutable="false">
${laneSetXml}
${elements}
${dataObjectXml}
${flowXml}
${dataAssocXml}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
${laneShapes}
${shapes}
${dataShapes}
${edges}
${dataEdges}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

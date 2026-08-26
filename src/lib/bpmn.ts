/*
  BPMN 2.0 genereret ud fra de kortlagte skridt.

  Vi gemmer ikke tegningen — vi tegner den. Det betyder at diagrammet aldrig kan
  komme ud af trit med data: retter nogen et skridt, ændrer tegningen sig med.
  Layoutet er bevidst simpelt (oppefra og ned), med en svimlane-kolonne pr.
  rolle når mere end én rolle optræder, og dataobjekter hængt på de skridt der
  rører dem.
*/

type Step = {
  id: string;
  name: string;
  stepType: string;
  isManual: boolean;
  actorRole: string | null;
  data?: { direction: string | null }[];
};

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
const SHARED_LANE = "__shared__";

export function buildBpmnXml(opts: {
  subProcessName: string;
  startEvents?: string[];
  endEvents?: string[];
  steps: Step[];
}) {
  const { steps } = opts;

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

  // Svimlaner — én kolonne pr. rolle, så snart mindst én aktør er sat.
  const roles = Array.from(
    new Set(steps.filter((s) => s.actorRole).map((s) => s.actorRole as string)),
  );
  const hasUnassigned = steps.some((s) => !s.actorRole);
  const useLanes = roles.length > 0;
  const laneKeys = useLanes ? [...(hasUnassigned ? [SHARED_LANE] : []), ...roles] : [];
  const laneX = new Map(laneKeys.map((k, i) => [k, i * LANE_W]));
  const laneOf = (s: { actorRole: string | null }) =>
    useLanes ? s.actorRole ?? SHARED_LANE : null;
  const centerX = (lane: string | null, w: number) =>
    lane === null ? (LANE_W - w) / 2 : (laneX.get(lane) ?? 0) + (LANE_W - w) / 2;
  const totalWidth = useLanes ? laneKeys.length * LANE_W : LANE_W;

  const nodes: Node[] = [];
  let y = 60;

  const push = (id: string, tag: string, name: string, w: number, h: number, lane: string | null) => {
    nodes.push({ id, tag, name, w, h, x: centerX(lane, w), y, lane: lane ?? SHARED_LANE });
    y += h + GAP;
  };

  // Flere starter/slutter-hændelser tegnes som hver sin cirkel side om side —
  // ikke som ét samlet navn — så det er tydeligt at underprocessen kan
  // udløses eller afsluttes ad flere veje.
  const layoutRow = (names: string[], rowY: number, idPrefix: string, tag: string): Node[] => {
    const rowWidth = names.length * EVENT + (names.length - 1) * 20;
    const rowStartX = (totalWidth - rowWidth) / 2;
    return names.map((name, i) => ({
      id: `${idPrefix}_${i}`,
      tag,
      name,
      w: EVENT,
      h: EVENT,
      x: rowStartX + i * (EVENT + 20),
      y: rowY,
      lane: SHARED_LANE,
    }));
  };

  const startNames = opts.startEvents?.length ? opts.startEvents : ["Start"];
  const startNodes = layoutRow(startNames, y, "StartEvent", "startEvent");
  nodes.push(...startNodes);
  y += EVENT + GAP;

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
  const endNodes = layoutRow(endNames, y, "EndEvent", "endEvent");
  nodes.push(...endNodes);
  y += EVENT + GAP;

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
  // ikke bare to farver af den samme.
  type DataNode = { id: string; name: string; x: number; y: number; kind: "in" | "out" };
  const dataNodes: DataNode[] = [];
  const dataAssocs: { id: string; from: string; to: string }[] = [];

  for (const s of steps) {
    if (s.stepType === "DECISION" || !s.data?.length) continue;
    const taskId = nid("Task", s.id);
    const task = nodes.find((n) => n.id === taskId);
    if (!task) continue;

    const hasIn = s.data.some((d) => d.direction !== "OUTPUT");
    const hasOut = s.data.some((d) => d.direction === "OUTPUT" || d.direction === "BOTH");

    const slots: { kind: "in" | "out"; name: string }[] = [
      ...(hasIn ? [{ kind: "in" as const, name: "Input kontekst" }] : []),
      ...(hasOut ? [{ kind: "out" as const, name: "Output kontekst" }] : []),
    ];

    slots.forEach((slot, i) => {
      const dObjId = nid(slot.kind === "in" ? "CtxIn" : "CtxOut", s.id);
      dataNodes.push({
        id: dObjId,
        name: slot.name,
        x: task.x + task.w + 40,
        y: task.y + task.h / 2 - DATA_OBJ / 2 + i * (DATA_OBJ + 12),
        kind: slot.kind,
      });
      dataAssocs.push({ id: nid("DataAssoc", `${s.id}_${slot.kind}`), from: taskId, to: dObjId });
    });
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

  const laneSetXml = useLanes
    ? `    <bpmn:laneSet id="LaneSet_1">\n${laneKeys
        .map((k) => {
          const refs = nodes
            .filter((n) => n.lane === k)
            .map((n) => `        <bpmn:flowNodeRef>${n.id}</bpmn:flowNodeRef>`)
            .join("\n");
          return `      <bpmn:lane id="${nid("Lane", k)}" name="${esc(k === SHARED_LANE ? "Proces" : k)}">\n${refs}\n      </bpmn:lane>`;
        })
        .join("\n")}\n    </bpmn:laneSet>`
    : "";

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
        `        <dc:Bounds x="${d.x}" y="${d.y}" width="${DATA_OBJ * 0.7}" height="${DATA_OBJ}" />\n` +
        `      </bpmndi:BPMNShape>`,
    )
    .join("\n");

  const laneTop = 20;
  const laneBottom = y + 20;
  const laneShapes = useLanes
    ? laneKeys
        .map(
          (k) =>
            `      <bpmndi:BPMNShape id="${nid("Lane", k)}_di" bpmnElement="${nid("Lane", k)}" isHorizontal="false">\n` +
            `        <dc:Bounds x="${laneX.get(k)}" y="${laneTop}" width="${LANE_W}" height="${laneBottom - laneTop}" />\n` +
            `      </bpmndi:BPMNShape>`,
        )
        .join("\n")
    : "";

  const edges = flows
    .map((f) => {
      const x1 = f.from.x + f.from.w / 2;
      const x2 = f.to.x + f.to.w / 2;
      return (
        `      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">\n` +
        `        <di:waypoint x="${x1}" y="${f.from.y + f.from.h}" />\n` +
        `        <di:waypoint x="${x2}" y="${f.to.y}" />\n` +
        `      </bpmndi:BPMNEdge>`
      );
    })
    .join("\n");

  const dataEdges = dataAssocs
    .map((a) => {
      const task = nodes.find((n) => n.id === a.from)!;
      const data = dataNodes.find((n) => n.id === a.to)!;
      return (
        `      <bpmndi:BPMNEdge id="${a.id}_di" bpmnElement="${a.id}">\n` +
        `        <di:waypoint x="${task.x + task.w}" y="${task.y + task.h / 2}" />\n` +
        `        <di:waypoint x="${data.x}" y="${data.y + DATA_OBJ / 2}" />\n` +
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

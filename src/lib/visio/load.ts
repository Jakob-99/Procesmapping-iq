import { db } from "@/lib/db";
import type { VisioInput } from "./subprocess";

// Underprocessen i den form Visio-eksporten skal bruge — med samme
// svimlane-valg som diagrammet i appen (se [subId]/page.tsx).
export async function loadSubProcessForVisio(subId: string): Promise<{ organizationId: string; input: VisioInput } | null> {
  const sp = await db.subProcess.findUnique({
    where: { id: subId },
    include: {
      process: { select: { engagement: { select: { organizationId: true } } } },
      steps: {
        orderBy: { sortOrder: "asc" },
        include: { systems: { include: { system: true } }, data: { include: { dataObject: true } } },
      },
      flows: true,
      pools: { orderBy: { sortOrder: "asc" } },
      lanes: {
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
        include: { actorRole: true, actorSystem: true },
      },
    },
  });
  if (!sp) return null;

  const defaultLane = sp.lanes.find((l) => l.isDefault);
  const laneIdFor = (s: { actorRoleId: string | null; actorSystemId: string | null }) =>
    sp.lanes.find(
      (l) =>
        !l.isDefault &&
        ((s.actorRoleId && l.actorRoleId === s.actorRoleId) || (s.actorSystemId && l.actorSystemId === s.actorSystemId)),
    )?.id ??
    defaultLane?.id ??
    "";

  return {
    organizationId: sp.process.engagement.organizationId,
    input: {
      title: sp.name,
      pools: sp.pools.map((p) => ({ id: p.id, name: p.name })),
      lanes: sp.lanes.map((l) => ({
        id: l.id,
        isDefault: l.isDefault,
        poolId: l.poolId,
        name: l.actorRole?.name ?? l.actorSystem?.name ?? "Proces",
      })),
      steps: sp.steps.map((s) => ({
        id: s.id,
        type: s.stepType,
        name: s.name,
        laneId: laneIdFor(s),
        systems: s.systems.map((l) => l.system.name),
        data: s.data.map((l) => ({ name: l.dataObject.name, dir: l.direction === "OUTPUT" ? ("out" as const) : ("in" as const) })),
      })),
      flows: sp.flows.map((f) => ({ from: f.fromStepId, to: f.toStepId, label: f.label, kind: f.kind })),
    },
  };
}

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/session";
import { SubProcessWorkspace } from "@/components/SubProcessWorkspace";
import { INTEGRATION_LABELS, SUBPROCESS_STATUS, parseIntegrations } from "@/lib/domain";
import type { Tone } from "@/components/ui";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";

export const dynamic = "force-dynamic";

// Integrationen som den står på systemkortet — de integrationsmuligheder
// der er valgt på /landscape. Intet valgt = ikke afklaret.
function integrationLabel(s: { integrations: string }) {
  const list = parseIntegrations(s.integrations);
  return list.length ? list.map((t) => INTEGRATION_LABELS[t]).join(", ") : null;
}

export default async function SubProcessPage({
  params,
}: {
  params: Promise<{ processId: string; subId: string }>;
}) {
  const { processId, subId } = await params;
  const sessionUser = await requireSessionUser();

  const sp = await db.subProcess.findUnique({
    where: { id: subId },
    include: {
      process: { include: { engagement: true } },
      assignee: true,
      steps: {
        orderBy: { sortOrder: "asc" },
        include: {
          systems: { include: { system: true } },
          data: { include: { dataObject: true } },
          actorRole: true,
          actorSystem: true,
        },
      },
      flows: true,
      pools: { orderBy: { sortOrder: "asc" } },
      lanes: {
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
        include: { actorRole: true, actorSystem: true },
      },
      chatMessages: { orderBy: { createdAt: "asc" } },
      findings: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      notes: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!sp || sp.process.engagement.organizationId !== sessionUser.organizationId) notFound();
  const engagementId = sp.process.engagement.id;

  const [users, roles, systems, dataObjects] = await Promise.all([
    db.user.findMany({
      where: { organizationId: sp.process.engagement.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.businessRole.findMany({ where: { engagementId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.systemRef.findMany({ where: { engagementId }, orderBy: { name: "asc" } }),
    db.dataObject.findMany({ where: { engagementId }, orderBy: { name: "asc" } }),
  ]);

  const st = SUBPROCESS_STATUS[sp.status as keyof typeof SUBPROCESS_STATUS] ?? SUBPROCESS_STATUS.NOT_STARTED;

  // Hvert skridt havner i svimlanen for sin aktør — eller i den
  // grundlæggende, hvis aktøren mangler en lane (bør ikke ske, se ensureLane).
  const defaultLane = sp.lanes.find((l) => l.isDefault);
  const laneIdFor = (s: { actorRoleId: string | null; actorSystemId: string | null }) =>
    sp.lanes.find(
      (l) =>
        !l.isDefault &&
        ((s.actorRoleId && l.actorRoleId === s.actorRoleId) ||
          (s.actorSystemId && l.actorSystemId === s.actorSystemId)),
    )?.id ??
    defaultLane?.id ??
    "";

  // Systemkortene under diagrammet: alle systemer der bruges i et skridt
  // eller er aktør for en svimlane, med de data de ejer i processen.
  const usedSystemIds = new Set<string>();
  for (const s of sp.steps) {
    s.systems.forEach((l) => usedSystemIds.add(l.systemId));
    if (s.actorSystemId) usedSystemIds.add(s.actorSystemId);
  }
  const usedData = new Map<string, (typeof dataObjects)[number]>();
  for (const s of sp.steps) s.data.forEach((l) => usedData.set(l.dataObjectId, l.dataObject));
  const systemCards = systems
    .filter((s) => usedSystemIds.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      type: s.category,
      integration: integrationLabel(s),
      data: [...usedData.values()].filter((d) => d.ownerSystemId === s.id).map((d) => d.name),
    }));

  return (
    <>
      <SetBreadcrumb
        items={[
          { label: "Processer", href: "/processes" },
          { label: sp.process.name, href: `/processes/${processId}` },
          { label: sp.name },
        ]}
      />
      <SubProcessWorkspace
        processId={processId}
        processName={sp.process.name}
        sp={{
          id: sp.id,
          name: sp.name,
          summary: sp.summary,
          assigneeId: sp.assigneeId,
          assignee: sp.assignee,
        }}
        status={sp.status}
        statusLabel={st.label}
        statusTone={st.tone as Tone}
        users={users}
        roles={roles}
        systems={systems.map((s) => ({ id: s.id, name: s.name }))}
        dataObjects={dataObjects.map((d) => ({ id: d.id, name: d.name }))}
        lanes={sp.lanes.map((l) => ({
          id: l.id,
          isDefault: l.isDefault,
          actorRoleId: l.actorRoleId,
          actorSystemId: l.actorSystemId,
          actorName: l.actorRole?.name ?? l.actorSystem?.name ?? null,
          poolId: l.poolId,
        }))}
        steps={sp.steps.map((s) => ({
          id: s.id,
          name: s.name,
          actorRoleId: s.actorRoleId,
          actorSystemId: s.actorSystemId,
          stepType: s.stepType,
          frequency: s.frequency,
          durationMin: s.durationMin,
          painPoint: s.painPoint,
          decisionCriteria: s.decisionCriteria,
          output: s.output,
          systems: s.systems.map((link) => ({
            id: link.id,
            usage: link.usage ?? "BOTH",
            systemId: link.systemId,
            systemName: link.system.name,
          })),
          data: s.data.map((link) => ({
            id: link.id,
            direction: link.direction ?? "BOTH",
            dataObjectId: link.dataObjectId,
            dataObjectName: link.dataObject.name,
          })),
        }))}
        diagram={{
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
            data: s.data.map((l) => ({
              name: l.dataObject.name,
              dir: l.direction === "OUTPUT" ? ("out" as const) : ("in" as const),
            })),
          })),
          flows: sp.flows.map((f) => ({ from: f.fromStepId, to: f.toStepId, label: f.label, kind: f.kind })),
        }}
        systemCards={systemCards}
        findings={sp.findings.map((f) => ({ id: f.id, kind: f.kind, text: f.text, stepId: f.stepId }))}
        notes={sp.notes.map((n) => ({ id: n.id, text: n.text, x: n.x, y: n.y }))}
        chat={sp.chatMessages.map((m) => ({ id: m.id, role: m.role, content: m.content, userName: m.userName }))}
      />
    </>
  );
}

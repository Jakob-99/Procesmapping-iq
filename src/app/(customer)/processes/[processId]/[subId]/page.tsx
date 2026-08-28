import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/session";
import { SubProcessWorkspace } from "@/components/SubProcessWorkspace";
import { SUBPROCESS_STATUS } from "@/lib/domain";
import { buildBpmnXml } from "@/lib/bpmn";
import { splitEvents } from "@/lib/domain";
import type { Tone } from "@/components/ui";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";

export const dynamic = "force-dynamic";

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
      validations: true,
      experts: { orderBy: { createdAt: "asc" } },
      steps: {
        orderBy: { sortOrder: "asc" },
        include: {
          systems: { include: { system: true } },
          data: { include: { dataObject: true } },
          actorRole: true,
          actorSystem: true,
        },
      },
      lanes: {
        orderBy: { createdAt: "asc" },
        include: { actorRole: true, actorSystem: true },
      },
      interviews: {
        include: {
          notes: true,
          user: true,
          messages: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!sp || sp.process.engagement.organizationId !== sessionUser.organizationId) notFound();

  const users = await db.user.findMany({
    where: { organizationId: sp.process.engagement.organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const improvementLogs = await db.improvementLog.findMany({
    where: { subProcessId: subId },
    orderBy: { createdAt: "desc" },
  });

  const st =
    SUBPROCESS_STATUS[sp.status as keyof typeof SUBPROCESS_STATUS] ??
    SUBPROCESS_STATUS.NOT_STARTED;

  const notes = sp.interviews.flatMap((i) => i.notes);
  const transcript = sp.interviews.flatMap((i) => i.messages);
  const interviewer = sp.interviews[0]?.user.name ?? sp.assignee?.name ?? null;

  // Tegningen bygges fra data — den er aldrig et separat dokument der kan blive gammelt.
  // Parallelle spor tegnes ikke i BPMN-diagrammet endnu — de fremgår af workflow-listen herunder.
  const mainSteps = sp.steps.filter((s) => s.lane === 0);
  // Tegnes altid, også uden skridt — det tomme lærred (start → slut) er hvor
  // man selv tegner det første skridt.
  const startEvents = splitEvents(sp.startEvent);
  const endEvents = splitEvents(sp.endEvent);
  // Den grundlæggende lane skal altid vises først, uanset oprettelses-
  // rækkefølge (bør allerede være ældst, men sorteres eksplicit for en
  // sikkerheds skyld — se createSubProcess/ensureLane i actions.ts).
  const sortedLanes = [...sp.lanes].sort((a, b) =>
    a.isDefault ? -1 : b.isDefault ? 1 : a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const bpmnXml = buildBpmnXml({
    subProcessName: sp.name,
    startEvents,
    endEvents,
    orientation: sp.laneOrientation === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL",
    lanes: sortedLanes.map((l) => ({
      id: l.id,
      isDefault: l.isDefault,
      actorName: l.actorRole?.name ?? l.actorSystem?.name ?? null,
    })),
    steps: mainSteps.map((s) => ({
      ...s,
      actor: s.actorRole?.name ?? s.actorSystem?.name ?? null,
    })),
  });

  const roles = await db.businessRole.findMany({
    where: { engagementId: sp.process.engagement.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const systems = await db.systemRef.findMany({
    where: { engagementId: sp.process.engagement.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const dataObjects = await db.dataObject.findMany({
    where: { engagementId: sp.process.engagement.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const manualCount = sp.steps.filter((s) => s.isManual).length;
  const totalMin = sp.steps.reduce((a, s) => a + (s.durationMin ?? 0), 0);
  // Vis kun "generér fra interview" mens lærredet er tomt — den må aldrig
  // kunne overskrive skridt nogen allerede har tegnet i hånden.
  const canGenerateFromInterview = mainSteps.length === 0 && transcript.length > 0;

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
      sp={{ id: sp.id, name: sp.name, assigneeId: sp.assigneeId, assignee: sp.assignee }}
      laneOrientation={sp.laneOrientation === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL"}
      users={users}
      roles={roles}
      systems={systems}
      dataObjects={dataObjects}
      lanes={sortedLanes.map((l) => ({
        id: l.id,
        isDefault: l.isDefault,
        actorRoleId: l.actorRoleId,
        actorSystemId: l.actorSystemId,
        actorName: l.actorRole?.name ?? l.actorSystem?.name ?? null,
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
      startEvents={startEvents}
      endEvents={endEvents}
      statusLabel={st.label}
      statusTone={st.tone as Tone}
      bpmnXml={bpmnXml}
      canGenerateFromInterview={canGenerateFromInterview}
      manualCount={manualCount}
      totalMin={totalMin}
      notes={notes}
      transcript={transcript}
      interviewer={interviewer}
      experts={sp.experts.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        invitedAt: e.invitedAt ? e.invitedAt.toISOString() : null,
      }))}
      validations={sp.validations.map((v) => ({
        id: v.id,
        verdict: v.verdict,
        comment: v.comment,
        validatorId: v.validatorId,
        createdAt: v.createdAt.toISOString(),
      }))}
      improvementLogs={improvementLogs.map((l) => ({
        id: l.id,
        content: l.content,
        status: l.status,
        createdAt: l.createdAt.toISOString(),
      }))}
      subProcessId={sp.id}
    />
    </>
  );
}

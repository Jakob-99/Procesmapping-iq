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
        },
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
  const bpmnXml = buildBpmnXml({
    subProcessName: sp.name,
    startEvents,
    endEvents,
    steps: mainSteps,
  });

  const manualCount = sp.steps.filter((s) => s.isManual).length;
  const totalMin = sp.steps.reduce((a, s) => a + (s.durationMin ?? 0), 0);

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
      users={users}
      startEvents={startEvents}
      endEvents={endEvents}
      statusLabel={st.label}
      statusTone={st.tone as Tone}
      bpmnXml={bpmnXml}
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

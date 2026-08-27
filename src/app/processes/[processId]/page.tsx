import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { InsightsPanel } from "@/components/InsightsPanel";
import { SubProcessCreator } from "@/components/SubProcessCreator";
import { SubProcessCard } from "@/components/SubProcessCard";
import { SendInterviewButton } from "@/components/SendInterviewButton";
import { Empty, Panel, type Tone } from "@/components/ui";
import { SUBPROCESS_STATUS, splitEvents } from "@/lib/domain";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";

export const dynamic = "force-dynamic";

export default async function ProcessPage({
  params,
}: {
  params: Promise<{ processId: string }>;
}) {
  const { processId } = await params;

  const process = await db.process.findUnique({
    where: { id: processId },
    include: {
      owner: true,
      engagement: true,
      subProcesses: {
        orderBy: { sortOrder: "asc" },
        include: {
          assignee: true,
          _count: { select: { steps: true } },
          interviews: { include: { notes: true } },
          experts: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!process) notFound();

  const users = await db.user.findMany({
    where: { organizationId: process.engagement.organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const notes = process.subProcesses.flatMap((sp) =>
    sp.interviews.flatMap((i) => i.notes),
  );

  return (
    <div>
      <SetBreadcrumb
        items={[
          { label: "Processer", href: "/processes" },
          { label: process.name },
        ]}
      />
      <PageHeader
        eyebrow={process.category === "CORE" ? "Kerneproces" : "Støtteproces"}
        title={process.name}
        action={
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="eyebrow mb-0.5">Procesejer</div>
              <div className="text-[12.5px] font-medium">
                {process.owner?.name ?? "Ikke valgt"}
              </div>
            </div>
            <SendInterviewButton
              processId={process.id}
              subProcesses={process.subProcesses
                .filter((sp) => sp.experts.length > 0)
                .map((sp) => ({
                  id: sp.id,
                  name: sp.name,
                  experts: sp.experts.map((e) => ({
                    id: e.id,
                    name: e.name,
                    email: e.email,
                    invitedAt: e.invitedAt ? e.invitedAt.toISOString() : null,
                  })),
                }))}
            />
            <Link
              href="/processes"
              className="rounded-md border border-(--color-line) bg-(--color-surface) px-3.5 py-2 text-[12.5px] text-(--color-muted) transition-colors hover:border-(--color-clay-line) hover:text-(--color-text)"
            >
              ← Tilbage
            </Link>
          </div>
        }
      />

      <div className="space-y-5 p-8">
        <Panel eyebrow={`${process.subProcesses.length} underprocesser`} title="Underprocesser" bodyClass="p-4">
          {process.startEvent && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-(--color-line-soft) bg-(--color-raised) px-4 py-2.5 text-[12px]">
              <span className="font-medium">{process.startEvent}</span>
              <span className="h-px flex-1 bg-(--color-line)" />
              <span className="font-medium">{process.endEvent}</span>
            </div>
          )}

          <SubProcessCreator processId={process.id} />

          {process.subProcesses.length === 0 ? (
            <Empty>
              Procesejeren har ikke defineret underprocesser for {process.name}{" "}
              endnu.
            </Empty>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {process.subProcesses.map((sp) => {
                const st =
                  SUBPROCESS_STATUS[
                    sp.status as keyof typeof SUBPROCESS_STATUS
                  ] ?? SUBPROCESS_STATUS.NOT_STARTED;

                return (
                  <SubProcessCard
                    key={sp.id}
                    processId={process.id}
                    users={users}
                    sp={{
                      id: sp.id,
                      name: sp.name,
                      startEvents: splitEvents(sp.startEvent),
                      endEvents: splitEvents(sp.endEvent),
                      inScope: sp.inScope,
                      scopeReason: sp.scopeReason,
                      assigneeId: sp.assigneeId,
                      assigneeName: sp.assignee?.name ?? null,
                      stepCount: sp._count.steps,
                      statusLabel: st.label,
                      statusTone: st.tone as Tone,
                    }}
                  />
                );
              })}
            </div>
          )}
        </Panel>

        <InsightsPanel notes={notes} />
      </div>
    </div>
  );
}

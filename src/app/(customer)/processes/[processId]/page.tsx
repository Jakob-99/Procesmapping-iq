import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/lib/session";
import { ProcessArea } from "@/components/ProcessArea";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";

export const dynamic = "force-dynamic";

export default async function ProcessPage({
  params,
}: {
  params: Promise<{ processId: string }>;
}) {
  const { processId } = await params;
  const sessionUser = await requireSessionUser();

  const process = await db.process.findUnique({
    where: { id: processId },
    include: {
      owner: true,
      engagement: true,
      groups: { orderBy: { sortOrder: "asc" } },
      subProcesses: {
        orderBy: { sortOrder: "asc" },
        include: { steps: { select: { stepType: true } } },
      },
    },
  });

  // 404 (ikke redirect/fejl) hvis processen slet ikke findes ELLER hører til
  // en anden organisation — ellers kan man se andre kunders processer ved
  // bare at gætte/kende et id.
  if (!process || process.engagement.organizationId !== sessionUser.organizationId) notFound();

  const users = await db.user.findMany({
    where: { organizationId: process.engagement.organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div>
      <SetBreadcrumb items={[{ label: "Processer", href: "/processes" }, { label: process.name }]} />
      <ProcessArea
        process={{
          id: process.id,
          name: process.name,
          ownerId: process.ownerId,
          ownerName: process.owner?.name ?? null,
        }}
        groups={process.groups.map((g) => ({ id: g.id, name: g.name }))}
        subProcesses={process.subProcesses.map((sp) => ({
          id: sp.id,
          name: sp.name,
          status: sp.status,
          inScope: sp.inScope,
          groupId: sp.groupId,
          assigneeId: sp.assigneeId,
          // "Tegnet" = der er mere end blot start og slut i diagrammet.
          hasDiagram: sp.steps.some((s) => s.stepType !== "START" && s.stepType !== "END"),
        }))}
        users={users}
      />
    </div>
  );
}

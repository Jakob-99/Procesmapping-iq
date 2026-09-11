import { db } from "@/lib/db";
import { requireConsultant } from "@/lib/consultant-session";
import { PageHeader } from "@/components/PageHeader";
import { Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  CREATE_CUSTOMER: "Oprettede kunde",
  GRANT_ACCESS: "Gav adgang",
  REVOKE_ACCESS: "Fjernede adgang",
  IMPERSONATE: "Åbnede som kunde",
  INVITE_CONSULTANT: "Tilføjede konsulent",
  REMOVE_CONSULTANT: "Fjernede konsulent",
  CHANGE_ROLE: "Ændrede rolle",
  PROMOTE_ADMIN: "Automatisk admin-forfremmelse",
};

export default async function AuditLogPage() {
  await requireConsultant();

  const entries = await db.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { consultant: { select: { name: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Aktivitetslog"
        lead="Tunge/følsomme handlinger foretaget i admin-panelet — hvem, hvad, hvornår."
      />
      <div className="p-8">
        {entries.length === 0 ? (
          <Empty>Ingen aktivitet endnu.</Empty>
        ) : (
          <div className="divide-y divide-(--color-line-soft) rounded-lg border border-(--color-line-soft)">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-[12.5px]">
                <div className="min-w-0">
                  <span className="font-medium">{e.consultant.name}</span>{" "}
                  <span className="text-(--color-muted)">
                    {ACTION_LABELS[e.action] ?? e.action}
                  </span>
                  {e.detail && <span className="text-(--color-faint)"> · {e.detail}</span>}
                </div>
                <div className="shrink-0 text-(--color-faint)">
                  {e.createdAt.toLocaleString("da-DK")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

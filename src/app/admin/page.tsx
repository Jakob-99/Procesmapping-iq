import Link from "next/link";
import { db } from "@/lib/db";
import { requireConsultant } from "@/lib/consultant-session";
import { PageHeader } from "@/components/PageHeader";
import { ClayButton, Panel, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  CREATE_CUSTOMER: "oprettede",
  GRANT_ACCESS: "gav adgang til",
  REVOKE_ACCESS: "fjernede adgang til",
  IMPERSONATE: "åbnede som kunde hos",
  INVITE_CONSULTANT: "tilføjede konsulent",
  REMOVE_CONSULTANT: "fjernede konsulent",
};

/* Samme lette stat-flise-mønster som BrainIntros Metric — eyebrow over, tal under. */
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-(--color-raised) px-5 py-4">
      <div className="eyebrow mb-1.5">{label}</div>
      <div className="tabular font-mono text-[19px] font-medium leading-none">{value}</div>
    </div>
  );
}

export default async function AdminDashboard() {
  const consultant = await requireConsultant();

  const [access, consultantCount, recentActivity] = await Promise.all([
    db.consultantEngagementAccess.findMany({
      where: { consultantId: consultant.id },
      include: { engagement: { include: { organization: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.consultantAccount.count(),
    db.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { consultant: { select: { name: true } } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title={`Velkommen, ${consultant.name.split(" ")[0]}`}
        lead="Overblik over dine kunder og seneste aktivitet i admin-panelet."
        action={
          <Link href="/admin/customers/new">
            <ClayButton>+ Opret virksomhed</ClayButton>
          </Link>
        }
      />

      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <Stat label="Kunder" value={access.length} />
          <Stat label="Konsulenter" value={consultantCount} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel eyebrow="Kunder" title="Seneste kunder" bodyClass="pt-1">
            {access.length === 0 ? (
              <Empty>Ingen kunder endnu — opret den første.</Empty>
            ) : (
              <div className="divide-y divide-(--color-line-soft)">
                {access.slice(0, 5).map((a) => (
                  <Link
                    key={a.id}
                    href={`/admin/customers/${a.engagement.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-[13px] hover:text-(--color-clay)"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {a.engagement.organization.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-(--color-faint)">
                      {a.engagement.name}
                    </span>
                  </Link>
                ))}
                {access.length > 5 && (
                  <Link
                    href="/admin/customers"
                    className="block pt-2.5 text-[12px] text-(--color-muted) hover:text-(--color-text)"
                  >
                    Se alle {access.length} →
                  </Link>
                )}
              </div>
            )}
          </Panel>

          <Panel eyebrow="Log" title="Seneste aktivitet" bodyClass="pt-1">
            {recentActivity.length === 0 ? (
              <Empty>Ingen aktivitet endnu.</Empty>
            ) : (
              <div className="divide-y divide-(--color-line-soft)">
                {recentActivity.map((e) => (
                  <div key={e.id} className="py-2.5 text-[12.5px]">
                    <span className="font-medium">{e.consultant.name}</span>{" "}
                    <span className="text-(--color-muted)">
                      {ACTION_LABELS[e.action] ?? e.action}
                    </span>
                    {e.detail && <span className="text-(--color-faint)"> {e.detail}</span>}
                  </div>
                ))}
                <Link
                  href="/admin/audit"
                  className="block pt-2.5 text-[12px] text-(--color-muted) hover:text-(--color-text)"
                >
                  Se hele loggen →
                </Link>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

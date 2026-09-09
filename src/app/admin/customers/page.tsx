import Link from "next/link";
import { db } from "@/lib/db";
import { requireConsultant } from "@/lib/consultant-session";
import { PageHeader } from "@/components/PageHeader";
import { ClayButton, Panel, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const consultant = await requireConsultant();

  const access = await db.consultantEngagementAccess.findMany({
    where: { consultantId: consultant.id },
    include: {
      engagement: {
        include: { organization: true, _count: { select: { respondents: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Mine kunder"
        lead="Virksomheder du som konsulent har adgang til."
        action={
          <Link href="/admin/customers/new">
            <ClayButton>+ Opret virksomhed</ClayButton>
          </Link>
        }
      />
      <div className="p-8">
        {access.length === 0 ? (
          <Empty>Ingen kunder endnu — opret den første.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {access.map((a) => (
              <Link key={a.id} href={`/admin/customers/${a.engagement.id}`}>
                <Panel className="lift h-full transition-colors hover:border-(--color-clay-line)">
                  <div className="eyebrow mb-1.5">{a.engagement.name}</div>
                  <div className="text-[15px] font-medium">{a.engagement.organization.name}</div>
                  <div className="mt-1 text-[12px] text-(--color-faint)">
                    {a.engagement._count.respondents} respondenter
                  </div>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

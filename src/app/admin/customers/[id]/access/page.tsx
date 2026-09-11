import { db } from "@/lib/db";
import { requireCustomerAccess } from "@/lib/admin/customer-access";
import { PageHeader } from "@/components/PageHeader";
import { AccessManager } from "@/components/AccessManager";
import { CustomerTabs } from "@/components/CustomerTabs";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";

export const dynamic = "force-dynamic";

export default async function CustomerAccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { consultant, access } = await requireCustomerAccess(id);
  const { engagement } = access;
  const { organization } = engagement;

  const withAccessIds = new Set(engagement.consultantAccess.map((a) => a.consultantId));
  const allConsultants = await db.consultantAccount.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <SetBreadcrumb
        items={[
          { label: "Kunder", href: "/admin/customers" },
          { label: organization.name, href: `/admin/customers/${engagement.id}` },
          { label: "Adgang" },
        ]}
      />
      <PageHeader title={organization.name} lead="Konsulent-adgang" />
      <CustomerTabs engagementId={engagement.id} />
      <div className="max-w-2xl p-8 pt-0">
        <AccessManager
          engagementId={engagement.id}
          currentId={consultant.id}
          withAccess={engagement.consultantAccess.map((a) => ({
            id: a.consultant.id,
            name: a.consultant.name,
            email: a.consultant.email,
          }))}
          withoutAccess={allConsultants
            .filter((c) => !withAccessIds.has(c.id))
            .map((c) => ({ id: c.id, name: c.name, email: c.email }))}
        />
      </div>
    </div>
  );
}

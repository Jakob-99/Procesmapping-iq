import { requireCustomerAccess } from "@/lib/admin/customer-access";
import { openCustomerAsConsultant } from "@/app/admin/actions";
import { PageHeader } from "@/components/PageHeader";
import { Panel, OutlineButton } from "@/components/ui";
import { UsersSection } from "@/components/OrgSettingsModal";
import { CustomerTabs } from "@/components/CustomerTabs";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { consultant, access } = await requireCustomerAccess(id);
  const { engagement } = access;
  const { organization } = engagement;

  return (
    <div>
      <SetBreadcrumb
        items={[
          { label: "Kunder", href: "/admin/customers" },
          { label: organization.name },
        ]}
      />
      <PageHeader title={organization.name} lead={organization.industry ?? undefined} />
      <CustomerTabs engagementId={engagement.id} />
      <div className="grid gap-4 p-8 pt-0 sm:grid-cols-3">
        <Panel eyebrow="Engagement" title={engagement.name} className="sm:col-span-3" bodyClass="pt-1">
          <div className="flex gap-6 text-[12.5px] text-(--color-muted)">
            <span>{engagement._count.respondents} respondenter</span>
            <span>{engagement._count.interviewAgents} interview agenter</span>
          </div>
        </Panel>

        <div className="sm:col-span-3">
          <UsersSection
            organizationId={organization.id}
            users={organization.users.map((u) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
            }))}
          />
        </div>

        <Panel eyebrow="Kundeflade" title="Log ind hos kunde" className="sm:col-span-3" bodyClass="pt-1">
          <p className="mb-3 text-[12px] text-(--color-faint)">
            Logger dig ind i kundefladen som dig selv ({consultant.email}).
          </p>
          <form action={openCustomerAsConsultant.bind(null, engagement.id)}>
            <OutlineButton type="submit">Log ind hos kunde</OutlineButton>
          </form>
        </Panel>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireConsultant } from "@/lib/consultant-session";
import { impersonateUser } from "@/app/admin/actions";
import { PageHeader } from "@/components/PageHeader";
import { Panel, Badge, OutlineButton } from "@/components/ui";
import { UsersSection } from "@/components/OrgSettingsModal";
import { AccessManager } from "@/components/AccessManager";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const consultant = await requireConsultant();

  const access = await db.consultantEngagementAccess.findFirst({
    where: { consultantId: consultant.id, engagementId: id },
    include: {
      engagement: {
        include: {
          organization: { include: { users: { orderBy: { name: "asc" } } } },
          _count: { select: { processes: true, systems: true } },
          consultantAccess: { include: { consultant: true } },
        },
      },
    },
  });

  // 404 hvis engagementet ikke findes, ELLER hvis denne konsulent ikke har
  // fået adgang til det — ellers kunne enhver konsulent se enhver kunde ved
  // bare at kende et id.
  if (!access) notFound();

  const { engagement } = access;
  const { organization } = engagement;

  const withAccessIds = new Set(engagement.consultantAccess.map((a) => a.consultantId));
  const allConsultants = await db.consultantAccount.findMany({ orderBy: { name: "asc" } });

  // "Åbn som kunde" er bevidst begrænset til konsulentens EGEN brugerkonto
  // hos denne kunde (samme mail) — ikke navngivne medarbejdere som Mette
  // eller Anders, selvom det havde været muligt at logge det i audit-loggen.
  const ownUser = organization.users.find(
    (u) => u.email.toLowerCase() === consultant.email.toLowerCase(),
  );

  return (
    <div>
      <SetBreadcrumb
        items={[
          { label: "Kunder", href: "/admin/customers" },
          { label: organization.name },
        ]}
      />
      <PageHeader
        title={organization.name}
        lead={organization.industry ?? undefined}
        action={<Badge tone="clay">{engagement.stage}</Badge>}
      />
      <div className="grid gap-4 p-8 sm:grid-cols-3">
        <Panel eyebrow="Engagement" title={engagement.name} className="sm:col-span-3" bodyClass="pt-1">
          <div className="flex gap-6 text-[12.5px] text-(--color-muted)">
            <span>{engagement._count.processes} processer</span>
            <span>{engagement._count.systems} systemer</span>
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

        <Panel eyebrow="Kundeflade" title="Åbn som kunde" className="sm:col-span-3" bodyClass="pt-1">
          {ownUser ? (
            <>
              <p className="mb-3 text-[12px] text-(--color-faint)">
                Logger dig ind i kundefladen med din egen brugerkonto hos denne kunde.
              </p>
              <form action={impersonateUser.bind(null, ownUser.id)}>
                <OutlineButton type="submit">Åbn som {ownUser.name}</OutlineButton>
              </form>
            </>
          ) : (
            <p className="text-[12px] text-(--color-faint)">
              Du har ingen brugerkonto hos denne kunde endnu — tilføj dig selv som bruger
              ovenfor med din egen mail ({consultant.email}) for at kunne åbne kundefladen.
            </p>
          )}
        </Panel>

        <div className="sm:col-span-3">
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
    </div>
  );
}

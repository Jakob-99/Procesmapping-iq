import { db } from "@/lib/db";
import { requireEngagement } from "@/lib/engagement";
import { PageHeader } from "@/components/PageHeader";
import { Empty } from "@/components/ui";
import { RoleCreator } from "@/components/RoleCreator";
import { RoleRow } from "@/components/RoleRow";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const engagement = await requireEngagement();

  const roles = await db.businessRole.findMany({
    where: { engagementId: engagement.id },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow={`${roles.length} roller`}
        title="Roller"
        lead="De faste roller i forretningen — menneskelige aktører, ikke navngivne personer. Hvert processkridt udføres af en rolle."
      />

      <div className="mx-auto max-w-2xl px-8 py-8">
        <RoleCreator />
        {roles.length === 0 ? (
          <Empty>Ingen roller defineret endnu.</Empty>
        ) : (
          <div className="divide-y divide-(--color-line-soft)">
            {roles.map((r) => (
              <RoleRow key={r.id} id={r.id} name={r.name} description={r.description} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

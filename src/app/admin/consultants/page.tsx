import { db } from "@/lib/db";
import { requireConsultant } from "@/lib/consultant-session";
import { PageHeader } from "@/components/PageHeader";
import { ConsultantsManager } from "@/components/ConsultantsManager";

export const dynamic = "force-dynamic";

export default async function ConsultantsPage() {
  const consultant = await requireConsultant();

  const consultants = await db.consultantAccount.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div>
      <PageHeader
        title="Konsulenter"
        lead="Cornerstones-konsulenter der kan logge ind i admin-panelet."
      />
      <div className="p-8">
        <ConsultantsManager
          currentId={consultant.id}
          currentRole={consultant.role}
          consultants={consultants.map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            role: c.role,
            createdAt: c.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}

import { PageHeader } from "@/components/PageHeader";
import { Empty, Panel } from "@/components/ui";
import { requireSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TransformationPage() {
  await requireSessionUser();

  return (
    <div>
      <PageHeader
        eyebrow="Innovation"
        title="Transformation"
        lead="Rapporter der ikke optimerer en enkelt proces, men gør hele forretningen AI native."
      />

      <div className="p-8">
        <Panel eyebrow="Rapporter" title="Transformationsrapporter" bodyClass="pt-1">
          <Empty>Kommer snart</Empty>
        </Panel>
      </div>
    </div>
  );
}

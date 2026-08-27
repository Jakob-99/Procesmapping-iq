import { PageHeader } from "@/components/PageHeader";
import { Empty, Panel } from "@/components/ui";

export default function TransformationPage() {
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

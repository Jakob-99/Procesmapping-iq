import { requireConsultant } from "@/lib/consultant-session";
import { PageHeader } from "@/components/PageHeader";
import { CreateCustomerForm } from "@/components/CreateCustomerForm";
import { SetBreadcrumb } from "@/components/BreadcrumbContext";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  await requireConsultant();

  return (
    <div>
      <SetBreadcrumb
        items={[{ label: "Kunder", href: "/admin/customers" }, { label: "Opret virksomhed" }]}
      />
      <PageHeader
        title="Opret virksomhed"
        lead="Opretter organisationen, det første engagement og den første bruger hos kunden i én omgang."
      />
      <div className="p-8">
        <CreateCustomerForm />
      </div>
    </div>
  );
}

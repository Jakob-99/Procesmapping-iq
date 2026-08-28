import { getConsultantSession } from "@/lib/consultant-session";
import { AdminTopbar } from "@/components/AdminTopbar";
import { AdminNav } from "@/components/AdminNav";
import { BreadcrumbProvider } from "@/components/BreadcrumbContext";

/*
  Adminpanelets egen skal — samme struktur som kundefladens
  Topbar+Nav+main (app/layout.tsx), men med AdminTopbar/AdminNav i stedet
  for Topbar/Nav, og sin egen BreadcrumbProvider (aldrig monteret samtidig
  med kundens, se isAdminSection i app/layout.tsx).
  Ikke gated her (ville skabe et redirect-loop med /admin/login) — hver
  beskyttet /admin-side kalder selv requireConsultant().
*/
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const consultant = await getConsultantSession();

  if (!consultant) {
    // Kun /admin/login lander her.
    return <main className="flex-1 overflow-y-auto">{children}</main>;
  }

  return (
    <BreadcrumbProvider>
      <div className="flex h-full flex-col">
        <AdminTopbar name={consultant.name} email={consultant.email} title={consultant.title} />
        <div className="flex flex-1 overflow-hidden">
          <AdminNav />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}

import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { Logo } from "@/components/Logo";
import { getConsultantSession } from "@/lib/consultant-session";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  // Allerede logget ind som konsulent — vis aldrig login-formularen oveni
  // admin-panelets eget nav, send i stedet direkte videre til dashboardet.
  const consultant = await getConsultantSession();
  if (consultant) redirect("/admin");

  return (
    <div className="dot-grid flex h-full items-center justify-center p-8">
      <div className="w-full max-w-xs text-center">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Logo size={20} />
          <span className="text-[14px] font-medium tracking-tight">
            Corner<span className="text-(--color-clay)">IQ</span>{" "}
            <span className="text-(--color-faint)">· Admin</span>
          </span>
        </div>
        <h1 className="mb-3 text-[24px] font-semibold tracking-tight">Konsulentlogin</h1>
        <p className="mb-8 text-[14px] text-(--color-faint)">
          Ikke tilgængeligt for kunder — kun Cornerstones-konsulenter.
        </p>
        <AdminLoginForm />
      </div>
    </div>
  );
}

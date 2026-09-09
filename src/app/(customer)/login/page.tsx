import { redirect } from "next/navigation";
import { PixelLogo } from "@/components/PixelLogo";
import { MainLoginForm } from "@/components/MainLoginForm";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Allerede logget ind — vis aldrig login-formularen oveni kundens eget
  // Topbar/Nav, send i stedet direkte videre til hjernen.
  const sessionUser = await getSessionUser();
  if (sessionUser) redirect("/");

  return (
    <div className="dot-grid flex h-full items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <div className="mb-9 flex justify-center">
          <PixelLogo />
        </div>
        <h1 className="mb-3 text-[28px] font-semibold tracking-tight">Log ind</h1>
        <p className="mb-8 text-[16px] text-(--color-faint)">
          Indtast din mail for at få en kode.
        </p>
        <MainLoginForm />
      </div>
    </div>
  );
}

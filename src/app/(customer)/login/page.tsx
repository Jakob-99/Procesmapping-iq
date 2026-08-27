import { PixelLogo } from "@/components/PixelLogo";
import { MainLoginForm } from "@/components/MainLoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
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

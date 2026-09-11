import { RespondentLoginForm } from "@/components/RespondentLoginForm";

export const dynamic = "force-dynamic";

export default function RespondentLoginPage() {
  return (
    <div className="dot-grid flex h-full items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        <div className="eyebrow mb-2">Corner IQ</div>
        <h1 className="mb-3 text-[24px] font-semibold tracking-tight">
          Velkommen til dit interview
        </h1>
        <p className="mb-8 text-[14px] text-(--color-faint)">
          Indtast din mail for at få en kode.
        </p>
        <RespondentLoginForm />
      </div>
    </div>
  );
}

import { LoginCodeForm } from "@/components/LoginCodeForm";

export const dynamic = "force-dynamic";

/*
  Interview-linket er det samme for alle procesksperter — koden er det der
  bekræfter hvem der svarer, før man kan vælge proces og starte.
*/
export default function InterviewLoginPage() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <div className="eyebrow mb-2">Corner IQ</div>
        <h1 className="mb-2 text-[20px] font-semibold tracking-tight">
          Indtast din kode
        </h1>
        <p className="mb-8 text-[13px] text-(--color-faint)">
          Koden fik du sammen med linket til interviewet.
        </p>
        <LoginCodeForm />
      </div>
    </div>
  );
}

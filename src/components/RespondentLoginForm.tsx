"use client";

import { useState, useTransition } from "react";
import { requestRespondentCode, loginWithRespondentCode } from "@/app/(respond)/respond/actions";
import { ClayButton } from "./ui";

/*
  Samme to-trins mønster som MainLoginForm.tsx (org-brugernes login): mail
  først, så koden — sendt på mail når Resend er sat op (se lib/mail.ts),
  ellers vist direkte på skærmen.
*/
export function RespondentLoginForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [shownCode, setShownCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submitEmail() {
    if (!email.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await requestRespondentCode(email);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      if ("code" in res) setShownCode(res.code);
      setStep("code");
    });
  }

  function submitCode() {
    if (!code.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await loginWithRespondentCode(code);
      if (res?.error) setError(res.error);
    });
  }

  if (step === "email") {
    return (
      <div className="mx-auto max-w-xs">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitEmail()}
          placeholder="din@mail.dk"
          type="email"
          autoFocus
          className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-4 py-3 text-center text-[15px] outline-none transition-colors focus:border-(--color-clay-line)"
        />
        {error && (
          <p className="mt-2 text-center text-[12.5px] text-(--color-alert)">{error}</p>
        )}
        <ClayButton
          onClick={submitEmail}
          disabled={pending || !email.trim()}
          className="mt-4 w-full justify-center !py-3"
        >
          {pending ? "Tjekker…" : "Fortsæt"}
        </ClayButton>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xs">
      {shownCode !== null ? (
        <div className="mb-4 rounded-lg border border-(--color-clay-line) bg-(--color-clay-wash) px-4 py-3 text-center">
          <div className="text-[11px] text-(--color-muted)">
            Ingen mailudsendelse endnu — din kode er
          </div>
          <div className="mt-1 text-[20px] font-semibold tracking-[0.2em] text-(--color-clay)">
            {shownCode}
          </div>
        </div>
      ) : (
        <p className="mb-4 text-center text-[13px] leading-relaxed text-(--color-muted)">
          Vi har sendt en kode til <span className="font-medium text-(--color-text)">{email}</span>.
        </p>
      )}
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submitCode()}
        placeholder="6-cifret kode"
        inputMode="numeric"
        autoFocus
        className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-4 py-3 text-center text-[18px] tracking-[0.3em] outline-none transition-colors focus:border-(--color-clay-line)"
      />
      {error && (
        <p className="mt-2 text-center text-[12.5px] text-(--color-alert)">{error}</p>
      )}
      <ClayButton
        onClick={submitCode}
        disabled={pending || !code.trim()}
        className="mt-4 w-full justify-center !py-3"
      >
        {pending ? "Logger ind…" : "Log ind"}
      </ClayButton>
    </div>
  );
}

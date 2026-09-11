"use client";

import { useState, useTransition } from "react";
import { loginWithMainCode, requestLoginCode } from "@/app/(customer)/login/actions";
import { ClayButton } from "./ui";

/*
  To trin: mail først (så vi kan slå brugeren op og generere/genbruge en
  kode), så koden. Er Resend sat op (se lib/mail.ts), er koden nu sendt på
  mail — shownCode er null, og vi beder brugeren tjekke sin indbakke.
  Fejler afsendelsen (eller er Resend slet ikke konfigureret endnu), får vi
  koden retur og viser den direkte, så login aldrig går i stå.
*/
export function MainLoginForm() {
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
      const res = await requestLoginCode(email);
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
      const res = await loginWithMainCode(code);
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
          placeholder="din@virksomhed.dk"
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

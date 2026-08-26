"use client";

import { useState, useTransition } from "react";
import { loginWithCode } from "@/app/interviews/actions";
import { ClayButton } from "./ui";

export function LoginCodeForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!code.trim() || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await loginWithCode(code);
      // Ved success redirecter serveren og koden herunder når aldrig at køre.
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="mx-auto max-w-xs">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="6-cifret kode"
        inputMode="numeric"
        autoFocus
        className="w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-4 py-3 text-center text-[18px] tracking-[0.3em] outline-none transition-colors focus:border-(--color-clay-line)"
      />
      {error && (
        <p className="mt-2 text-center text-[12.5px] text-(--color-alert)">{error}</p>
      )}
      <ClayButton
        onClick={submit}
        disabled={pending || !code.trim()}
        className="mt-4 w-full justify-center !py-3"
      >
        {pending ? "Tjekker…" : "Fortsæt"}
      </ClayButton>
    </div>
  );
}

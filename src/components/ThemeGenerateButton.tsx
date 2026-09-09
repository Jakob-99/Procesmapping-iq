"use client";

import { useState, useTransition } from "react";
import { generateThemes } from "@/app/(customer)/insights/actions";
import { ClayButton } from "./ui";

export function ThemeGenerateButton({ roundId }: { roundId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await generateThemes(roundId);
      if ("error" in res) setError(res.error);
    });
  }

  return (
    <div className="text-right">
      <ClayButton onClick={run} disabled={pending}>
        {pending ? "Analyserer…" : "Generér temaer"}
      </ClayButton>
      {error && <p className="mt-2 max-w-xs text-[12px] text-(--color-alert)">{error}</p>}
    </div>
  );
}

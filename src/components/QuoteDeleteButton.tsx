"use client";

import { useTransition } from "react";
import { deleteQuote } from "@/app/(customer)/insights/actions";

export function QuoteDeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => deleteQuote(id))}
      disabled={pending}
      className="shrink-0 text-[12px] text-(--color-faint) hover:text-(--color-alert)"
    >
      Slet
    </button>
  );
}

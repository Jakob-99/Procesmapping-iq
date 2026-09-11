"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteInterview } from "@/app/(customer)/interviews/actions";

export function DeleteInterviewButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove() {
    startTransition(async () => {
      await deleteInterview(id);
      router.push("/interviews");
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] text-(--color-alert)">Sikker? Slettes permanent.</span>
        <button
          onClick={remove}
          disabled={pending}
          className="text-[12.5px] font-medium text-(--color-alert) hover:opacity-70"
        >
          {pending ? "Sletter…" : "Ja, slet"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-[12.5px] text-(--color-faint) hover:text-(--color-text)"
        >
          Annullér
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      disabled={pending}
      className="text-[12.5px] text-(--color-faint) hover:text-(--color-alert)"
    >
      Slet interview
    </button>
  );
}

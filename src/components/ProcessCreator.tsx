"use client";

import { useState, useTransition } from "react";
import { createProcess } from "@/app/processes/actions";
import { ClayButton } from "./ui";

export function ProcessCreator() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"CORE" | "SUPPORT">("CORE");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-1.5 rounded-full border border-dashed border-(--color-line) px-3.5 py-1.5 text-[12px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
      >
        + Opret proces
      </button>
    );
  }

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createProcess(name, category);
      setName("");
      setCategory("CORE");
      setOpen(false);
    });
  }

  return (
    <div className="mb-4 max-w-md space-y-1.5 rounded-xl border border-(--color-line-soft) bg-(--color-raised) p-3.5">
      <div className="eyebrow mb-1">Ny proces</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder='Navn, fx "Order to Cash"'
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <div className="flex gap-4 pt-0.5 text-[12px] text-(--color-muted)">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={category === "CORE"}
            onChange={() => setCategory("CORE")}
          />
          Kerneproces
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={category === "SUPPORT"}
            onChange={() => setCategory("SUPPORT")}
          />
          Støtteproces
        </label>
      </div>
      <div className="flex gap-2 pt-0.5">
        <ClayButton onClick={submit} disabled={pending || !name.trim()} className="!py-1.5 !text-[12.5px]">
          Opret
        </ClayButton>
        <button
          onClick={() => setOpen(false)}
          className="text-[12px] text-(--color-faint) hover:text-(--color-text)"
        >
          Annullér
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { createDataObject } from "@/app/(customer)/data/actions";
import { ClayButton } from "./ui";

export function DataObjectCreator({ systems }: { systems: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerSystemId, setOwnerSystemId] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-1.5 rounded-full border border-dashed border-(--color-line) px-3.5 py-1.5 text-[12px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
      >
        + Tilføj kontekstobjekt
      </button>
    );
  }

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createDataObject(name, description, ownerSystemId);
      setName("");
      setDescription("");
      setOwnerSystemId("");
      setOpen(false);
    });
  }

  return (
    <div className="mb-4 max-w-md space-y-1.5 rounded-xl border border-(--color-line-soft) bg-(--color-raised) p-3.5">
      <div className="eyebrow mb-1">Nyt kontekstobjekt</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder='Navn, fx "Ordre"'
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <select
        value={ownerSystemId}
        onChange={(e) => setOwnerSystemId(e.target.value)}
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      >
        <option value="">Intet ejersystem</option>
        {systems.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Beskrivelse (valgfrit)"
        rows={2}
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
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

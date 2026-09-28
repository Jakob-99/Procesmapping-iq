"use client";

import { useState, useTransition } from "react";
import { createSystem } from "@/app/(customer)/landscape/actions";
import { ClayButton } from "./ui";
import { IntegrationPicker } from "./IntegrationPicker";
import type { IntegrationType } from "@/lib/domain";

export function SystemCreator() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [integrations, setIntegrations] = useState<IntegrationType[]>([]);
  const [isMasterData, setIsMasterData] = useState(false);
  const [notes, setNotes] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-1.5 rounded-full border border-dashed border-(--color-line) px-3.5 py-1.5 text-[12px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
      >
        + Tilføj system
      </button>
    );
  }

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createSystem(name, category, integrations, isMasterData, notes);
      setName("");
      setCategory("");
      setIntegrations([]);
      setIsMasterData(false);
      setNotes("");
      setOpen(false);
    });
  }

  return (
    <div className="mb-4 max-w-md space-y-1.5 rounded-xl border border-(--color-line-soft) bg-(--color-raised) p-3.5">
      <div className="eyebrow mb-1">Nyt system</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder='Navn, fx "Microsoft Dynamics NAV"'
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Kategori, fx ERP, CRM, BI, Fil"
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Noter (valgfrit)"
        rows={2}
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <div className="pt-1">
        <div className="mb-1.5 text-[11px] text-(--color-faint)">Integrationsmuligheder — vælg gerne flere</div>
        <IntegrationPicker value={integrations} onChange={setIntegrations} />
      </div>
      <div className="flex flex-wrap gap-4 pt-1 text-[12px] text-(--color-muted)">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={isMasterData}
            onChange={(e) => setIsMasterData(e.target.checked)}
          />
          Master data
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

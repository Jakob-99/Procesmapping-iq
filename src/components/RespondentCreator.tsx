"use client";

import { useState, useTransition } from "react";
import { createRespondent } from "@/app/(customer)/respondents/actions";
import { ClayButton } from "./ui";
import { CategoryPicker } from "./CategoryPicker";

export function RespondentCreator({ existingCategories }: { existingCategories: string[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-1.5 rounded-full border border-dashed border-(--color-line) px-3.5 py-1.5 text-[12px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
      >
        + Tilføj respondent
      </button>
    );
  }

  function submit() {
    if (!name.trim() || !email.trim()) return;
    startTransition(async () => {
      await createRespondent(name, email, title, undefined, categories);
      setName("");
      setEmail("");
      setTitle("");
      setCategories([]);
      setOpen(false);
    });
  }

  return (
    <div className="mb-4 space-y-1.5 rounded-xl border border-(--color-line-soft) bg-(--color-raised) p-3.5">
      <div className="eyebrow mb-1">Ny respondent</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Navn"
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Mail"
        type="email"
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titel (valgfrit)"
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <CategoryPicker
        value={categories}
        onChange={setCategories}
        options={existingCategories}
        placeholder="Forretningsområde(r) (valgfrit)"
      />
      <div className="flex gap-2 pt-0.5">
        <ClayButton onClick={submit} disabled={pending || !name.trim() || !email.trim()} className="!py-1.5 !text-[12.5px]">
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

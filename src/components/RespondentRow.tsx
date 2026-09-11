"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateRespondent, deleteRespondent } from "@/app/(customer)/respondents/actions";
import { ClayButton, Badge } from "./ui";

export function RespondentRow({
  id,
  name,
  email,
  title,
  category,
}: {
  id: string;
  name: string;
  email: string;
  title: string | null;
  category: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nameVal, setNameVal] = useState(name);
  const [emailVal, setEmailVal] = useState(email);
  const [titleVal, setTitleVal] = useState(title ?? "");
  const [categoryVal, setCategoryVal] = useState(category ?? "");

  function remove() {
    if (!confirm(`Slet respondenten "${name}"?`)) return;
    startTransition(() => deleteRespondent(id));
  }

  function save() {
    if (!nameVal.trim() || !emailVal.trim()) return;
    startTransition(async () => {
      await updateRespondent(id, nameVal, emailVal, titleVal, undefined, categoryVal);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="space-y-1.5 py-4">
        <input
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[13px] outline-none focus:border-(--color-clay)"
        />
        <input
          value={emailVal}
          onChange={(e) => setEmailVal(e.target.value)}
          type="email"
          className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[13px] outline-none focus:border-(--color-clay)"
        />
        <input
          value={titleVal}
          onChange={(e) => setTitleVal(e.target.value)}
          placeholder="Titel"
          className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[13px] outline-none focus:border-(--color-clay)"
        />
        <input
          value={categoryVal}
          onChange={(e) => setCategoryVal(e.target.value)}
          placeholder="Forretningsområde"
          className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[13px] outline-none focus:border-(--color-clay)"
        />
        <div className="flex gap-2 pt-0.5">
          <ClayButton onClick={save} disabled={pending} className="!py-1.5 !text-[12.5px]">
            Gem
          </ClayButton>
          <button
            onClick={() => setEditing(false)}
            className="text-[12px] text-(--color-faint) hover:text-(--color-text)"
          >
            Annullér
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex items-start justify-between gap-3 py-4 first:pt-0 ${pending ? "opacity-40" : ""}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/respondents/${id}`} className="text-[14px] font-semibold hover:text-(--color-clay) hover:underline">
            {name}
          </Link>
          {category && <Badge tone="muted">{category}</Badge>}
        </div>
        <div className="mt-0.5 text-[12.5px] text-(--color-muted)">
          {email}
          {title && <span className="text-(--color-faint)"> · {title}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => setEditing(true)}
          className="text-[11px] text-(--color-faint) hover:text-(--color-text)"
        >
          Rediger
        </button>
        <button
          onClick={remove}
          disabled={pending}
          className="text-[11px] text-(--color-faint) hover:text-(--color-alert)"
        >
          Slet
        </button>
      </div>
    </div>
  );
}

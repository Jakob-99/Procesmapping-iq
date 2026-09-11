"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { renameRound, deleteRound } from "@/app/(customer)/rounds/actions";
import { ClayButton } from "./ui";

export function RoundRow({
  id,
  name,
  interviewCount,
}: {
  id: string;
  name: string;
  interviewCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [nameVal, setNameVal] = useState(name);

  function remove() {
    if (!confirm(`Slet runden "${name}"? Alle ${interviewCount} interviews i runden slettes med.`)) return;
    startTransition(() => deleteRound(id));
  }

  function save() {
    if (!nameVal.trim()) return;
    startTransition(async () => {
      await renameRound(id, nameVal);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="space-y-1.5 py-4">
        <input
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          autoFocus
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
        <Link
          href={`/rounds/${id}`}
          className="text-[14px] font-semibold hover:text-(--color-clay) hover:underline"
        >
          {name}
        </Link>
        <div className="mt-0.5 text-[12.5px] text-(--color-muted)">{interviewCount} interviews</div>
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

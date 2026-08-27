"use client";

import { useState, useTransition } from "react";
import { addStrategicGoal, removeStrategicGoal } from "@/app/(customer)/scoping/actions";
import { ClayButton } from "./ui";

export function GoalList({ goals }: { goals: string[] }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!text.trim()) return;
    startTransition(async () => {
      await addStrategicGoal(text);
      setText("");
      setOpen(false);
    });
  }

  function remove(index: number) {
    startTransition(async () => {
      await removeStrategicGoal(index);
    });
  }

  return (
    <div>
      {goals.length > 0 && (
        <ol className="divide-y divide-(--color-line-soft)">
          {goals.map((g, i) => (
            <li key={i} className="group flex items-center gap-4 py-4 first:pt-0">
              <span className="tabular shrink-0 text-[13px] font-medium text-(--color-clay)">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-[14px] leading-relaxed text-(--color-text)">
                {g}
              </span>
              <button
                onClick={() => remove(i)}
                disabled={pending}
                title="Fjern mål"
                className="shrink-0 rounded-md px-2 py-1 text-[12px] text-(--color-faint) opacity-0 transition-opacity hover:text-(--color-alert) group-hover:opacity-100 disabled:opacity-40"
              >
                Fjern
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="pt-5">
        {open ? (
          <div className="space-y-2 rounded-xl border border-(--color-line-soft) bg-(--color-raised) p-3.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              autoFocus
              placeholder="Skriv et strategisk mål..."
              className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[13px] outline-none focus:border-(--color-clay)"
            />
            <div className="flex gap-2">
              <ClayButton onClick={submit} disabled={pending || !text.trim()} className="!py-1.5 !text-[12.5px]">
                Tilføj mål
              </ClayButton>
              <button
                onClick={() => {
                  setOpen(false);
                  setText("");
                }}
                className="text-[12px] text-(--color-faint) hover:text-(--color-text)"
              >
                Annullér
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-(--color-line) px-3.5 py-1.5 text-[12px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
          >
            + Tilføj mål
          </button>
        )}
      </div>
    </div>
  );
}

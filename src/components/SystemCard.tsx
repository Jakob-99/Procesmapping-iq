"use client";

import { useTransition } from "react";
import { deleteSystem } from "@/app/(customer)/landscape/actions";

export function SystemCard({
  id,
  name,
  category,
  isMasterData,
  canAgentConnect,
  notes,
  processCount,
}: {
  id: string;
  name: string;
  category: string | null;
  isMasterData: boolean;
  canAgentConnect: boolean;
  notes: string | null;
  processCount: number;
}) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`Slet systemet "${name}"?`)) return;
    startTransition(() => deleteSystem(id));
  }

  return (
    <div
      className={`group border-l-2 border-(--color-line) pl-4 py-1 transition-colors hover:border-(--color-clay) ${
        pending ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[14.5px] font-semibold leading-tight">{name}</span>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
              canAgentConnect ? "bg-(--color-ok)" : "bg-(--color-faint)"
            }`}
            title={canAgentConnect ? "Agent kan tale med systemet" : "Kræver et menneske"}
          />
          <button
            onClick={remove}
            disabled={pending}
            title="Slet system"
            className="text-[11px] text-(--color-faint) opacity-0 transition-opacity hover:text-(--color-alert) group-hover:opacity-100"
          >
            Slet
          </button>
        </div>
      </div>
      <div className="mt-1 text-[11px] text-(--color-faint)">
        {category ?? "Ukategoriseret"}
        {isMasterData && " · Master data"}
      </div>
      {notes && (
        <p className="mt-2 text-[12px] leading-relaxed text-(--color-muted)">{notes}</p>
      )}
      <div className="mt-3 flex items-center justify-between text-[11px] text-(--color-faint)">
        <span>{canAgentConnect ? "Agent-tilgængelig" : "Menneske krævet"}</span>
        <span className="tabular">
          {processCount} {processCount === 1 ? "proces" : "processer"}
        </span>
      </div>
    </div>
  );
}

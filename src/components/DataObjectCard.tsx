"use client";

import { useTransition } from "react";
import { deleteDataObject } from "@/app/data/actions";
import { Badge } from "./ui";

export function DataObjectCard({
  id,
  name,
  description,
  ownerSystemName,
  isMasterData,
  agentAvailable,
  inputCount,
  outputCount,
  processNames,
}: {
  id: string;
  name: string;
  description: string | null;
  ownerSystemName: string | null;
  isMasterData: boolean;
  agentAvailable: boolean;
  inputCount: number;
  outputCount: number;
  processNames: string[];
}) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`Slet kontekstobjektet "${name}"?`)) return;
    startTransition(() => deleteDataObject(id));
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
          {isMasterData && <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-ok)" />}
          <button
            onClick={remove}
            disabled={pending}
            title="Slet kontekstobjekt"
            className="text-[11px] text-(--color-faint) opacity-0 transition-opacity hover:text-(--color-alert) group-hover:opacity-100"
          >
            Slet
          </button>
        </div>
      </div>
      <div className="mt-1 text-[11px] text-(--color-faint)">
        {ownerSystemName ?? "Ingen ejersystem"}
        {isMasterData && " · Master data"}
      </div>
      {description && (
        <p className="mt-2 text-[12px] leading-relaxed text-(--color-muted)">{description}</p>
      )}
      <div className="mt-3 flex items-center justify-between text-[11px] text-(--color-faint)">
        <span>{agentAvailable ? "Agent-tilgængelig" : "Menneske krævet"}</span>
        <span className="tabular flex items-center gap-2.5">
          <span title="Brugt som input">↓ {inputCount}</span>
          <span title="Brugt som output">↑ {outputCount}</span>
        </span>
      </div>
      {processNames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {processNames.map((p) => (
            <Badge key={p} tone="faint">
              {p}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

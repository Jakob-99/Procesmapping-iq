"use client";

import { useTransition } from "react";
import { deleteDataObject } from "@/app/(customer)/data/actions";
import { InlineDelete } from "./InlineDelete";
import { CardShell, Tag, UsageList, type Usage } from "./EntityParts";

export function DataObjectCard({
  id,
  name,
  description,
  ownerSystemName,
  isMasterData,
  agentAvailable,
  inputCount,
  outputCount,
  usage,
}: {
  id: string;
  name: string;
  description: string | null;
  ownerSystemName: string | null;
  isMasterData: boolean;
  agentAvailable: boolean;
  inputCount: number;
  outputCount: number;
  usage: Usage[];
}) {
  const [pending, startTransition] = useTransition();
  const total = inputCount + outputCount;

  return (
    <CardShell pending={pending}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold leading-tight">{name}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {ownerSystemName ? <Tag>Ligger i {ownerSystemName}</Tag> : <Tag>Intet ejersystem</Tag>}
            {isMasterData && <Tag tone="clay">Stamdata</Tag>}
          </div>
        </div>
        <InlineDelete
          onConfirm={() => startTransition(() => deleteDataObject(id))}
          pending={pending}
          title={`Slet dataobjektet "${name}"`}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        />
      </div>

      {description && <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-(--color-muted)">{description}</p>}

      {/* Læses (input) og skrives (output) — som en delt bjælke */}
      {total > 0 && (
        <div className="mt-3">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-(--color-sunken)">
            <div className="h-full bg-(--color-clay) opacity-50" style={{ width: `${(inputCount / total) * 100}%` }} />
            <div className="h-full bg-(--color-clay)" style={{ width: `${(outputCount / total) * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10.5px] text-(--color-faint)">
            <span>Læses i {inputCount} skridt</span>
            <span>Skrives i {outputCount} skridt</span>
          </div>
        </div>
      )}

      <div className="flex-1">
        <UsageList usage={usage} />
      </div>

      <div className="mt-4 flex items-center gap-1.5 border-t border-(--color-line-soft) pt-3 text-[11px] text-(--color-faint)">
        <span className={`h-1.5 w-1.5 rounded-full ${agentAvailable ? "bg-(--color-ok)" : "bg-(--color-faint)"}`} />
        {agentAvailable ? "En AI-agent kan hente det direkte" : "Kræver et menneske at hente"}
      </div>
    </CardShell>
  );
}

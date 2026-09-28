"use client";

import { useState, useTransition } from "react";
import { deleteSystem, setSystemIntegrations } from "@/app/(customer)/landscape/actions";
import { InlineDelete } from "./InlineDelete";
import { CardShell, Tag, UsageList, type Usage } from "./EntityParts";
import { IntegrationPicker } from "./IntegrationPicker";
import { agentCanConnect, type IntegrationType } from "@/lib/domain";

export function SystemCard({
  id,
  name,
  category,
  isMasterData,
  integrations,
  notes,
  usage,
  actorCount,
}: {
  id: string;
  name: string;
  category: string | null;
  isMasterData: boolean;
  integrations: IntegrationType[];
  notes: string | null;
  usage: Usage[];
  actorCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  // Vises med det samme; gemmes i baggrunden.
  const [list, setList] = useState(integrations);

  function change(next: IntegrationType[]) {
    setList(next);
    startSaving(() => setSystemIntegrations(id, next));
  }

  const agent = agentCanConnect(list);

  return (
    <CardShell pending={pending}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold leading-tight">{name}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {category && <Tag>{category}</Tag>}
            {isMasterData && <Tag tone="clay">Stamdata</Tag>}
            {actorCount > 0 && <Tag>Aktør i {actorCount} skridt</Tag>}
          </div>
        </div>
        <InlineDelete
          onConfirm={() => startTransition(() => deleteSystem(id))}
          pending={pending}
          title={`Slet systemet "${name}"`}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        />
      </div>

      {notes && <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-(--color-muted)">{notes}</p>}

      <div className="flex-1">
        <UsageList usage={usage} />
      </div>

      <div className="mt-4 border-t border-(--color-line-soft) pt-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-(--color-faint)">
          Integration
          {saving && <span className="normal-case tracking-normal">· gemmer…</span>}
        </div>
        <IntegrationPicker value={list} onChange={change} />
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-(--color-faint)">
          <span className={`h-1.5 w-1.5 rounded-full ${agent ? "bg-(--color-ok)" : "bg-(--color-faint)"}`} />
          {list.length === 0
            ? "Ikke afklaret endnu"
            : agent
              ? "En AI-agent kan komme til systemet"
              : "Kun manuelt — kræver et menneske"}
        </div>
      </div>
    </CardShell>
  );
}

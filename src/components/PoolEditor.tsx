"use client";

import { useState, useTransition } from "react";
import { createPool, deletePool, renamePool } from "@/app/(customer)/processes/[processId]/[subId]/actions";
import { createRole } from "@/app/(customer)/roles/actions";
import { createSystem } from "@/app/(customer)/landscape/actions";
import { InlineDelete } from "./InlineDelete";

type Option = { id: string; name: string };

const NEW_ROLE = "__new_role__";
const NEW_SYSTEM = "__new_system__";

/*
  Opret eller redigér en pool — en selvstændig ramme i diagrammet med egen
  titel og egne svimlaner (typisk en ekstern part). poolId "__new__" viser
  opret-formularen: navn og den første svimlanes aktør. Ellers: omdøb eller
  slet. Hovedpoolen (underprocessens navn) redigeres ikke her.
*/
export function PoolEditor({
  processId,
  subProcessId,
  poolId,
  pools,
  roles,
  systems,
  onDone,
}: {
  processId: string;
  subProcessId: string;
  poolId: string;
  pools: Option[];
  roles: Option[];
  systems: Option[];
  onDone: () => void;
}) {
  const isNew = poolId === "__new__";
  const pool = pools.find((p) => p.id === poolId);
  const [name, setName] = useState(pool?.name ?? "");
  const [actor, setActor] = useState("");
  const [newActorName, setNewActorName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isNew && !pool) return null;

  function create() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        let first: { type: "role" | "system"; id: string } | null = null;
        if (actor === NEW_ROLE || actor === NEW_SYSTEM) {
          const actorName = newActorName.trim() || name.trim();
          const created = actor === NEW_ROLE ? await createRole(actorName) : await createSystem(actorName);
          if (created) first = { type: actor === NEW_ROLE ? "role" : "system", id: created.id };
        } else if (actor) {
          first = { type: actor.startsWith("role:") ? "role" : "system", id: actor.split(":")[1] };
        }
        await createPool(processId, subProcessId, name, first);
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kunne ikke oprette poolen.");
      }
    });
  }

  function rename() {
    if (!pool || !name.trim() || name.trim() === pool.name) return;
    startTransition(() => renamePool(processId, subProcessId, pool.id, name));
  }

  const input =
    "w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)";

  return (
    <div>
      <h2 className="text-[15px] font-semibold tracking-tight">{isNew ? "Ny pool" : "Pool"}</h2>
      <div className="mb-3 mt-1.5 border-t border-(--color-line)" />
      <div className="space-y-3">
        <div>
          <div className="eyebrow mb-1">Titel</div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={isNew ? undefined : rename}
            onKeyDown={(e) => e.key === "Enter" && (isNew ? create() : rename())}
            placeholder='Fx "Rekrutteringspartner"'
            className={input}
          />
        </div>

        {isNew && (
          <div>
            <div className="eyebrow mb-1">Første svimlane</div>
            <select value={actor} onChange={(e) => setActor(e.target.value)} className={input}>
              <option value="">Vælg rolle eller system…</option>
              <optgroup label="Roller">
                {roles.map((r) => (
                  <option key={r.id} value={`role:${r.id}`}>
                    {r.name}
                  </option>
                ))}
                <option value={NEW_ROLE}>+ Ny rolle…</option>
              </optgroup>
              <optgroup label="Systemer">
                {systems.map((s) => (
                  <option key={s.id} value={`system:${s.id}`}>
                    {s.name}
                  </option>
                ))}
                <option value={NEW_SYSTEM}>+ Nyt system…</option>
              </optgroup>
            </select>
            {(actor === NEW_ROLE || actor === NEW_SYSTEM) && (
              <input
                value={newActorName}
                onChange={(e) => setNewActorName(e.target.value)}
                placeholder={`Navn — tomt bruger poolens titel`}
                className={`${input} mt-1.5`}
              />
            )}
          </div>
        )}

        {isNew ? (
          <button
            type="button"
            onClick={create}
            disabled={pending || !name.trim()}
            className="rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-3 py-1.5 text-[12.5px] font-medium text-(--color-clay) transition-colors hover:bg-(--color-clay-line) disabled:opacity-40"
          >
            {pending ? "Opretter…" : "Opret pool"}
          </button>
        ) : (
          <InlineDelete
            label="Slet pool"
            title="Svimlanerne flytter tilbage til hovedpoolen"
            pending={pending}
            onConfirm={() =>
              startTransition(async () => {
                await deletePool(processId, subProcessId, pool!.id);
                onDone();
              })
            }
          />
        )}
      </div>
      {error && <p className="mt-2 text-[11.5px] text-(--color-alert)">{error}</p>}
    </div>
  );
}

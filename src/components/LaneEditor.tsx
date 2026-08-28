"use client";

import { useState, useTransition } from "react";
import {
  createLane,
  deleteLane,
  setLaneActor,
} from "@/app/(customer)/processes/[processId]/[subId]/actions";
import { createSystem } from "@/app/(customer)/landscape/actions";
import { createRole } from "@/app/(customer)/roles/actions";

const NEW_ROLE = "__new_role__";
const NEW_SYSTEM = "__new_system__";

type LaneOption = {
  id: string;
  isDefault: boolean;
  actorRoleId: string | null;
  actorSystemId: string | null;
  actorName: string | null;
};
type RoleOption = { id: string; name: string };
type SystemOption = { id: string; name: string };

/*
  Svimlanerne er nu selvstændige objekter — klik på en svimlanes header i
  lærredet (BpmnViewer.onElementClick, kind "lane") åbner dette panel i
  stedet for at forblive dødt. laneId er enten en rigtig ProcessLane.id eller
  sentinelen "__new__" (fra "+ Svimlane"-knappen i topbjælken), som viser
  opret-formularen i stedet for redigér.
*/
export function LaneEditor({
  processId,
  subProcessId,
  laneId,
  lanes,
  roles,
  systems,
  onDone,
}: {
  processId: string;
  subProcessId: string;
  laneId: string;
  lanes: LaneOption[];
  roles: RoleOption[];
  systems: SystemOption[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [creatingActor, setCreatingActor] = useState<"role" | "system" | null>(null);
  const [newActorName, setNewActorName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const lane = laneId === "__new__" ? null : lanes.find((l) => l.id === laneId);
  const isNew = laneId === "__new__";

  if (!isNew && !lane) return null;

  const currentValue = lane?.actorRoleId
    ? `role:${lane.actorRoleId}`
    : lane?.actorSystemId
      ? `system:${lane.actorSystemId}`
      : "";

  function applyActor(value: string) {
    if (value === NEW_ROLE) return setCreatingActor("role");
    if (value === NEW_SYSTEM) return setCreatingActor("system");
    if (!value) return;
    const actor = {
      type: value.startsWith("role:") ? ("role" as const) : ("system" as const),
      id: value.split(":")[1],
    };
    setError(null);
    startTransition(async () => {
      try {
        if (isNew) await createLane(processId, subProcessId, actor);
        else await setLaneActor(processId, subProcessId, laneId, actor);
        onDone();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kunne ikke gemme.");
      }
    });
  }

  function createActor() {
    if (!newActorName.trim() || !creatingActor) return;
    setError(null);
    startTransition(async () => {
      try {
        const created =
          creatingActor === "role"
            ? await createRole(newActorName)
            : await createSystem(newActorName);
        if (created) {
          const actor = { type: creatingActor, id: created.id };
          if (isNew) await createLane(processId, subProcessId, actor);
          else await setLaneActor(processId, subProcessId, laneId, actor);
          onDone();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kunne ikke gemme.");
      } finally {
        setCreatingActor(null);
        setNewActorName("");
      }
    });
  }

  function remove() {
    if (!lane || lane.isDefault) return;
    if (!confirm("Slet denne svimlane? Skridtene i den mister deres aktør og falder tilbage i Proces.")) return;
    startTransition(async () => {
      await deleteLane(processId, subProcessId, lane.id);
      onDone();
    });
  }

  const actorSelect = (
    <select
      value={currentValue}
      disabled={pending}
      onChange={(e) => applyActor(e.target.value)}
      className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
    >
      <option value="">Vælg rolle eller system…</option>
      <optgroup label="Roller">
        {roles.map((r) => (
          <option key={r.id} value={`role:${r.id}`}>
            {r.name}
          </option>
        ))}
        <option value={NEW_ROLE}>+ Opret ny rolle…</option>
      </optgroup>
      <optgroup label="Systemer">
        {systems.map((s) => (
          <option key={s.id} value={`system:${s.id}`}>
            {s.name}
          </option>
        ))}
        <option value={NEW_SYSTEM}>+ Opret nyt system…</option>
      </optgroup>
    </select>
  );

  return (
    <div>
      <h2 className="mb-3 text-[15px] font-semibold tracking-tight">
        {isNew ? "Ny svimlane" : lane?.isDefault ? "Proces (grundlæggende)" : "Svimlane"}
      </h2>

      {lane?.isDefault ? (
        <p className="text-[12.5px] leading-relaxed text-(--color-muted)">
          Dette er den grundlæggende svimlane — den samler alle skridt uden en
          tildelt aktør. Den kan ikke slettes eller tildeles en rolle/system.
          Byg videre på den ved at oprette flere svimlaner med "+ Svimlane" i
          topbjælken.
        </p>
      ) : (
        <div className="space-y-3">
          <div>
            <div className="eyebrow mb-1">{isNew ? "Rolle eller system" : "Aktør"}</div>
            {creatingActor ? (
              <div className="flex gap-1">
                <input
                  value={newActorName}
                  onChange={(e) => setNewActorName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createActor()}
                  autoFocus
                  placeholder={creatingActor === "role" ? "Ny rolle" : "Nyt system"}
                  className="min-w-0 flex-1 rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
                />
                <button
                  onClick={createActor}
                  disabled={pending || !newActorName.trim()}
                  className="shrink-0 rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-2.5 text-[11.5px] font-medium text-(--color-clay) disabled:opacity-40"
                >
                  Opret
                </button>
                <button
                  onClick={() => {
                    setCreatingActor(null);
                    setNewActorName("");
                  }}
                  className="shrink-0 text-[11px] text-(--color-faint) hover:text-(--color-text)"
                >
                  Annullér
                </button>
              </div>
            ) : (
              actorSelect
            )}
          </div>

          {!isNew && !lane?.isDefault && (
            <button
              onClick={remove}
              disabled={pending}
              className="text-[11.5px] text-(--color-alert) hover:underline disabled:opacity-40"
            >
              Slet svimlane
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-[11.5px] text-(--color-alert)">{error}</p>}
    </div>
  );
}

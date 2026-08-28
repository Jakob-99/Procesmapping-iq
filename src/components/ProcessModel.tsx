"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { deleteProcess, reorderProcesses } from "@/app/(customer)/processes/actions";

/*
  Procesmodellen — virksomhedens landkort.

  Kerneprocesser står øverst som brede kort: det er dem værdien løber igennem.
  Støtteprocesser ligger under som pilleformede felter, fordi de bærer resten
  uden selv at være rejsen. Nummereringen i hjørnet er den man peger på i et møde.

  Kortene kan trækkes rundt — venstre/højre og top/bund i grid'et er bare
  rækkefølgen (sortOrder), så man selv kan flytte fx en kerneproces fra højre
  til venstre side.
*/

type P = {
  id: string;
  name: string;
  category: string;
  owner: { name: string } | null;
  subProcesses: { inScope: boolean; status: string }[];
};

function progress(p: P) {
  const subs = p.subProcesses.filter((s) => s.inScope);
  if (!subs.length) return 0;
  return Math.round(
    (subs.filter((s) => s.status === "VALIDATED").length / subs.length) * 100,
  );
}

function Tile({
  p,
  index,
  core,
  dragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  p: P;
  index: number;
  core: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const pct = progress(p);
  const [pending, startTransition] = useTransition();

  function remove(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Slet processen "${p.name}" og alle dens underprocesser?`)) return;
    startTransition(() => deleteProcess(p.id));
  }

  return (
    <Link
      href={`/processes/${p.id}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      className={`lift lift-hover group relative block cursor-grab overflow-hidden border-2 border-(--color-line) bg-(--color-surface) active:cursor-grabbing hover:border-(--color-clay-line) ${
        core ? "rounded-2xl px-5 py-5" : "rounded-full px-5 py-3"
      } ${pending || dragging ? "opacity-40" : ""}`}
    >
      {/* Fremdriften ligger som en tynd stribe i bunden — aflæses uden at forstyrre */}
      <span
        className="absolute inset-x-0 bottom-0 h-[3px] bg-(--color-clay) opacity-70 transition-all"
        style={{ width: `${pct}%` }}
      />

      <button
        onClick={remove}
        disabled={pending}
        title="Slet proces"
        className="absolute right-2.5 top-2.5 rounded-md bg-(--color-surface) px-1.5 py-0.5 text-[11px] text-(--color-faint) opacity-70 transition-opacity hover:text-(--color-alert) group-hover:opacity-100"
      >
        Slet
      </button>

      <span className="tabular absolute bottom-2 right-3.5 font-mono text-[11px] text-(--color-faint)">
        {String(index).padStart(2, "0")}
      </span>

      <div className={core ? "" : "pr-6"}>
        <div
          className={`font-semibold tracking-tight ${
            core ? "text-[15px]" : "text-[13.5px]"
          }`}
        >
          {p.name}
        </div>

        {core && (
          <div className="mt-2 text-[11.5px] text-(--color-faint)">
            {p.owner ? p.owner.name : "Ingen procesejer"}
            {" · "}
            <span className="tabular">
              {(() => {
                const subs = p.subProcesses.filter((s) => s.inScope);
                const done = subs.filter((s) => s.status === "VALIDATED").length;
                return `${done}/${subs.length} kortlagt`;
              })()}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function TileGroup({
  list,
  core,
  offset,
  onReorder,
}: {
  list: P[];
  core: boolean;
  offset: number;
  onReorder: (newIds: string[]) => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  function drop(targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    const fromIndex = list.findIndex((p) => p.id === draggedId);
    const toIndex = list.findIndex((p) => p.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const reordered = [...list];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    onReorder(reordered.map((p) => p.id));
    setDraggedId(null);
  }

  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${core ? "" : "gap-3"}`}>
      {list.map((p, i) => (
        <Tile
          key={p.id}
          p={p}
          index={offset + i + 1}
          core={core}
          dragging={draggedId === p.id}
          onDragStart={() => setDraggedId(p.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => drop(p.id)}
          onDragEnd={() => setDraggedId(null)}
        />
      ))}
    </div>
  );
}

export function ProcessModel({ processes }: { processes: P[] }) {
  const [items, setItems] = useState(processes);
  useEffect(() => setItems(processes), [processes]);
  const [, startTransition] = useTransition();

  const core = items.filter((p) => p.category === "CORE");
  const support = items.filter((p) => p.category !== "CORE");

  const allSubs = items.flatMap((p) => p.subProcesses.filter((s) => s.inScope));
  const mapped = allSubs.filter((s) => s.status === "VALIDATED").length;

  function reorderCore(newIds: string[]) {
    const byId = new Map(items.map((p) => [p.id, p]));
    setItems([...newIds.map((id) => byId.get(id)!), ...support]);
    startTransition(() => reorderProcesses(newIds));
  }

  function reorderSupport(newIds: string[]) {
    const byId = new Map(items.map((p) => [p.id, p]));
    setItems([...core, ...newIds.map((id) => byId.get(id)!)]);
    startTransition(() => reorderProcesses(newIds));
  }

  return (
    <div className="rounded-xl bg-(--color-sunken) p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <div className="eyebrow">Kerneprocesser</div>
        <div className="text-[11px] text-(--color-faint)">
          <span className="tabular font-medium text-(--color-text)">{mapped}</span>
          <span className="tabular"> af {allSubs.length}</span> underprocesser kortlagt
        </div>
      </div>
      <TileGroup list={core} core offset={0} onReorder={reorderCore} />

      <div className="my-5 h-px bg-(--color-line)" />

      <div className="eyebrow mb-3">Støtteprocesser</div>
      <TileGroup list={support} core={false} offset={core.length} onReorder={reorderSupport} />
    </div>
  );
}

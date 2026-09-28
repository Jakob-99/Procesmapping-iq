"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  createSubProcess,
  createSubProcessGroup,
  deleteSubProcessGroup,
  moveSubProcessToGroup,
  renameSubProcessGroup,
  updateProcess,
} from "@/app/(customer)/processes/actions";
import {
  deleteSubProcess,
  renameSubProcess,
  setSubProcessScope,
} from "@/app/(customer)/processes/[processId]/[subId]/actions";
import { AssigneeSelect } from "./AssigneeSelect";
import { InlineDelete } from "./InlineDelete";

/*
  Procesområdets side — samme layout som områdesiden i Cornerstones'
  procesmodel: overskrift med områdeejer, og underprocesserne som fliser i
  grupper (fx "Rekrutering" under HR). Flisens farve er dens status, og et
  lille diagram-ikon viser at underprocessen er tegnet.
*/

type Sub = {
  id: string;
  name: string;
  status: string;
  inScope: boolean;
  groupId: string | null;
  assigneeId: string | null;
  hasDiagram: boolean;
};
type Group = { id: string; name: string };
type UserOption = { id: string; name: string };

function tone(sp: Sub) {
  if (!sp.inScope) return "border-dashed border-(--color-line) bg-(--color-surface) text-(--color-faint)";
  if (sp.status === "VALIDATED") return "border-(--color-text) bg-(--color-text) text-white";
  if (sp.status === "NOT_STARTED") return "border-(--color-line) bg-(--color-surface) text-(--color-text)";
  return "border-(--color-clay-soft) bg-(--color-clay-wash) text-(--color-text)";
}

function DiagramIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function ProcessArea({
  process,
  groups,
  subProcesses,
  users,
}: {
  process: { id: string; name: string; ownerId: string | null; ownerName: string | null };
  groups: Group[];
  subProcesses: Sub[];
  users: UserOption[];
}) {
  const ungrouped = subProcesses.filter((s) => !s.groupId || !groups.some((g) => g.id === s.groupId));
  const sections: { group: Group | null; subs: Sub[] }[] = [
    ...(ungrouped.length || groups.length === 0 ? [{ group: null, subs: ungrouped }] : []),
    ...groups.map((g) => ({ group: g, subs: subProcesses.filter((s) => s.groupId === g.id) })),
  ];

  return (
    <div className="px-8 py-6">
      <Link
        href="/processes"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-(--color-muted) transition-colors hover:text-(--color-clay)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Alle procesområder
      </Link>

      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4 border-b border-(--color-line) pb-5">
        <h1 className="text-[30px] font-semibold leading-tight tracking-tight">{process.name}</h1>
        <OwnerPicker process={process} users={users} />
      </div>

      <div className="space-y-6">
        {sections.map(({ group, subs }) => (
          <GroupBox
            key={group?.id ?? "ungrouped"}
            processId={process.id}
            group={group}
            subs={subs}
            groups={groups}
            users={users}
          />
        ))}
      </div>

      <NewGroup processId={process.id} />

      <div className="mt-9 flex flex-wrap gap-5 border-t border-(--color-line) pt-5">
        {[
          ["border-(--color-line) bg-(--color-surface)", "Ikke startet"],
          ["border-(--color-clay-soft) bg-(--color-clay-wash)", "Procesudkast"],
          ["border-(--color-text) bg-(--color-text)", "Godkendt proces"],
          ["border-dashed border-(--color-line) bg-(--color-surface)", "Ude af scope"],
        ].map(([cls, label]) => (
          <div key={label} className="flex items-center gap-2 text-[12.5px] text-(--color-muted)">
            <span className={`h-4 w-4 shrink-0 rounded-sm border ${cls}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnerPicker({
  process,
  users,
}: {
  process: { id: string; ownerId: string | null; ownerName: string | null };
  users: UserOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <select
        autoFocus
        value={process.ownerId ?? ""}
        disabled={pending}
        onBlur={() => setEditing(false)}
        onChange={(e) => {
          const ownerId = e.target.value || null;
          startTransition(async () => {
            await updateProcess(process.id, { ownerId });
            setEditing(false);
          });
        }}
        className="rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[13px] outline-none focus:border-(--color-clay)"
      >
        <option value="">Ingen områdeejer</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Skift områdeejer"
      className="whitespace-nowrap text-[14px] text-(--color-muted) transition-colors hover:text-(--color-clay)"
    >
      Områdeejer: {process.ownerName ?? "ikke valgt"}
    </button>
  );
}

function GroupBox({
  processId,
  group,
  subs,
  groups,
  users,
}: {
  processId: string;
  group: Group | null;
  subs: Sub[];
  groups: Group[];
  users: UserOption[];
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group?.name ?? "");
  const [pending, startTransition] = useTransition();

  function saveName() {
    setRenaming(false);
    if (!group || !name.trim() || name.trim() === group.name) return;
    startTransition(() => renameSubProcessGroup(processId, group.id, name));
  }

  return (
    <section className={`rounded-lg border border-dashed border-(--color-line) bg-(--color-raised) p-[18px] ${pending ? "opacity-50" : ""}`}>
      {group && (
        <div className="group/title mb-3.5 flex items-center gap-3">
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1 text-[12.5px] font-bold uppercase tracking-[0.06em] outline-none focus:border-(--color-clay)"
            />
          ) : (
            <h3
              onClick={() => setRenaming(true)}
              title="Omdøb gruppen"
              className="cursor-text text-[12.5px] font-bold uppercase tracking-[0.06em] text-(--color-text)"
            >
              {group.name}
            </h3>
          )}
          <InlineDelete
            onConfirm={() => startTransition(() => deleteSubProcessGroup(processId, group.id))}
            pending={pending}
            title="Slet gruppen — underprocesserne bliver liggende"
            label="Slet gruppe"
            className="opacity-0 transition-opacity group-hover/title:opacity-100"
          />
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
        {subs.map((sp) => (
          <SubTile key={sp.id} processId={processId} sp={sp} groups={groups} users={users} />
        ))}
        <NewSubTile processId={processId} groupId={group?.id ?? null} />
      </div>
    </section>
  );
}

function SubTile({
  processId,
  sp,
  groups,
  users,
}: {
  processId: string;
  sp: Sub;
  groups: Group[];
  users: UserOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sp.name);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <div className="col-span-2 space-y-2.5 rounded-md border border-(--color-clay-line) bg-(--color-surface) p-3.5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== sp.name && startTransition(() => renameSubProcess(processId, sp.id, name))}
          className="w-full rounded-md border border-(--color-line) px-2.5 py-1.5 text-[13.5px] font-medium outline-none focus:border-(--color-clay)"
        />
        <div>
          <div className="eyebrow mb-1">Gruppe</div>
          <select
            value={sp.groupId ?? ""}
            disabled={pending}
            onChange={(e) => {
              const groupId = e.target.value || null;
              startTransition(() => moveSubProcessToGroup(processId, sp.id, groupId));
            }}
            className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
          >
            <option value="">Uden gruppe</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="eyebrow mb-1">Ansvarlig</div>
          <AssigneeSelect processId={processId} subProcessId={sp.id} assigneeId={sp.assigneeId} users={users} className="w-full" />
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-(--color-muted)">
          <input
            type="checkbox"
            checked={!sp.inScope}
            disabled={pending}
            onChange={(e) => {
              const out = e.target.checked;
              startTransition(() => setSubProcessScope(processId, sp.id, !out));
            }}
          />
          Ude af scope
        </label>
        <div className="flex items-center justify-between pt-0.5">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-[12px] font-medium text-(--color-clay) hover:underline"
          >
            Færdig
          </button>
          <InlineDelete
            onConfirm={() => startTransition(() => deleteSubProcess(processId, sp.id))}
            pending={pending}
            title={`Slet underprocessen "${sp.name}"`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`group/tile relative ${pending ? "opacity-40" : ""}`}>
      <Link
        href={`/processes/${processId}/${sp.id}`}
        className={`flex min-h-[64px] items-center rounded-md border px-3.5 py-3 pr-8 text-[14px] leading-snug transition-colors hover:border-(--color-clay) ${tone(sp)}`}
      >
        {sp.name}
      </Link>
      {sp.hasDiagram && (
        <span
          className={`pointer-events-none absolute right-3 top-3 ${
            sp.inScope && sp.status === "VALIDATED" ? "text-white" : "text-(--color-clay)"
          }`}
          title="Har et procesdiagram"
        >
          <DiagramIcon />
        </span>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`absolute bottom-1.5 right-2 rounded px-1 text-[10.5px] opacity-0 transition-opacity group-hover/tile:opacity-100 ${
          sp.inScope && sp.status === "VALIDATED" ? "text-white/80 hover:text-white" : "text-(--color-faint) hover:text-(--color-clay)"
        }`}
      >
        Rediger
      </button>
    </div>
  );
}

function NewSubTile({ processId, groupId }: { processId: string; groupId: string | null }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim()) return setOpen(false);
    startTransition(async () => {
      await createSubProcess(processId, name, undefined, undefined, groupId);
      setName("");
      setOpen(false);
    });
  }

  if (open) {
    return (
      <div className="flex min-h-[64px] items-center rounded-md border border-(--color-clay-line) bg-(--color-surface) px-2">
        <input
          autoFocus
          value={name}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Navn på underproces"
          className="w-full bg-transparent px-1.5 py-1 text-[13.5px] outline-none placeholder:text-(--color-faint)"
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex min-h-[64px] items-center rounded-md border border-dashed border-(--color-line) px-3.5 text-left text-[13px] text-(--color-faint) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
    >
      + Underproces
    </button>
  );
}

function NewGroup({ processId }: { processId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim()) return setOpen(false);
    startTransition(async () => {
      await createSubProcessGroup(processId, name);
      setName("");
      setOpen(false);
    });
  }

  if (open) {
    return (
      <div className="mt-6 flex max-w-sm items-center gap-2">
        <input
          autoFocus
          value={name}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder='Gruppens navn, fx "Rekrutering"'
          className="flex-1 rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[13px] outline-none focus:border-(--color-clay)"
        />
        <button type="button" onClick={submit} className="text-[12.5px] font-medium text-(--color-clay) hover:underline">
          Opret
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[12.5px] text-(--color-faint) hover:text-(--color-text)">
          Annullér
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="mt-6 rounded-full border border-dashed border-(--color-line) px-3.5 py-1.5 text-[12px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
    >
      + Ny gruppe
    </button>
  );
}

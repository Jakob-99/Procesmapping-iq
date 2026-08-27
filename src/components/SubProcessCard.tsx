"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { renameSubProcess } from "@/app/(customer)/processes/[processId]/[subId]/actions";
import { TriggerList } from "./TriggerList";
import { AssigneeSelect } from "./AssigneeSelect";
import { Badge, type Tone } from "./ui";

type Sp = {
  id: string;
  name: string;
  startEvents: string[];
  endEvents: string[];
  inScope: boolean;
  scopeReason: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  stepCount: number;
  statusLabel: string;
  statusTone: Tone;
};

type UserOption = { id: string; name: string };

/*
  Kortet kan redigeres direkte fra procesoversigten — titel og starter/slutter
  når — uden at åbne underprocessens egen arbejdsflade. "Rediger" folder
  kortet ud til en lille formular i stedet for at navigere væk.
*/
export function SubProcessCard({
  processId,
  sp,
  users,
}: {
  processId: string;
  sp: Sp;
  users: UserOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sp.name);
  const [pending, startTransition] = useTransition();

  function saveName() {
    if (!name.trim() || name.trim() === sp.name) return;
    startTransition(() => renameSubProcess(processId, sp.id, name));
  }

  if (editing) {
    return (
      <div
        className={`rounded-md border border-(--color-clay-line) bg-(--color-raised) p-3.5 ${
          sp.inScope ? "" : "opacity-60"
        }`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            disabled={pending}
            className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[14px] font-semibold outline-none focus:border-(--color-clay)"
          />
          <button
            onClick={() => setEditing(false)}
            className="shrink-0 text-[11.5px] text-(--color-faint) hover:text-(--color-text)"
          >
            Luk
          </button>
        </div>
        <div className="mb-3">
          <div className="eyebrow mb-1.5">Tildelt til interview</div>
          <AssigneeSelect
            processId={processId}
            subProcessId={sp.id}
            assigneeId={sp.assigneeId}
            users={users}
            className="w-full"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="eyebrow mb-1.5">Starter når</div>
            <TriggerList
              processId={processId}
              subProcessId={sp.id}
              field="startEvent"
              events={sp.startEvents}
              placeholder='Fx "Ordre modtaget pr. mail"'
            />
          </div>
          <div>
            <div className="eyebrow mb-1.5">Slutter når</div>
            <TriggerList
              processId={processId}
              subProcessId={sp.id}
              field="endEvent"
              events={sp.endEvents}
              placeholder='Fx "Ordre leveret til kunde"'
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group relative block border-l-2 border-(--color-line) py-3 pl-4 transition-colors hover:border-(--color-clay) hover:bg-(--color-raised) ${
        sp.inScope ? "" : "opacity-60"
      }`}
    >
      <button
        onClick={() => setEditing(true)}
        title="Rediger"
        className="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] text-(--color-faint) opacity-0 transition-opacity hover:text-(--color-clay) group-hover:opacity-100"
      >
        Rediger
      </button>
      <Link href={`/processes/${processId}/${sp.id}`} className="block">
        <div className="flex items-start justify-between gap-3 pr-12">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold">{sp.name}</div>
            <div className="mt-1 text-[11.5px] text-(--color-faint)">
              {sp.inScope
                ? sp.assigneeName
                  ? `${sp.assigneeName} · ${sp.stepCount} skridt`
                  : "Ingen medarbejder tildelt"
                : `Uden for scope — ${sp.scopeReason ?? "ingen begrundelse"}`}
            </div>
            {(sp.startEvents.length > 0 || sp.endEvents.length > 0) && (
              <div className="mt-1.5 flex flex-wrap gap-1 text-[10.5px] text-(--color-faint)">
                {sp.startEvents.map((e, i) => (
                  <span key={`s${i}`} className="rounded-full border border-(--color-line-soft) px-1.5 py-0.5">
                    → {e}
                  </span>
                ))}
                {sp.endEvents.map((e, i) => (
                  <span key={`e${i}`} className="rounded-full border border-(--color-line-soft) px-1.5 py-0.5">
                    {e} →
                  </span>
                ))}
              </div>
            )}
          </div>
          <Badge tone={sp.inScope ? sp.statusTone : "faint"}>
            {sp.inScope ? sp.statusLabel : "Uden for scope"}
          </Badge>
        </div>
      </Link>
    </div>
  );
}

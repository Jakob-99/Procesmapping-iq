"use client";

import { useState, useTransition } from "react";
import { addTrigger, removeTrigger } from "@/app/processes/[processId]/[subId]/actions";
import { ClayButton } from "./ui";

/*
  "Starter når" og "slutter når" kan have flere hændelser — fx både
  "Ordre modtaget pr. mail" og "Ordre oprettet i webshop" udløser samme
  underproces. Hvert felt er sin egen liste man kan tilføje og fjerne fra.
  Deles mellem TriggersPanel (arbejdsfladen) og SubProcessCard (procesoversigten).
*/
export function TriggerList({
  processId,
  subProcessId,
  field,
  events,
  placeholder,
}: {
  processId: string;
  subProcessId: string;
  field: "startEvent" | "endEvent";
  events: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!text.trim()) return;
    startTransition(async () => {
      await addTrigger(processId, subProcessId, field, text);
      setText("");
      setOpen(false);
    });
  }

  function remove(index: number) {
    startTransition(() => removeTrigger(processId, subProcessId, field, index));
  }

  return (
    <div>
      {events.length > 0 && (
        <ul className="space-y-1.5">
          {events.map((e, i) => (
            <li
              key={i}
              className="group flex items-center justify-between gap-2 rounded-md border border-(--color-line-soft) bg-(--color-raised) px-2.5 py-1.5 text-[12.5px]"
            >
              <span className="min-w-0 flex-1">{e}</span>
              <button
                onClick={() => remove(i)}
                disabled={pending}
                title="Fjern"
                className="shrink-0 text-[11px] text-(--color-faint) opacity-0 transition-opacity hover:text-(--color-alert) group-hover:opacity-100 disabled:opacity-40"
              >
                Fjern
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={events.length > 0 ? "mt-2" : ""}>
        {open ? (
          <div className="space-y-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") setOpen(false);
              }}
              autoFocus
              placeholder={placeholder}
              className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
            />
            <div className="flex gap-2">
              <ClayButton onClick={submit} disabled={pending || !text.trim()} className="!py-1 !text-[11.5px]">
                Tilføj
              </ClayButton>
              <button
                onClick={() => {
                  setOpen(false);
                  setText("");
                }}
                className="text-[11.5px] text-(--color-faint) hover:text-(--color-text)"
              >
                Annullér
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-(--color-line) px-3 py-1 text-[11.5px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
          >
            + Tilføj
          </button>
        )}
      </div>
    </div>
  );
}

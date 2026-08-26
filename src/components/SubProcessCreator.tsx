"use client";

import { useState, useTransition } from "react";
import { createSubProcess } from "@/app/processes/actions";
import { ClayButton } from "./ui";

/*
  Procesejeren opretter underprocessen selv, med titel og hvor den starter og
  slutter — det er rammen agenten interviewer indenfor bagefter. Der kan være
  flere starter/slutter-hændelser (fx både "mail" og "webshop"), så hvert felt
  er sin egen lille tag-liste man tilføjer til med +.
*/

function EventTagInput({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [text, setText] = useState("");

  function add() {
    if (!text.trim()) return;
    onChange([...values, text.trim()]);
    setText("");
  }

  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i));
  }

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-(--color-faint)">
        {label}
      </div>
      {values.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {values.map((v, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full border border-(--color-line) bg-(--color-surface) px-2 py-0.5 text-[11px]"
            >
              {v}
              <button
                onClick={() => remove(i)}
                title="Fjern"
                className="text-(--color-faint) hover:text-(--color-alert)"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
        />
        <button
          onClick={add}
          disabled={!text.trim()}
          title="Tilføj"
          className="shrink-0 rounded-md border border-dashed border-(--color-line) px-2.5 text-[13px] text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay) disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function SubProcessCreator({ processId }: { processId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [starts, setStarts] = useState<string[]>([]);
  const [ends, setEnds] = useState<string[]>([]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-3 flex items-center gap-1.5 rounded-full border border-dashed border-(--color-line) px-3.5 py-1.5 text-[12px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
      >
        + Opret underproces
      </button>
    );
  }

  function submit() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createSubProcess(processId, name, starts.join("\n"), ends.join("\n"));
      setName("");
      setStarts([]);
      setEnds([]);
      setOpen(false);
    });
  }

  return (
    <div className="mb-4 space-y-1.5 rounded-xl border border-(--color-line-soft) bg-(--color-raised) p-3.5">
      <div className="eyebrow mb-1">Ny underproces</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder='Titel, fx "Ordremodtagelse"'
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <div className="flex gap-3">
        <EventTagInput
          label="Starter når"
          placeholder='Fx "Ordre modtaget pr. mail"'
          values={starts}
          onChange={setStarts}
        />
        <EventTagInput
          label="Slutter når"
          placeholder='Fx "Ordre leveret til kunde"'
          values={ends}
          onChange={setEnds}
        />
      </div>
      <div className="flex gap-2 pt-0.5">
        <ClayButton onClick={submit} disabled={pending || !name.trim()} className="!py-1.5 !text-[12.5px]">
          Opret
        </ClayButton>
        <button
          onClick={() => setOpen(false)}
          className="text-[12px] text-(--color-faint) hover:text-(--color-text)"
        >
          Annullér
        </button>
      </div>
    </div>
  );
}

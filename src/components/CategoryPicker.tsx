"use client";

import { useEffect, useRef, useState } from "react";

// Multi-select til forretningsområder: viser eksisterende kategorier på
// tværs af engagementet som forslag, men lader man også bare skrive en ny
// og trykke Enter/klikke "Opret" — ingen fast liste at vedligeholde et
// sted, kategorierne opstår ved brug.
export function CategoryPicker({
  value,
  onChange,
  options,
  placeholder = "Forretningsområde",
}: {
  value: string[];
  onChange: (categories: string[]) => void;
  options: string[];
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const normalizedInput = input.trim().toLowerCase();
  const available = options.filter(
    (o) =>
      !value.some((v) => v.toLowerCase() === o.toLowerCase()) &&
      (!normalizedInput || o.toLowerCase().includes(normalizedInput)),
  );
  const exactMatch = options.some((o) => o.toLowerCase() === normalizedInput);
  const canCreate =
    normalizedInput.length > 0 && !exactMatch && !value.some((v) => v.toLowerCase() === normalizedInput);

  function add(category: string) {
    const trimmed = category.trim();
    if (!trimmed || value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...value, trimmed]);
    setInput("");
  }

  function remove(category: string) {
    onChange(value.filter((v) => v !== category));
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        onClick={() => setOpen(true)}
        className="flex flex-wrap items-center gap-1.5 rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1.5 focus-within:border-(--color-clay)"
      >
        {value.map((c) => (
          <span
            key={c}
            className="flex items-center gap-1 rounded-full border border-(--color-clay-line) bg-(--color-clay-wash) px-2 py-0.5 text-[11.5px] text-(--color-clay)"
          >
            {c}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(c);
              }}
              className="leading-none hover:opacity-60"
              aria-label={`Fjern ${c}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (available[0]) add(available[0]);
              else if (canCreate) add(input);
            } else if (e.key === "Backspace" && !input && value.length) {
              remove(value[value.length - 1]);
            }
          }}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[80px] flex-1 bg-transparent text-[12.5px] outline-none"
        />
      </div>

      {open && (available.length > 0 || canCreate) && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-(--color-line) bg-(--color-surface) shadow-[0_4px_12px_rgba(20,16,12,0.08)]">
          {available.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => add(o)}
              className="block w-full px-3 py-1.5 text-left text-[12.5px] hover:bg-(--color-sunken)"
            >
              {o}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => add(input)}
              className="block w-full px-3 py-1.5 text-left text-[12.5px] text-(--color-clay) hover:bg-(--color-clay-wash)"
            >
              + Opret &ldquo;{input.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

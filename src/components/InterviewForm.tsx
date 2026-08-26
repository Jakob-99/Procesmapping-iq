"use client";

import { useState } from "react";
import type { FormField } from "@/lib/interview";
import { ClayButton } from "./ui";

/*
  Skemaet agenten rækker frem midt i samtalen. Det skal føles som en del af
  dialogen — ikke som at blive sendt videre til en formular.
*/
export function InterviewForm({
  title,
  fields,
  onSubmit,
  disabled,
}: {
  title: string;
  fields: FormField[];
  onSubmit: (summary: string) => void;
  disabled?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  // Felter kan få tilføjet muligheder undervejs — fx et system der ikke stod
  // i den oprindelige liste. Holdes pr. felt, lagt oveni de faste options.
  const [extraOptions, setExtraOptions] = useState<Record<string, string[]>>({});
  const [newOptionDraft, setNewOptionDraft] = useState<Record<string, string>>({});

  const set = (id: string, v: string | string[]) =>
    setValues((prev) => ({ ...prev, [id]: v }));

  const toggle = (id: string, opt: string) => {
    const cur = (values[id] as string[]) ?? [];
    set(id, cur.includes(opt) ? cur.filter((o) => o !== opt) : [...cur, opt]);
  };

  function addOption(id: string, type: "choice" | "multi") {
    const draft = (newOptionDraft[id] ?? "").trim();
    if (!draft) return;
    setExtraOptions((prev) => ({
      ...prev,
      [id]: [...(prev[id] ?? []), draft],
    }));
    if (type === "choice") set(id, draft);
    else toggle(id, draft);
    setNewOptionDraft((prev) => ({ ...prev, [id]: "" }));
  }

  function submit() {
    // Svaret sendes tilbage som almindelig tekst — agenten læser det som tale.
    const summary = fields
      .map((f) => {
        const v = values[f.id];
        const text = Array.isArray(v) ? v.join(", ") : (v ?? "");
        return `${f.label}: ${text || "(ikke besvaret)"}`;
      })
      .join("\n");
    onSubmit(summary);
  }

  const base =
    "w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-(--color-faint) focus:border-(--color-clay-line)";

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
      active
        ? "border-(--color-clay) bg-(--color-clay-wash) text-(--color-clay)"
        : "border-(--color-line) bg-(--color-surface) text-(--color-muted) hover:border-(--color-clay-line)"
    }`;

  return (
    <div className="mt-3 rounded-xl border border-(--color-clay-line) bg-(--color-clay-wash) p-4">
      <div className="eyebrow mb-3.5 text-(--color-clay)">{title}</div>

      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f.id}>
            <label className="mb-1.5 block text-[12.5px] text-(--color-text)">
              {f.label}
            </label>

            {f.type === "longtext" && (
              <textarea
                rows={3}
                placeholder={f.placeholder}
                value={(values[f.id] as string) ?? ""}
                onChange={(e) => set(f.id, e.target.value)}
                className={base}
              />
            )}

            {(f.type === "text" || f.type === "number") && (
              <input
                type={f.type === "number" ? "number" : "text"}
                placeholder={f.placeholder}
                value={(values[f.id] as string) ?? ""}
                onChange={(e) => set(f.id, e.target.value)}
                className={base}
              />
            )}

            {f.type === "choice" && (
              <div className="flex flex-wrap items-center gap-1.5">
                {[...f.options, ...(extraOptions[f.id] ?? [])].map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => set(f.id, o)}
                    className={chip(values[f.id] === o)}
                  >
                    {o}
                  </button>
                ))}
                <NewOptionInput
                  value={newOptionDraft[f.id] ?? ""}
                  onChange={(v) => setNewOptionDraft((prev) => ({ ...prev, [f.id]: v }))}
                  onAdd={() => addOption(f.id, "choice")}
                />
              </div>
            )}

            {f.type === "multi" && (
              <div className="flex flex-wrap items-center gap-1.5">
                {[...f.options, ...(extraOptions[f.id] ?? [])].map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => toggle(f.id, o)}
                    className={chip(
                      ((values[f.id] as string[]) ?? []).includes(o),
                    )}
                  >
                    {o}
                  </button>
                ))}
                <NewOptionInput
                  value={newOptionDraft[f.id] ?? ""}
                  onChange={(v) => setNewOptionDraft((prev) => ({ ...prev, [f.id]: v }))}
                  onAdd={() => addOption(f.id, "multi")}
                />
              </div>
            )}

            {f.type === "scale" && (
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set(f.id, String(n))}
                    className={`tabular h-9 w-9 rounded-lg border text-[13px] transition-colors ${
                      values[f.id] === String(n)
                        ? "border-(--color-clay) bg-(--color-clay-wash) text-(--color-clay)"
                        : "border-(--color-line) bg-(--color-surface) text-(--color-muted) hover:border-(--color-clay-line)"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <ClayButton
        onClick={submit}
        disabled={disabled}
        className="mt-4 bg-(--color-surface)"
      >
        Send svar
      </ClayButton>
    </div>
  );
}

/* Lille inline-felt til at tilføje en mulighed der ikke stod i listen — fx et
   system der ikke er kortlagt endnu. */
function NewOptionInput({
  value,
  onChange,
  onAdd,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onAdd();
          }
        }}
        placeholder="+ Tilføj ny…"
        className="w-28 rounded-full border border-dashed border-(--color-line) bg-transparent px-2.5 py-1 text-[12px] outline-none focus:border-(--color-clay-line)"
      />
      {value.trim() && (
        <button
          type="button"
          onClick={onAdd}
          className="rounded-full border border-(--color-clay-line) bg-(--color-clay-wash) px-2 py-1 text-[12px] text-(--color-clay)"
        >
          Tilføj
        </button>
      )}
    </span>
  );
}

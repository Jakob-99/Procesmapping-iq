"use client";

import { INTEGRATION_LABELS, INTEGRATION_TYPES, type IntegrationType } from "@/lib/domain";

/*
  Integrationsmulighederne som knapper man slår til og fra — et system kan
  have flere (fx både API og Manuelt).
*/
export function IntegrationPicker({
  value,
  onChange,
  disabled,
}: {
  value: IntegrationType[];
  onChange: (next: IntegrationType[]) => void;
  disabled?: boolean;
}) {
  function toggle(t: IntegrationType) {
    onChange(value.includes(t) ? value.filter((v) => v !== t) : [...value, t]);
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {INTEGRATION_TYPES.map((t) => {
        const on = value.includes(t);
        return (
          <button
            key={t}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() => toggle(t)}
            className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-50 ${
              on
                ? "border-(--color-clay) bg-(--color-clay-wash) text-(--color-clay)"
                : "border-(--color-line) bg-(--color-surface) text-(--color-muted) hover:border-(--color-clay-line) hover:text-(--color-text)"
            }`}
          >
            {on ? "✓ " : ""}
            {INTEGRATION_LABELS[t]}
          </button>
        );
      })}
    </div>
  );
}

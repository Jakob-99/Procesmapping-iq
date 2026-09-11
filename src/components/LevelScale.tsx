"use client";

export function LevelScale({
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div>
      <div className="eyebrow mb-1.5">{label}</div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`tabular h-8 w-8 rounded-lg border text-[13px] transition-colors ${
              value === n
                ? "border-(--color-clay) bg-(--color-clay-wash) text-(--color-clay)"
                : "border-(--color-line) bg-(--color-surface) text-(--color-muted) hover:border-(--color-clay-line)"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] text-(--color-faint)">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

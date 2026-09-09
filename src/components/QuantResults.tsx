import { Empty } from "./ui";

/*
  Ingen chart-bibliotek i appen — enkle vandrette bar-lister i clay-farve,
  samme mono-tal-æstetik som Stat i ui.tsx.
*/
export function QuantResults({
  question,
  counts,
}: {
  question: { id: string; prompt: string; type: string; options: string | null };
  counts: { value: string; count: number }[];
}) {
  const total = counts.reduce((s, c) => s + c.count, 0);

  if (total === 0) {
    return (
      <div>
        <div className="mb-2 text-[13px] font-medium">{question.prompt}</div>
        <Empty>Ingen svar endnu.</Empty>
      </div>
    );
  }

  const rows =
    question.type === "SCALE"
      ? ["1", "2", "3", "4", "5"].map((v) => ({
          value: v,
          count: counts.find((c) => c.value === v)?.count ?? 0,
        }))
      : [...counts].sort((a, b) => b.count - a.count);

  const avg =
    question.type === "SCALE"
      ? (
          counts.reduce((s, c) => s + Number(c.value) * c.count, 0) / total
        ).toFixed(1)
      : null;

  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium">{question.prompt}</span>
        <span className="tabular text-[11.5px] text-(--color-faint)">
          {total} svar{avg ? ` · gennemsnit ${avg}` : ""}
        </span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.value} className="flex items-center gap-2.5">
            <span className="w-20 shrink-0 truncate text-[12px] text-(--color-muted)">
              {r.value}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-(--color-raised)">
              <div
                className="h-full rounded bg-(--color-clay-line)"
                style={{ width: `${Math.round((r.count / max) * 100)}%` }}
              />
            </div>
            <span className="tabular w-6 shrink-0 text-right text-[12px] text-(--color-faint)">
              {r.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

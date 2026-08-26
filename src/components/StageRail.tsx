import { STAGES, stageIndex } from "@/lib/domain";

/*
  Forløbet som én vandret linje. Man skal kunne se hvor man er uden at læse —
  derfor bærer den aktive fase både farve, vægt og en fuld baggrund, mens de
  overståede kun beholder et flueben.
*/
export function StageRail({ stage }: { stage: string }) {
  const current = stageIndex(stage);

  return (
    <div className="flex items-stretch overflow-x-auto">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;

        return (
          <div
            key={s.key}
            className={`min-w-[140px] flex-1 border-r border-(--color-line) px-4 py-3.5 last:border-r-0 ${
              active ? "bg-(--color-clay-wash)" : done ? "bg-(--color-raised)" : ""
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                  active
                    ? "bg-(--color-clay) text-white"
                    : done
                      ? "bg-(--color-ok) text-white"
                      : "border border-(--color-line) bg-(--color-surface) text-(--color-faint)"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={`text-[12.5px] font-semibold ${
                  active
                    ? "text-(--color-clay)"
                    : done
                      ? "text-(--color-muted)"
                      : "text-(--color-faint)"
                }`}
              >
                {s.label}
              </span>
            </div>
            <div className="text-[11px] leading-snug text-(--color-faint)">
              {s.blurb}
            </div>
          </div>
        );
      })}
    </div>
  );
}

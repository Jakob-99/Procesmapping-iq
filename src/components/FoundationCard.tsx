import Link from "next/link";

// Små pixel-ikoner i logoets stil: skærm, person og dokument.
export type IconKind = "system" | "role" | "data" | "process";

const ICONS: Record<IconKind, string[]> = {
  // To aktiviteter der løber sammen i en tredje — et lille procesforløb.
  process: ["###..###", "#o#..#o#", "###..###", ".#....#.", ".######.", "...###..", "...#o#..", "...###.."],
  system: ["########", "#......#", "#.oo...#", "#......#", "#.oooo.#", "########", "...##...", ".######."],
  role: ["...##...", "..####..", "..####..", "...##...", ".######.", "########", "########", "##.##.##"],
  data: ["#####...", "#...##..", "#....##.", "#.ooo..#", "#......#", "#.oooo.#", "#......#", "########"],
};

export function PixelIcon({ kind, px = 3 }: { kind: IconKind; px?: number }) {
  return (
    <svg width={8 * px} height={8 * px} aria-hidden>
      {ICONS[kind].flatMap((row, y) =>
        [...row].map((ch, x) =>
          ch === "." ? null : (
            <rect
              key={`${x}-${y}`}
              x={x * px}
              y={y * px}
              width={px}
              height={px}
              fill={ch === "o" ? "#f0894a" : "#e35f1e"}
            />
          ),
        ),
      )}
    </svg>
  );
}

// Et kort for systemer, roller eller data: antal, og de mest brugte med en
// lille bjælke for hvor mange skridt de indgår i.
export function FoundationCard({
  title,
  href,
  icon,
  count,
  empty,
  items,
}: {
  title: string;
  href: string;
  icon: IconKind;
  count: number;
  empty: string;
  items: { id: string; name: string; meta: string | null; uses: number }[];
}) {
  const shown = items.slice(0, 4);
  const max = Math.max(1, ...shown.map((i) => i.uses));
  return (
    <Link
      href={href}
      className="group flex h-full min-w-0 flex-col rounded-lg border border-(--color-line-soft) bg-(--color-surface) px-5 py-4 shadow-[0_1px_2px_rgba(20,16,12,0.03)] transition-colors hover:border-(--color-clay-line)"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-(--color-clay-wash)">
          <PixelIcon kind={icon} />
        </div>
        <div className="flex-1 text-[14px] font-semibold">{title}</div>
        <div className="tabular font-mono text-[26px] leading-none tracking-tight">{count}</div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 flex-1 text-[12px] text-(--color-faint)">{empty}</p>
      ) : (
        <ul className="mt-4 flex-1 space-y-2.5">
          {shown.map((i) => (
            <li key={i.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[12.5px]">
                  {i.name}
                  {i.meta && <span className="ml-1.5 text-[11px] text-(--color-faint)">{i.meta}</span>}
                </span>
                <span className="tabular shrink-0 text-[11px] text-(--color-faint)">
                  {i.uses > 0 ? `${i.uses} skridt` : "ikke i brug"}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-(--color-sunken)">
                <div
                  className="h-full rounded-full bg-(--color-clay) opacity-70"
                  style={{ width: `${(i.uses / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between text-[11.5px] text-(--color-faint)">
        <span>{items.length > shown.length ? `+ ${items.length - shown.length} flere` : ""}</span>
        <span className="transition-colors group-hover:text-(--color-clay)">Se alle →</span>
      </div>
    </Link>
  );
}

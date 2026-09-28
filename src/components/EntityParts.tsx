import Link from "next/link";
import type { ReactNode } from "react";

/*
  Fælles byggeklodser til siderne Systemer, Roller og Data: en stribe med
  nøgletal øverst, et kort-skal og en liste over de underprocesser en ting
  indgår i.
*/

export function StatStrip({ stats }: { stats: { label: string; value: number | string; hint?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-(--color-line-soft) bg-(--color-surface) px-4 py-3 shadow-[0_1px_2px_rgba(20,16,12,0.03)]"
        >
          <div className="eyebrow mb-1.5">{s.label}</div>
          <div className="tabular font-mono text-[24px] leading-none tracking-tight">{s.value}</div>
          {s.hint && <div className="mt-1.5 text-[11px] text-(--color-faint)">{s.hint}</div>}
        </div>
      ))}
    </div>
  );
}

export function CardShell({ children, pending }: { children: ReactNode; pending?: boolean }) {
  return (
    <div
      className={`group flex h-full min-w-0 flex-col rounded-lg border border-(--color-line-soft) bg-(--color-surface) px-5 py-4 shadow-[0_1px_2px_rgba(20,16,12,0.03)] transition-colors hover:border-(--color-clay-line) ${
        pending ? "opacity-40" : ""
      }`}
    >
      {children}
    </div>
  );
}

export function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "clay" | "ok" }) {
  const cls =
    tone === "clay"
      ? "border-(--color-clay-line) bg-(--color-clay-wash) text-(--color-clay)"
      : tone === "ok"
        ? "border-(--color-ok)/30 bg-(--color-ok)/10 text-(--color-ok)"
        : "border-(--color-line) bg-(--color-sunken) text-(--color-muted)";
  return <span className={`rounded border px-1.5 py-0.5 text-[10.5px] font-medium leading-none ${cls}`}>{children}</span>;
}

export type Usage = { id: string; href: string; name: string; area: string; count: number };

// Gruppér skridt-koblinger pr. underproces, mest brugte først.
export function usageBySubProcess(
  steps: { subProcess: { id: string; name: string; process: { id: string; name: string } } }[],
): Usage[] {
  const map = new Map<string, Usage>();
  for (const { subProcess: sp } of steps) {
    const u = map.get(sp.id);
    if (u) u.count++;
    else map.set(sp.id, { id: sp.id, href: `/processes/${sp.process.id}/${sp.id}`, name: sp.name, area: sp.process.name, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "da"));
}

// "Bruges i": underprocesserne som små links, højst `max` og så "+ N".
export function UsageList({ usage, label = "Bruges i", max = 4 }: { usage: Usage[]; label?: string; max?: number }) {
  if (usage.length === 0) {
    return <div className="mt-3 text-[11.5px] italic text-(--color-faint)">Ikke brugt i nogen proces endnu</div>;
  }
  const shown = usage.slice(0, max);
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-(--color-faint)">{label}</div>
      <ul className="space-y-1">
        {shown.map((u) => (
          <li key={u.id}>
            <Link
              href={u.href}
              className="flex items-baseline justify-between gap-2 rounded px-1.5 py-0.5 -mx-1.5 text-[12px] transition-colors hover:bg-(--color-raised) hover:text-(--color-clay)"
            >
              <span className="min-w-0 truncate">
                {u.name}
                <span className="ml-1.5 text-[10.5px] text-(--color-faint)">{u.area}</span>
              </span>
              <span className="tabular shrink-0 text-[10.5px] text-(--color-faint)">
                {u.count} skridt
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {usage.length > max && (
        <div className="mt-1 text-[11px] text-(--color-faint)">+ {usage.length - max} underprocesser mere</div>
      )}
    </div>
  );
}

// Stort begyndelsesbogstav i en farvet firkant — til roller.
export function Monogram({ name }: { name: string }) {
  const letters = name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-(--color-clay-wash) font-mono text-[13px] font-semibold text-(--color-clay)">
      {letters || "?"}
    </div>
  );
}

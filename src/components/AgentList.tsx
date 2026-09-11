"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Empty, Panel } from "./ui";

type Agent = {
  id: string;
  name: string;
  purpose: string;
  createdAt: Date;
  interviewCount: number;
};

type SortKey = "name" | "newest" | "most-sent";
type FilterKey = "all" | "sent" | "unsent";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Navn (A-Å)" },
  { key: "newest", label: "Nyeste først" },
  { key: "most-sent", label: "Flest interviews sendt" },
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "sent", label: "Sendt" },
  { key: "unsent", label: "Ikke sendt endnu" },
];

export function AgentList({ agents }: { agents: Agent[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [filter, setFilter] = useState<FilterKey>("all");

  const q = query.trim().toLowerCase();

  const visible = useMemo(() => {
    let list = agents;
    if (filter === "sent") list = list.filter((a) => a.interviewCount > 0);
    if (filter === "unsent") list = list.filter((a) => a.interviewCount === 0);
    if (q) list = list.filter((a) => [a.name, a.purpose].some((v) => v.toLowerCase().includes(q)));

    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "da"));
    if (sort === "newest") sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (sort === "most-sent") sorted.sort((a, b) => b.interviewCount - a.interviewCount);
    return sorted;
  }, [agents, filter, q, sort]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Søg på navn eller formål…"
          className="min-w-[220px] flex-1 rounded-md border border-(--color-line) bg-(--color-surface) px-3 py-2 text-[13px] outline-none focus:border-(--color-clay)"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-2 text-[12.5px] outline-none focus:border-(--color-clay)"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-5 flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
              filter === f.key
                ? "border-(--color-clay-line) bg-(--color-clay-wash) text-(--color-clay)"
                : "border-(--color-line) text-(--color-muted) hover:border-(--color-clay-line) hover:text-(--color-clay)"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Empty>
          {q || filter !== "all" ? "Ingen agenter matcher." : "Ingen interview agenter endnu."}
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((a) => (
            <Link key={a.id} href={`/agents/${a.id}`}>
              <Panel className="lift h-full transition-colors hover:border-(--color-clay-line)">
                <div className="text-[15px] font-medium">{a.name}</div>
                <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-(--color-muted)">
                  {a.purpose}
                </p>
                <div className="mt-3 text-[11px] text-(--color-faint)">
                  {a.interviewCount} interview{a.interviewCount === 1 ? "" : "s"} sendt
                </div>
              </Panel>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

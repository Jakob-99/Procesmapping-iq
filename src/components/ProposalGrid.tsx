"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { proposalGradient } from "@/lib/domain";
import { togglePin } from "@/app/(customer)/improvements/actions";

type Proposal = {
  id: string;
  name: string;
  layer: string;
  potential: number | null;
  processNumbers: number[];
  pinned: boolean;
};

const SORTS = {
  potential: { label: "Potentiale", fn: (a: Proposal, b: Proposal) => (b.potential ?? -1) - (a.potential ?? -1) },
  name: { label: "Navn", fn: (a: Proposal, b: Proposal) => a.name.localeCompare(b.name) },
} as const;

/*
  Kortet er billedet — hvert forslag får sin egen farve, ligesom et
  pladeomslag, så de er nemme at kende fra hinanden i overblikket.
*/
function ProposalImage({ id, name }: { id: string; name: string }) {
  return (
    <div
      className="flex aspect-[16/10] w-full items-center justify-center rounded-t-2xl text-[40px] font-light text-white/90"
      style={{ background: proposalGradient(id) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l1.8 5.6L19 9l-4 3.6L16 18l-4-2.8L8 18l1-5.4-4-3.6 5.2-1.4z" />
    </svg>
  );
}

function PinButton({ id, pinned }: { id: string; pinned: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      title={pinned ? "Fjern pin" : "Pin forslaget"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(() => togglePin(id));
      }}
      disabled={pending}
      className={`absolute right-2.5 top-2.5 rounded-full border p-1.5 backdrop-blur-sm transition-colors ${
        pinned
          ? "border-white/40 bg-white/25 text-white"
          : "border-white/30 bg-black/10 text-white/70 hover:bg-white/20 hover:text-white"
      }`}
    >
      <PinIcon filled={pinned} />
    </button>
  );
}

export function ProposalGrid({ proposals }: { proposals: Proposal[] }) {
  const [sort, setSort] = useState<keyof typeof SORTS>("potential");

  const sorted = useMemo(() => {
    const list = [...proposals].sort(SORTS[sort].fn);
    // Pinnede ligger altid øverst, uanset sortering.
    return [...list.filter((p) => p.pinned), ...list.filter((p) => !p.pinned)];
  }, [proposals, sort]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-end gap-2">
        <span className="text-[11.5px] text-(--color-faint)">Sortér efter</span>
        {Object.entries(SORTS).map(([key, s]) => (
          <button
            key={key}
            onClick={() => setSort(key as keyof typeof SORTS)}
            className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
              sort === key
                ? "border-(--color-clay) bg-(--color-clay-wash) text-(--color-clay)"
                : "border-(--color-line) text-(--color-muted) hover:border-(--color-clay-line)"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((p) => (
          <Link
            key={p.id}
            href={`/improvements/${p.id}`}
            className="group overflow-hidden rounded-2xl border border-(--color-line) bg-(--color-surface) transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(20,16,12,0.25)]"
          >
            <div className="relative">
              <ProposalImage id={p.id} name={p.name} />
              <PinButton id={p.id} pinned={p.pinned} />
            </div>
            <div className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13.5px] font-medium leading-tight">{p.name}</span>
                <span className="tabular shrink-0 font-mono text-[11px] font-medium text-(--color-clay)">
                  {p.potential ?? "—"}
                </span>
              </div>
              <div className="mt-1.5 text-[11px] text-(--color-faint)">
                {p.layer === "ORCHESTRATION" ? "Orkestrering" : "Procesniveau"}
                {p.processNumbers.length > 0 && ` · berører ${p.processNumbers.length} proces${p.processNumbers.length === 1 ? "" : "ser"}`}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

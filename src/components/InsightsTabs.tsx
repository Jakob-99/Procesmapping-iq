"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function InsightsTabs({ agentId, agentName }: { agentId: string; agentName: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/insights/${agentId}`, label: "Temaer" },
    { href: `/insights/${agentId}/quotes`, label: "Citater" },
    { href: `/insights/${agentId}/ask`, label: "Spørg på tværs" },
  ];

  return (
    <div className="mb-6">
      <Link
        href="/insights"
        className="mb-2 inline-block text-[12px] text-(--color-faint) hover:text-(--color-clay)"
      >
        ← Alle agenter
      </Link>
      <div className="eyebrow mb-3 text-(--color-clay)">{agentName}</div>
      <div className="flex gap-1 border-b border-(--color-line)">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
                active
                  ? "border-(--color-clay) text-(--color-clay)"
                  : "border-transparent text-(--color-muted) hover:text-(--color-text)"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

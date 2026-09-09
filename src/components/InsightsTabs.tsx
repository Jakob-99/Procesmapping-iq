"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/insights", label: "Temaer" },
  { href: "/insights/quotes", label: "Citater" },
  { href: "/insights/ask", label: "Spørg på tværs" },
];

export function InsightsTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 border-b border-(--color-line)">
      {TABS.map((t) => {
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
  );
}

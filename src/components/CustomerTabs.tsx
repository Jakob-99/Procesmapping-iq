"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CustomerTabs({ engagementId }: { engagementId: string }) {
  const pathname = usePathname();
  const base = `/admin/customers/${engagementId}`;
  const tabs = [
    { href: base, label: "Oversigt" },
    { href: `${base}/access`, label: "Adgang" },
  ];

  return (
    <div className="mb-4 flex gap-1 border-b border-(--color-line) px-8">
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
  );
}

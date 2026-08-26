"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { useBreadcrumb } from "./BreadcrumbContext";

/*
  Topbaren følger Supabase-mønstret: et overordnet mærke, så en brødkrumme ned
  til der hvor man står. På statiske sider er det bare sektionsnavnet; på
  sider med rigtige navne bag id'er (proces, underproces …) melder siden selv
  den fulde sti ind via <SetBreadcrumb>, fx Processer / Order to Cash /
  Ordremodtagelse.
*/
const SECTIONS: Record<string, string> = {
  scoping: "Strategi",
  processes: "Processer",
  landscape: "Systemer",
  data: "Data",
  roles: "Roller",
  improvements: "Forbedringer",
  hitl: "Konsulent",
  interviews: "Interview",
};

function Chevron() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Topbar() {
  const path = usePathname();
  const custom = useBreadcrumb();
  const first = path.split("/").filter(Boolean)[0];
  const section = first ? SECTIONS[first] : undefined;

  const crumbs = custom ?? (section ? [{ label: section }] : []);

  return (
    <header className="flex h-11 shrink-0 items-center gap-1.5 border-b border-(--color-line) bg-(--color-raised) px-3 text-[13px]">
      <Link
        href="/"
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 font-medium text-(--color-text) hover:bg-(--color-sunken)"
      >
        <Logo size={16} />
        <span>Corner IQ</span>
      </Link>

      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5 min-w-0">
            <span className="text-(--color-faint)">
              <Chevron />
            </span>
            {c.href && !isLast ? (
              <Link
                href={c.href}
                className="truncate rounded-md px-1.5 py-1 text-(--color-muted) hover:bg-(--color-sunken) hover:text-(--color-text)"
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={`truncate rounded-md px-1.5 py-1 ${isLast ? "font-medium text-(--color-text)" : "text-(--color-muted)"}`}
              >
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </header>
  );
}

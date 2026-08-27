"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  improvements: "Optimering",
  transformation: "Transformation",
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

type OrgUser = { id: string; name: string; email: string; role: string };

/*
  Profilcirklen er PERSONLIG (den enkelte respondent), adskilt fra det
  organisations-brede Kontrolpanel som stadig ligger nederst i Nav'en — de to
  styrer forskellige ting og skal ikke pege på det samme sted. Der er endnu
  intet login/session-begreb i appen, så "mig" er indtil videre den første
  bruger i listen; dropdown'en viser blot profilen, ingen redigerbare
  personlige indstillinger findes endnu.
*/
function ProfileMenu({ users }: { users: OrgUser[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const me = users[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!me) return null;

  const initial = me.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Profil"
        className="flex h-6 w-6 items-center justify-center rounded-full bg-(--color-clay) text-[11px] font-medium text-white transition-opacity hover:opacity-85"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-52 overflow-hidden rounded-md border border-(--color-line) bg-(--color-surface) py-2.5 px-3 shadow-[0_4px_16px_-4px_rgba(20,16,12,0.18)]">
          <div className="truncate text-[13px] font-medium text-(--color-text)">{me.name}</div>
          <div className="truncate text-[11.5px] text-(--color-muted)">{me.email}</div>
          <div className="mt-2 border-t border-(--color-line) pt-2 text-[11px] text-(--color-faint)">
            Personlige indstillinger kommer senere.
          </div>
        </div>
      )}
    </div>
  );
}

export function Topbar({ users }: { users: OrgUser[] }) {
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

      <div className="ml-auto flex items-center">
        <ProfileMenu users={users} />
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { OrgSettingsModal } from "./OrgSettingsModal";

/*
  Interview-platformens nav er lille med vilje: tre arbejdssektioner plus
  oversigten. Ikon-rail-mønstret (56px lukket, folder ud til 212px ved hover)
  er bevaret fra den tidligere, større nav — bare uden de udfoldelige
  undermenuer, der ikke længere er brug for.
*/

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  oversigt: (
    <Icon>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.3" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.3" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.3" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.3" />
    </Icon>
  ),
  respondenter: (
    <Icon>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 6.2a3 3 0 0 1 0 5.6" />
      <path d="M17.5 19a5.2 5.2 0 0 0-3-4.7" />
    </Icon>
  ),
  agenter: (
    <Icon>
      <path d="M9.5 4a2.5 2.5 0 0 0-2.5 2.5v.2A2.7 2.7 0 0 0 5 9.3v1.4a2.7 2.7 0 0 0 1 2.1v1.7A2.5 2.5 0 0 0 8.5 17H9v3" />
      <path d="M14.5 4A2.5 2.5 0 0 1 17 6.5v.2a2.7 2.7 0 0 1 2 2.6v1.4a2.7 2.7 0 0 1-1 2.1v1.7a2.5 2.5 0 0 1-2.5 2.5H15v3" />
      <path d="M9.5 4a2.5 2.5 0 0 1 5 0v13a2.5 2.5 0 0 1-5 0Z" />
    </Icon>
  ),
  interviews: (
    <Icon>
      <path d="M4 5.5h16v11H9.5L5 20v-3.5H4z" />
    </Icon>
  ),
  indsigter: (
    <Icon>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3 20 20" />
    </Icon>
  ),
  kontakt: (
    <Icon>
      <path d="M4 18v-6a8 8 0 0 1 16 0v6" />
      <rect x="3" y="14" width="4" height="5.5" rx="1.2" />
      <rect x="17" y="14" width="4" height="5.5" rx="1.2" />
    </Icon>
  ),
  kontrolpanel: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4l2.5 2.5" />
    </Icon>
  ),
};

const ITEMS = [
  { href: "/", key: "oversigt", label: "Oversigt" },
  { href: "/respondents", key: "respondenter", label: "Respondenter" },
  { href: "/agents", key: "agenter", label: "Interview agenter" },
  { href: "/interviews", key: "interviews", label: "Interviews" },
  { href: "/insights", key: "indsigter", label: "Indsigter" },
];

type OrgUser = { id: string; name: string; email: string; role: string };

export function Nav({
  organization,
  users,
}: {
  organization: { id: string; name: string } | null;
  users: OrgUser[];
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="relative w-14 shrink-0">
      <aside
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`absolute inset-y-0 left-0 z-20 flex flex-col overflow-hidden border-r border-(--color-line) bg-(--color-raised) transition-[width] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] ${
          open ? "w-[212px] shadow-[4px_0_16px_-4px_rgba(20,16,12,0.12)]" : "w-14"
        }`}
      >
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4">
          <div className="space-y-px">
            {ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex h-[29px] items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 text-[12.5px] transition-colors ${
                    active
                      ? "bg-(--color-clay) font-medium text-white"
                      : "text-(--color-muted) hover:bg-(--color-sunken) hover:text-(--color-text)"
                  }`}
                >
                  {ICONS[item.key]}
                  {open && <span className="min-w-0 flex-1 leading-none">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-(--color-line) px-2.5 py-3">
          {organization && (
            <button
              type="button"
              title="Kontrolpanel"
              onClick={() => setPanelOpen(true)}
              className="mb-1 flex h-9 w-full items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 text-[12.5px] text-(--color-muted) transition-colors hover:bg-(--color-sunken) hover:text-(--color-text)"
            >
              {ICONS.kontrolpanel}
              {open && <span className="min-w-0 flex-1 text-left">Kontrolpanel</span>}
            </button>
          )}
          <Link
            href="/hitl"
            title="Kontakt en konsulent"
            className="flex h-11 items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 text-[12.5px] text-(--color-muted) transition-colors hover:bg-(--color-sunken) hover:text-(--color-text)"
          >
            {ICONS.kontakt}
            {open && (
              <span className="min-w-0 flex-1">
                Kontakt en konsulent
                <span className="mt-0.5 block text-[10.5px] text-(--color-faint)">
                  Menneske, ikke agent
                </span>
              </span>
            )}
          </Link>
        </div>

        {organization && (
          <OrgSettingsModal
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            organization={organization}
            users={users}
          />
        )}
      </aside>
    </div>
  );
}

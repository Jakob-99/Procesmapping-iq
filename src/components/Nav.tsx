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
  processer: (
    <Icon>
      <rect x="3.5" y="4" width="6" height="5" rx="1.2" />
      <rect x="14.5" y="4" width="6" height="5" rx="1.2" />
      <rect x="9" y="15" width="6" height="5" rx="1.2" />
      <path d="M6.5 9v2.5h11V9M12 11.5V15" />
    </Icon>
  ),
  systemer: (
    <Icon>
      <rect x="3.5" y="4.5" width="17" height="11" rx="1.5" />
      <path d="M3.5 8h17M9 19.5h6M12 15.5v4" />
    </Icon>
  ),
  roller: (
    <Icon>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 19.5a7 7 0 0 1 14 0" />
    </Icon>
  ),
  data: (
    <Icon>
      <path d="M6 3.5h8.5l3.5 3.5v13H6z" />
      <path d="M14.5 3.5V7H18M9 12h6M9 15.5h6" />
    </Icon>
  ),
  kontrolpanel: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4l2.5 2.5" />
    </Icon>
  ),
};

// Oversigten for sig, derefter procesmappingen: processerne og de aktører
// og objekter skridtene kobles til. Gruppen vises som en tynd skillelinje,
// og som en lille overskrift når railen er foldet ud.
const GROUPS: { label: string | null; items: { href: string; key: string; label: string }[] }[] = [
  {
    label: null,
    items: [{ href: "/", key: "oversigt", label: "Oversigt" }],
  },
  {
    label: "Procesmodel",
    items: [
      { href: "/processes", key: "processer", label: "Processer" },
      { href: "/landscape", key: "systemer", label: "Systemer" },
      { href: "/roles", key: "roller", label: "Roller" },
      { href: "/data", key: "data", label: "Data" },
    ],
  },
];

type OrgUser = { id: string; name: string; email: string; role: string };
type ApiKeyRow = { id: string; name: string; createdAt: string; lastUsedAt: string | null };

export function Nav({
  organization,
  users,
  apiKeys,
}: {
  organization: { id: string; name: string } | null;
  users: OrgUser[];
  apiKeys: ApiKeyRow[];
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
          {GROUPS.map((group, gi) => (
            <div
              key={group.label ?? "root"}
              className={gi > 0 ? "mt-3 border-t border-(--color-line) pt-3" : ""}
            >
              {group.label && (
                <div className="mb-1.5 flex h-4 items-center px-2.5">
                  {open && <span className="eyebrow whitespace-nowrap">{group.label}</span>}
                </div>
              )}
              <div className="space-y-px">
                {group.items.map((item) => {
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
            </div>
          ))}
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
        </div>

        {organization && (
          <OrgSettingsModal
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            organization={organization}
            users={users}
            apiKeys={apiKeys}
          />
        )}
      </aside>
    </div>
  );
}

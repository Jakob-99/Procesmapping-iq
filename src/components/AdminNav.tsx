"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

/*
  Samme icon-rail-mønster som kundefladens Nav.tsx (56px, udfolder til 212px
  ved hover) — men uden undermenuer/proposals-pinning, som admin ikke har
  brug for. Holdt som sin egen, lettere komponent i stedet for at genbruge
  Nav.tsx direkte, fordi admin og kundeflade aldrig deler indhold (kun stil).
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

const ITEMS = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: (
      <Icon>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.3" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.3" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.3" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.3" />
      </Icon>
    ),
  },
  {
    href: "/admin/customers",
    label: "Kunder",
    icon: (
      <Icon>
        <path d="M4 20V6a1.3 1.3 0 0 1 1.3-1.3h6.4A1.3 1.3 0 0 1 13 6v14" />
        <path d="M13 11h5.7A1.3 1.3 0 0 1 20 12.3V20" />
        <path d="M7.5 8.5h.01M7.5 12h.01M7.5 15.5h.01" />
      </Icon>
    ),
  },
  {
    href: "/admin/consultants",
    label: "Konsulenter",
    icon: (
      <Icon>
        <circle cx="8" cy="8" r="2.6" />
        <circle cx="16" cy="8" r="2.6" />
        <path d="M3.3 19a4.9 4.9 0 0 1 9.4 0" />
        <path d="M11.3 19a4.9 4.9 0 0 1 9.4 0" />
      </Icon>
    ),
  },
  {
    href: "/admin/audit",
    label: "Log",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 8v4l2.5 2.5" />
      </Icon>
    ),
  },
];

export function AdminNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

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
          <div className="mb-1.5 flex h-[14px] items-center px-2.5">
            {open ? (
              <span className="eyebrow whitespace-nowrap">Konsulent</span>
            ) : (
              <span className="h-px w-full bg-(--color-line)" />
            )}
          </div>
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
                  {item.icon}
                  {open && <span className="min-w-0 flex-1 leading-none">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </nav>
      </aside>
    </div>
  );
}

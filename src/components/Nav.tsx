"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { OrgSettingsModal } from "./OrgSettingsModal";
import { LogoMark } from "./Logo";
import { proposalColor } from "@/lib/domain";
import { togglePin } from "@/app/improvements/actions";

/*
  Navigationen følger forløbet: først det man spørger, så det man bygger
  forståelsen af, så det man laver ud af den. Grupperne er der for at man kan
  se hvor langt man er nået, ikke bare hvor man kan klikke hen. Lukket er den
  en smal ikon-liste — man skal ikke bruge plads på den når man ikke navigerer.
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
  hjernen: (
    <Icon>
      <path d="M9.5 4a2.5 2.5 0 0 0-2.5 2.5v.2A2.7 2.7 0 0 0 5 9.3v1.4a2.7 2.7 0 0 0 1 2.1v1.7A2.5 2.5 0 0 0 8.5 17H9v3" />
      <path d="M14.5 4A2.5 2.5 0 0 1 17 6.5v.2a2.7 2.7 0 0 1 2 2.6v1.4a2.7 2.7 0 0 1-1 2.1v1.7a2.5 2.5 0 0 1-2.5 2.5H15v3" />
      <path d="M9.5 4a2.5 2.5 0 0 1 5 0v13a2.5 2.5 0 0 1-5 0Z" />
    </Icon>
  ),
  strategi: (
    <Icon>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </Icon>
  ),
  processer: (
    <Icon>
      <rect x="3.5" y="4" width="6" height="6" rx="1.3" />
      <rect x="14.5" y="14" width="6" height="6" rx="1.3" />
      <path d="M9.5 7h4a2 2 0 0 1 2 2v4" />
    </Icon>
  ),
  systemer: (
    <Icon>
      <rect x="3.5" y="4" width="17" height="5" rx="1.3" />
      <rect x="3.5" y="14" width="17" height="5" rx="1.3" />
      <path d="M7 6.5h.01M7 16.5h.01" />
    </Icon>
  ),
  roller: (
    <Icon>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 6.2a3 3 0 0 1 0 5.6" />
      <path d="M17.5 19a5.2 5.2 0 0 0-3-4.7" />
    </Icon>
  ),
  data: (
    <Icon>
      <ellipse cx="12" cy="6" rx="7.5" ry="2.7" />
      <path d="M4.5 6v6c0 1.5 3.4 2.7 7.5 2.7s7.5-1.2 7.5-2.7V6" />
      <path d="M4.5 12v6c0 1.5 3.4 2.7 7.5 2.7s7.5-1.2 7.5-2.7v-6" />
    </Icon>
  ),
  aktorer: (
    <Icon>
      <circle cx="8" cy="8" r="2.6" />
      <circle cx="16" cy="8" r="2.6" />
      <path d="M3.3 19a4.9 4.9 0 0 1 9.4 0" />
      <path d="M11.3 19a4.9 4.9 0 0 1 9.4 0" />
    </Icon>
  ),
  chevron: (
    <Icon>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  ),
  forbedringer: (
    <Icon>
      <path d="M12 3v2.2M12 18.8V21M4.5 12h2.2M17.3 12h2.2M6.5 6.5l1.5 1.5M16 16l1.5 1.5M17.5 6.5 16 8M8 16l-1.5 1.5" />
      <circle cx="12" cy="12" r="3.5" />
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

const GROUPS = [
  {
    label: "Forstå",
    items: [{ href: "/", key: "hjernen", label: "Hjernen", accent: true }],
  },
  {
    label: "Definere",
    items: [
      { href: "/scoping", key: "strategi", label: "Strategi" },
      { href: "/processes", key: "processer", label: "Processer" },
      {
        key: "aktorer",
        label: "Aktører",
        children: [
          { href: "/landscape", key: "systemer", label: "Systemer" },
          { href: "/roles", key: "roller", label: "Roller" },
        ],
      },
      { href: "/data", key: "data", label: "Data" },
    ],
  },
  {
    label: "Byg",
    items: [{ href: "/improvements", key: "forbedringer", label: "Forbedringer" }],
  },
];

type LeafItem = { href: string; key: string; label: string; accent?: boolean };
type NavItem = LeafItem | { key: string; label: string; children: LeafItem[] };

function isParent(item: NavItem): item is { key: string; label: string; children: LeafItem[] } {
  return "children" in item;
}

type OrgUser = { id: string; name: string; email: string; role: string };
type ProposalRef = { id: string; name: string; selected: boolean };

function ProposalMark({ id, dim }: { id: string; dim?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md transition-opacity ${dim ? "opacity-35" : ""}`}
      style={{ color: proposalColor(id) }}
    >
      <LogoMark size={15} />
    </span>
  );
}

export function Nav({
  organization,
  users,
  proposals = [],
}: {
  organization: { id: string; name: string } | null;
  users: OrgUser[];
  proposals?: ProposalRef[];
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [, startPinTransition] = useTransition();

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  // Den samlede rail (56px) ligger fast i sidens flow — det er den, der
  // reserverer plads ved siden af hovedindholdet. Selve panelet der udvider
  // sig til 212px er absolut placeret ovenpå, så hovedindholdet aldrig selv
  // skal omberegne sin bredde og reflowe, når musen går ind og ud. Det er det
  // der gør overgangen ren: kun ét lag animerer, resten af siden ligger stille.
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
        {GROUPS.map((g) => (
          <div key={g.label ?? "root"} className="mb-5">
            <div className="mb-1.5 flex h-[14px] items-center px-2.5">
              {open ? (
                <span className="eyebrow whitespace-nowrap">{g.label}</span>
              ) : (
                <span className="h-px w-full bg-(--color-line)" />
              )}
            </div>
            <div className="space-y-px">
              {(g.items as NavItem[]).map((item) => {
                if (isParent(item)) {
                  const childActive = item.children.some((c) => isActive(c.href));
                  const isOpen = expanded.has(item.key) || childActive;
                  return (
                    <div key={item.key}>
                      <button
                        type="button"
                        title={item.label}
                        onClick={() =>
                          setExpanded((prev) => {
                            const next = new Set(prev);
                            next.has(item.key) ? next.delete(item.key) : next.add(item.key);
                            return next;
                          })
                        }
                        className={`flex h-[29px] w-full items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 text-[12.5px] transition-colors ${
                          childActive
                            ? "text-(--color-clay)"
                            : "text-(--color-muted) hover:bg-(--color-sunken) hover:text-(--color-text)"
                        }`}
                      >
                        {ICONS[item.key]}
                        {open && (
                          <>
                            <span className="min-w-0 flex-1 text-left leading-none">{item.label}</span>
                            <span
                              className={`shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                            >
                              {ICONS.chevron}
                            </span>
                          </>
                        )}
                      </button>
                      {open && isOpen && (
                        <div className="ml-3 space-y-px border-l border-(--color-line) pl-2.5">
                          {item.children.map((c) => {
                            const active = isActive(c.href);
                            return (
                              <Link
                                key={c.href}
                                href={c.href}
                                title={c.label}
                                className={`block whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors ${
                                  active
                                    ? "bg-(--color-clay) font-medium text-white"
                                    : "text-(--color-muted) hover:bg-(--color-sunken) hover:text-(--color-text)"
                                }`}
                              >
                                {c.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                const active = isActive(item.href);
                const isForbedringer = item.key === "forbedringer";

                if (isForbedringer) {
                  return (
                    <div key={item.href}>
                      <Link
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

                      {/*
                        Samme rækker, samme antal, samme højde uanset åben/lukket —
                        kun navnet toner ind/ud. Ellers hopper resten af menuen med,
                        fordi den lukkede og åbne visning havde forskellig totalhøjde.
                      */}
                      {proposals.length > 0 && (
                        <div
                          className={`mt-1 space-y-1 ${
                            open ? "ml-3 border-l border-(--color-line) pl-2.5" : "flex flex-col items-center"
                          }`}
                        >
                          {proposals.slice(0, 6).map((p) => (
                            <div key={p.id} className="flex h-[18px] items-center gap-1">
                              <button
                                type="button"
                                title={p.selected ? "Fjern pin" : "Pin forslaget"}
                                onClick={() => startPinTransition(() => togglePin(p.id))}
                                className="shrink-0 rounded hover:bg-(--color-sunken)"
                              >
                                <ProposalMark id={p.id} dim={!p.selected} />
                              </button>
                              {open && (
                                <Link
                                  href={`/improvements/${p.id}`}
                                  title={p.name}
                                  className={`min-w-0 flex-1 truncate rounded px-1 text-[12px] ${
                                    isActive(`/improvements/${p.id}`)
                                      ? "bg-(--color-clay) font-medium text-white"
                                      : "text-(--color-muted) hover:bg-(--color-sunken) hover:text-(--color-text)"
                                  }`}
                                >
                                  {p.name}
                                </Link>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

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
                    {item.accent && !active && open && (
                      <span className="pulse-soft h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-clay)" />
                    )}
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

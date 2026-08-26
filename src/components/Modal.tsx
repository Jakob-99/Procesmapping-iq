"use client";

import { useEffect, type ReactNode } from "react";

/*
  Fuldskærms-popup til ting der fortjener egen plads uden at forlade siden —
  fx Kontrolpanelet. Overlay lukker på klik udenfor og Escape.
*/
export function Modal({
  open,
  onClose,
  title,
  children,
  padded = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /* Sæt til false når indholdet selv styrer sit layout, fx en sidemenu der
     skal gå helt ud til kanten af modal-kroppen. */
  padded?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-(--color-line-soft) bg-(--color-surface) shadow-xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-(--color-line) px-6 py-4">
          <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Luk"
            className="rounded-md p-1.5 text-(--color-muted) transition-colors hover:bg-(--color-sunken) hover:text-(--color-text)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className={`flex-1 overflow-hidden ${padded ? "overflow-y-auto px-6 py-5" : "flex"}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

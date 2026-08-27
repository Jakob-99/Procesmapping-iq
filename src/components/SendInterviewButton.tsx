"use client";

import { useEffect, useState, useTransition } from "react";
import { sendInterviewToSubProcesses } from "@/app/(customer)/processes/actions";
import { ClayButton } from "./ui";

type Expert = { id: string; name: string; email: string; invitedAt: string | null };
type SubProcessRow = { id: string; name: string; experts: Expert[] };

/*
  Før man sender ud, skal man kunne se PRÆCIS hvilke underprocessers eksperter
  der rammes, og fravælge nogen — én e2e-proces kan sagtens have underprocesser
  man ikke vil forstyrre igen (allerede i gang, eller ikke klar endnu).
*/
export function SendInterviewButton({
  processId,
  subProcesses,
}: {
  processId: string;
  subProcesses: SubProcessRow[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(subProcesses.map((sp) => sp.id)),
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function submit() {
    startTransition(async () => {
      const n = await sendInterviewToSubProcesses(processId, [...selected]);
      setSent(n ?? 0);
      setOpen(false);
    });
  }

  const totalExperts = subProcesses
    .filter((sp) => selected.has(sp.id))
    .reduce((sum, sp) => sum + sp.experts.length, 0);

  return (
    <>
      <ClayButton
        disabled={subProcesses.length === 0}
        onClick={() => {
          setSent(null);
          setOpen(true);
        }}
        className="!py-2 !text-[12.5px]"
      >
        {sent !== null ? `Sendt til ${sent}` : "Send interview"}
      </ClayButton>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-(--color-line-soft) bg-(--color-surface) shadow-xl"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-(--color-line) px-5 py-3.5">
              <h2 className="text-[15px] font-semibold tracking-tight">Send interview</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Luk"
                className="rounded-md p-1 text-(--color-muted) transition-colors hover:bg-(--color-sunken) hover:text-(--color-text)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="mb-3 text-[12px] text-(--color-faint)">
                Vælg hvilke underprocessers procesksperter der skal have en invitation. Fravælg dem du ikke vil forstyrre lige nu.
              </p>
              <div className="space-y-1">
                {subProcesses.map((sp) => (
                  <label
                    key={sp.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 hover:bg-(--color-sunken)"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(sp.id)}
                      onChange={() => toggle(sp.id)}
                      className="mt-0.5 accent-(--color-clay)"
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium">{sp.name}</div>
                      <div className="truncate text-[11px] text-(--color-faint)">
                        {sp.experts.map((e) => e.name).join(", ")}
                        {sp.experts.every((e) => e.invitedAt) && " · allerede inviteret før"}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-(--color-line) px-5 py-3.5">
              <span className="text-[11.5px] text-(--color-faint)">
                {selected.size} af {subProcesses.length} underprocesser · {totalExperts} modtager{totalExperts === 1 ? "" : "e"}
              </span>
              <ClayButton onClick={submit} disabled={pending || selected.size === 0} className="!py-1.5 !text-[12.5px]">
                {pending ? "Sender…" : "Send"}
              </ClayButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

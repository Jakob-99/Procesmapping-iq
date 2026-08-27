"use client";

import { useTransition } from "react";
import {
  runCheckNow,
  setPolicyActive,
  setPolicyAutoEmail,
  setPolicyInterval,
} from "@/app/governance/actions";
import { Badge } from "./ui";

const INTERVAL_OPTIONS = [
  { value: 30, label: "Hver måned" },
  { value: 90, label: "Hvert kvartal" },
  { value: 180, label: "Hvert halvår" },
  { value: 365, label: "Hvert år" },
];

export type GovernanceRowData = {
  subProcessId: string;
  name: string;
  processName: string;
  assigneeName: string | null;
  policy: {
    active: boolean;
    intervalDays: number;
    autoSendEmail: boolean;
    lastCheckedAt: string | null;
    lastEmailAt: string | null;
  };
  lastRun: {
    ranAt: string;
    needsUpdate: boolean;
    finding: string;
    emailSent: boolean;
    emailTo: string | null;
  } | null;
};

function fmt(iso: string | null) {
  if (!iso) return "aldrig";
  return new Date(iso).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });
}

export function GovernanceRow({ row }: { row: GovernanceRowData }) {
  const [pending, startTransition] = useTransition();
  const { subProcessId, policy, lastRun } = row;

  return (
    <div className="space-y-3 border-b border-(--color-line-soft) py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium">{row.name}</div>
          <div className="truncate text-[11.5px] text-(--color-faint)">
            {row.processName}
            {row.assigneeName ? ` · tildelt ${row.assigneeName}` : " · ingen tildelt endnu"}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <label className="flex items-center gap-1.5 text-[12px] text-(--color-muted)">
            <input
              type="checkbox"
              checked={policy.active}
              disabled={pending}
              onChange={(e) =>
                startTransition(() => setPolicyActive(subProcessId, e.target.checked))
              }
              className="accent-(--color-clay)"
            />
            Aktiv
          </label>

          <select
            value={policy.intervalDays}
            disabled={pending || !policy.active}
            onChange={(e) =>
              startTransition(() => setPolicyInterval(subProcessId, Number(e.target.value)))
            }
            className="rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1 text-[12px] outline-none disabled:opacity-40"
          >
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-[12px] text-(--color-muted)">
            <input
              type="checkbox"
              checked={policy.autoSendEmail}
              disabled={pending || !policy.active || !row.assigneeName}
              onChange={(e) =>
                startTransition(() => setPolicyAutoEmail(subProcessId, e.target.checked))
              }
              className="accent-(--color-clay)"
            />
            Send mail selv
          </label>

          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => runCheckNow(subProcessId))}
            className="rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-2.5 py-1 text-[11.5px] font-medium text-(--color-clay) transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {pending ? "Kører…" : "Kør nu"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-(--color-faint)">
        <span>Sidst tjekket: {fmt(policy.lastCheckedAt)}</span>
        <span>Sidst mailet: {fmt(policy.lastEmailAt)}</span>
        {policy.autoSendEmail && !row.assigneeName && (
          <span className="text-(--color-warn)">ingen tildelt medarbejder at maile</span>
        )}
      </div>

      {lastRun && (
        <div className="rounded-md bg-(--color-raised) p-3 text-[12px] leading-relaxed">
          <div className="mb-1 flex items-center gap-2">
            <Badge tone={lastRun.needsUpdate ? "warn" : "ok"}>
              {lastRun.needsUpdate ? "Trænger til eftersyn" : "Ser fint ud"}
            </Badge>
            {lastRun.emailSent && <Badge tone="clay">Mail sendt til {lastRun.emailTo}</Badge>}
          </div>
          <p className="text-(--color-muted)">{lastRun.finding}</p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { updateSystemReadiness } from "@/app/(customer)/landscape/actions";
import { Badge, ClayButton, OutlineButton } from "./ui";
import { MASTER_DATA_QUALITY_LABELS, VERDICT_LABELS, systemReadiness } from "@/lib/readiness";

export function SystemReadinessRow({
  id,
  name,
  category,
  hasOpenApi: initialHasOpenApi,
  masterDataQuality: initialQuality,
  processesUpToDate: initialUpToDate,
  readinessNotes: initialNotes,
}: {
  id: string;
  name: string;
  category: string | null;
  hasOpenApi: boolean;
  masterDataQuality: string | null;
  processesUpToDate: boolean;
  readinessNotes: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [hasOpenApi, setHasOpenApi] = useState(initialHasOpenApi);
  const [masterDataQuality, setMasterDataQuality] = useState(initialQuality ?? "");
  const [processesUpToDate, setProcessesUpToDate] = useState(initialUpToDate);
  const [notes, setNotes] = useState(initialNotes ?? "");

  const { verdict } = systemReadiness({ hasOpenApi: initialHasOpenApi, masterDataQuality: initialQuality, processesUpToDate: initialUpToDate });
  const v = VERDICT_LABELS[verdict];

  function submit() {
    startTransition(async () => {
      await updateSystemReadiness(id, {
        hasOpenApi,
        masterDataQuality: masterDataQuality as "GOOD" | "PARTIAL" | "POOR" | "",
        processesUpToDate,
        readinessNotes: notes,
      });
      setOpen(false);
    });
  }

  return (
    <div className="rounded-lg border border-(--color-line-soft) bg-(--color-surface) p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold">{name}</div>
          <div className="text-[11px] text-(--color-faint)">{category ?? "Ukategoriseret"}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={v.tone}>{v.label}</Badge>
          <OutlineButton onClick={() => setOpen((o) => !o)}>{open ? "Luk" : "Rediger"}</OutlineButton>
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t border-(--color-line) pt-4">
          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={hasOpenApi} onChange={(e) => setHasOpenApi(e.target.checked)} className="h-3.5 w-3.5" />
            Åbne API'er med tilbageskrivning
          </label>
          <div>
            <div className="mb-1 text-[11.5px] font-medium text-(--color-faint)">Stamdata-hygiejne</div>
            <select
              value={masterDataQuality}
              onChange={(e) => setMasterDataQuality(e.target.value)}
              className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
            >
              <option value="">Ikke vurderet</option>
              {Object.entries(MASTER_DATA_QUALITY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              checked={processesUpToDate}
              onChange={(e) => setProcessesUpToDate(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Data registreres løbende, ikke samlet op senere
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Noter (valgfrit)"
            rows={2}
            className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
          />
          <ClayButton onClick={submit} disabled={pending} className="!py-1.5 !text-[12.5px]">
            Gem
          </ClayButton>
        </div>
      )}
    </div>
  );
}

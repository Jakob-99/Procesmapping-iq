"use client";

import { useState, useTransition } from "react";
import { Badge, Empty, Panel } from "./ui";
import { splitInsights, type Note } from "@/lib/insights";
import {
  setImprovementLogStatus,
  submitOwnImprovementLog,
} from "@/app/(customer)/processes/[processId]/[subId]/actions";

type LogItem = { id: string; content: string; status: string; createdAt: string };

const LOG_STATUS_LABEL: Record<string, string> = {
  NEW: "Ny",
  REVIEWED: "Set",
  CONVERTED: "Blevet til forbedring",
  CLOSED: "Lukket",
};

const LOG_STATUSES = ["NEW", "REVIEWED", "CONVERTED", "CLOSED"] as const;

export function InsightsPanel({
  notes,
  logs = [],
  processId,
  subProcessId,
}: {
  notes: Note[];
  logs?: LogItem[];
  processId?: string;
  subProcessId?: string;
}) {
  const { works, broken } = splitInsights(notes);
  const canLog = Boolean(processId && subProcessId);

  if (notes.length === 0 && logs.length === 0 && !canLog) {
    return (
      <Panel eyebrow="Fra kortlægningen" title="Indsigter" bodyClass="p-4">
        <Empty>Ingen indsigter endnu — de kommer fra interviewene.</Empty>
      </Panel>
    );
  }

  return (
    <Panel eyebrow="Fra kortlægningen" title="Indsigter" bodyClass="p-4">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <div className="mb-2 text-[11px] font-medium text-(--color-ok)">
            Fungerer ({works.length})
          </div>
          <div className="space-y-2">
            {works.length === 0 ? (
              <p className="text-[12px] text-(--color-faint)">Intet fundet endnu.</p>
            ) : (
              works.map((n, i) => (
                <p
                  key={i}
                  className="border-l-2 border-(--color-ok) pl-3 text-[12px] leading-relaxed text-(--color-muted)"
                >
                  {n.content}
                </p>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-medium text-(--color-alert)">
            Fungerer ikke ({broken.length})
          </div>
          <div className="space-y-2">
            {broken.length === 0 ? (
              <p className="text-[12px] text-(--color-faint)">Intet fundet endnu.</p>
            ) : (
              broken.map((n, i) => (
                <p
                  key={i}
                  className="border-l-2 border-(--color-alert) pl-3 text-[12px] leading-relaxed text-(--color-muted)"
                >
                  {n.content}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {/*
        Medarbejderens egne forbedringsønsker — enten sendt fra interview-
        siden (submitImprovementLog i app/interviews/actions.ts, kun muligt
        midt i en interview-session) eller, nu, meldt løbende ind herfra af
        enhver logget-ind medarbejder der kigger på underprocessen. Vises
        samme sted uanset kilde, ikke gemt væk et andet sted.
      */}
      <div className="mt-5 border-t border-(--color-line-soft) pt-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-medium text-(--color-clay)">
            Ønskede forbedringer fra medarbejdere ({logs.length})
          </div>
        </div>
        <div className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-[12px] text-(--color-faint)">Ingen ønsker endnu.</p>
          ) : (
            logs.map((l) => (
              <LogRow
                key={l.id}
                log={l}
                processId={processId}
                subProcessId={subProcessId}
                editable={canLog}
              />
            ))
          )}
        </div>
        {canLog && <NewLogForm processId={processId!} subProcessId={subProcessId!} />}
      </div>
    </Panel>
  );
}

function LogRow({
  log,
  processId,
  subProcessId,
  editable,
}: {
  log: LogItem;
  processId?: string;
  subProcessId?: string;
  editable: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="border-l-2 border-(--color-clay) pl-3 text-[12px] leading-relaxed text-(--color-muted)">
      <p>{log.content}</p>
      {editable && processId && subProcessId ? (
        <select
          value={log.status}
          disabled={pending}
          onChange={(e) => {
            const status = e.target.value as (typeof LOG_STATUSES)[number];
            startTransition(() => setImprovementLogStatus(processId, subProcessId, log.id, status));
          }}
          className="mt-1 rounded-full border border-(--color-line-soft) bg-transparent px-2 py-0.5 text-[11px] font-medium text-(--color-clay) outline-none"
        >
          {LOG_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LOG_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      ) : (
        <Badge tone="faint">{LOG_STATUS_LABEL[log.status] ?? log.status}</Badge>
      )}
    </div>
  );
}

function NewLogForm({ processId, subProcessId }: { processId: string; subProcessId: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-[12px] font-medium text-(--color-clay) hover:underline"
      >
        + Meld en idé
      </button>
    );
  }

  function submit() {
    if (!content.trim() || pending) return;
    startTransition(async () => {
      await submitOwnImprovementLog(processId, subProcessId, content);
      setContent("");
      setOpen(false);
    });
  }

  return (
    <div className="mt-3 space-y-1.5">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={2}
        placeholder="Hvad kunne gøres bedre her?"
        className="w-full resize-none rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !content.trim()}
          className="rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-2.5 py-1 text-[12px] font-medium text-(--color-clay) transition-colors hover:bg-(--color-clay-line) disabled:opacity-40"
        >
          {pending ? "Sender…" : "Send"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] text-(--color-faint) hover:text-(--color-text)"
        >
          Annuller
        </button>
      </div>
    </div>
  );
}

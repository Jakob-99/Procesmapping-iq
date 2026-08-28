"use client";

import { useRef, useState, useTransition } from "react";
import { generateProposal } from "@/app/(customer)/improvements/actions";
import { ClayButton } from "./ui";

type SubProcessOption = { id: string; name: string; processName: string };

/*
  Flaskehalsanalysen agenten skulle udføre — vælg en kortlagt underproces,
  lad agenten finde flaskehalsen og skrive forslaget, og bliv sendt videre
  til den nye rapport. Kan tage et halvt minuts tid (samme effort-niveau som
  et interviewsvar), derfor den tydelige "Analyserer…"-tilstand.
*/
export function ProposalGenerator({ subProcesses }: { subProcesses: SubProcessOption[] }) {
  const [open, setOpen] = useState(false);
  const [subProcessId, setSubProcessId] = useState(subProcesses[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  if (!open) {
    return (
      <ClayButton onClick={() => setOpen(true)} className="!py-1.5 !text-[12.5px]">
        + Generér forslag
      </ClayButton>
    );
  }

  function submit() {
    if (!subProcessId || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await generateProposal(subProcessId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div ref={ref} className="flex flex-wrap items-center gap-2">
      {subProcesses.length === 0 ? (
        <span className="text-[12px] text-(--color-faint)">
          Ingen kortlagte underprocesser endnu at analysere.
        </span>
      ) : (
        <>
          <select
            value={subProcessId}
            onChange={(e) => setSubProcessId(e.target.value)}
            disabled={pending}
            className="rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
          >
            {subProcesses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.processName} · {s.name}
              </option>
            ))}
          </select>
          <ClayButton onClick={submit} disabled={pending} className="!py-1.5 !text-[12.5px]">
            {pending ? "Analyserer…" : "Generér"}
          </ClayButton>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="text-[12px] text-(--color-faint) hover:text-(--color-text)"
          >
            Annuller
          </button>
        </>
      )}
      {error && <p className="w-full text-[11.5px] text-(--color-alert)">{error}</p>}
    </div>
  );
}

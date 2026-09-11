"use client";

import { useState, useTransition } from "react";
import { setPublicJoin } from "@/app/(customer)/agents/actions";
import { ClayButton, OutlineButton } from "./ui";

type AgentJoinState = {
  id: string;
  name: string;
  enabledForThisRound: boolean;
  joinUrl: string;
  qrDataUrl: string | null;
};

/*
  Offentlig invitation er nu en funktion under rundens egen side, ikke under
  agenten — men selve linket/slug'et hænger stadig på InterviewAgent i
  skemaet (setPublicJoin), så man vælger her HVILKEN agent der skal have et
  aktivt link ind i netop denne runde.
*/
export function RoundPublicJoin({ roundId, agents }: { roundId: string; agents: AgentJoinState[] }) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [pickedAgentId, setPickedAgentId] = useState(
    agents.find((a) => a.enabledForThisRound)?.id ?? agents[0]?.id ?? "",
  );

  const active = agents.find((a) => a.id === pickedAgentId);

  function enable() {
    if (!pickedAgentId) return;
    startTransition(() => setPublicJoin(pickedAgentId, true, roundId));
  }

  function disable() {
    if (!active) return;
    startTransition(() => setPublicJoin(active.id, false));
  }

  function copy() {
    if (!active) return;
    navigator.clipboard.writeText(active.joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (agents.length === 0) {
    return (
      <p className="text-[12.5px] text-(--color-faint)">
        Opret en interview agent først — det er dens link der deles.
      </p>
    );
  }

  if (active?.enabledForThisRound) {
    return (
      <div>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[12.5px] text-(--color-muted)">Aktivt for agenten</span>
          <span className="text-[12.5px] font-medium">{active.name}</span>
        </div>
        <OutlineButton onClick={disable} disabled={pending}>
          Slå offentligt link fra
        </OutlineButton>

        {active.qrDataUrl && (
          <div className="mt-4 flex items-start gap-4">
            <img
              src={active.qrDataUrl}
              alt="QR-kode til interviewet"
              className="h-28 w-28 rounded-lg border border-(--color-line-soft)"
            />
            <div className="min-w-0">
              <div className="eyebrow mb-1.5">Delbart link</div>
              <div className="flex items-center gap-2">
                <code className="truncate rounded-md border border-(--color-line) bg-(--color-raised) px-2.5 py-1.5 text-[12px]">
                  {active.joinUrl}
                </code>
                <button onClick={copy} className="shrink-0 text-[12px] text-(--color-clay) hover:underline">
                  {copied ? "Kopieret!" : "Kopiér"}
                </button>
              </div>
              <p className="mt-2 max-w-sm text-[11.5px] leading-relaxed text-(--color-faint)">
                Alle der åbner linket eller scanner koden opretter sig selv
                som respondent og starter interviewet med det samme, i denne
                runde.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={pickedAgentId}
        onChange={(e) => setPickedAgentId(e.target.value)}
        className="rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[13px] outline-none focus:border-(--color-clay)"
      >
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <ClayButton onClick={enable} disabled={pending || !pickedAgentId} className="!py-1.5 !text-[12.5px]">
        Slå offentligt link til
      </ClayButton>
    </div>
  );
}

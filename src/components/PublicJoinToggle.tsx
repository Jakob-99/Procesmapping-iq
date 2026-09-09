"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setPublicJoin } from "@/app/(customer)/agents/actions";
import { ClayButton, OutlineButton } from "./ui";

type Round = { id: string; name: string };

export function PublicJoinToggle({
  agentId,
  enabled,
  roundId,
  rounds,
  joinUrl,
  qrDataUrl,
}: {
  agentId: string;
  enabled: boolean;
  roundId: string | null;
  rounds: Round[];
  joinUrl: string;
  qrDataUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [pickedRoundId, setPickedRoundId] = useState(roundId ?? rounds[0]?.id ?? "");

  function enable() {
    if (!pickedRoundId) return;
    startTransition(() => setPublicJoin(agentId, true, pickedRoundId));
  }

  function disable() {
    startTransition(() => setPublicJoin(agentId, false));
  }

  function copy() {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (enabled) {
    return (
      <div>
        <OutlineButton onClick={disable} disabled={pending}>
          Slå offentligt link fra
        </OutlineButton>

        {qrDataUrl && (
          <div className="mt-4 flex items-start gap-4">
            <img
              src={qrDataUrl}
              alt="QR-kode til interviewet"
              className="h-28 w-28 rounded-lg border border-(--color-line-soft)"
            />
            <div className="min-w-0">
              <div className="eyebrow mb-1.5">Delbart link</div>
              <div className="flex items-center gap-2">
                <code className="truncate rounded-md border border-(--color-line) bg-(--color-raised) px-2.5 py-1.5 text-[12px]">
                  {joinUrl}
                </code>
                <button
                  onClick={copy}
                  className="shrink-0 text-[12px] text-(--color-clay) hover:underline"
                >
                  {copied ? "Kopieret!" : "Kopiér"}
                </button>
              </div>
              <p className="mt-2 max-w-sm text-[11.5px] leading-relaxed text-(--color-faint)">
                Alle der åbner linket eller scanner koden opretter sig selv
                som respondent og starter interviewet med det samme.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <p className="text-[12.5px] text-(--color-faint)">
        Opret en{" "}
        <Link href="/rounds" className="text-(--color-clay) hover:underline">
          interview runde
        </Link>{" "}
        først — de selv-oprettede interviews skal samles i én.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={pickedRoundId}
        onChange={(e) => setPickedRoundId(e.target.value)}
        className="rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[13px] outline-none focus:border-(--color-clay)"
      >
        {rounds.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <ClayButton onClick={enable} disabled={pending || !pickedRoundId} className="!py-1.5 !text-[12.5px]">
        Slå offentligt link til
      </ClayButton>
    </div>
  );
}

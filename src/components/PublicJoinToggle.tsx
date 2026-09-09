"use client";

import { useState, useTransition } from "react";
import { setPublicJoin } from "@/app/(customer)/agents/actions";
import { OutlineButton } from "./ui";

export function PublicJoinToggle({
  agentId,
  enabled,
  joinUrl,
  qrDataUrl,
}: {
  agentId: string;
  enabled: boolean;
  joinUrl: string;
  qrDataUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function toggle() {
    startTransition(() => setPublicJoin(agentId, !enabled));
  }

  function copy() {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <OutlineButton onClick={toggle} disabled={pending}>
        {enabled ? "Slå offentligt link fra" : "Slå offentligt link til"}
      </OutlineButton>

      {enabled && qrDataUrl && (
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
              Alle der åbner linket eller scanner koden opretter sig selv som
              respondent og starter interviewet med det samme.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

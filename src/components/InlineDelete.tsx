"use client";

import { useState, type MouseEvent } from "react";

/*
  "Slet" → "Sikker? Ja, slet / Annullér" inline i rækken. Aldrig
  window.confirm(), der kan blive undertrykt
  stille i nogle browser-/embed-sammenhænge, så sletningen aldrig sker.
  Klik stoppes her, så knappen også kan ligge inde i et kort der selv er et
  link (procesmodellens fliser) uden at navigere væk.
*/
export function InlineDelete({
  onConfirm,
  pending,
  title,
  label = "Slet",
  className = "",
}: {
  onConfirm: () => void;
  pending?: boolean;
  title?: string;
  label?: string;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  function handle(fn: () => void) {
    return (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    };
  }

  if (confirming) {
    return (
      <span className={`inline-flex items-center gap-2.5 ${className}`}>
        <span className="text-[11px] text-(--color-alert)">Sikker?</span>
        <button
          type="button"
          onClick={handle(() => {
            setConfirming(false);
            onConfirm();
          })}
          disabled={pending}
          className="text-[11px] font-medium text-(--color-alert) hover:opacity-70"
        >
          Ja, slet
        </button>
        <button
          type="button"
          onClick={handle(() => setConfirming(false))}
          className="text-[11px] text-(--color-faint) hover:text-(--color-text)"
        >
          Annullér
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handle(() => setConfirming(true))}
      disabled={pending}
      title={title}
      className={`text-[11px] text-(--color-faint) hover:text-(--color-alert) disabled:opacity-40 ${className}`}
    >
      {label}
    </button>
  );
}

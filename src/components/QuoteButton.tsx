"use client";

import { useState, useTransition } from "react";
import { saveQuote } from "@/app/(customer)/insights/actions";
import { ClayButton } from "./ui";

/*
  Bevidst forenkling af "quote stitching": ingen ægte tekst-markering i
  brødteksten (Selection API/ranges er sprødt at bygge robust) — brugeren
  klipper selv det gode citat ud af den forudfyldte tekstboks.
*/
export function QuoteButton({
  interviewId,
  messageId,
  content,
}: {
  interviewId: string;
  messageId: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(content);
  const [tag, setTag] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => {
          setOpen(true);
          setText(content);
          setSaved(false);
        }}
        className="mt-1 text-[11px] text-(--color-faint) hover:text-(--color-clay)"
      >
        Citér
      </button>
    );
  }

  function submit() {
    startTransition(async () => {
      await saveQuote(interviewId, messageId, text, tag);
      setSaved(true);
      setOpen(false);
    });
  }

  return (
    <div className="mt-2 max-w-md space-y-1.5 rounded-lg border border-(--color-clay-line) bg-(--color-clay-wash) p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <input
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="Tag (valgfrit)"
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <div className="flex gap-2 pt-0.5">
        <ClayButton onClick={submit} disabled={pending || !text.trim()} className="!py-1.5 !text-[12.5px]">
          Gem citat
        </ClayButton>
        <button
          onClick={() => setOpen(false)}
          className="text-[12px] text-(--color-faint) hover:text-(--color-text)"
        >
          Annullér
        </button>
      </div>
      {saved && <p className="text-[11px] text-(--color-ok)">Gemt.</p>}
    </div>
  );
}

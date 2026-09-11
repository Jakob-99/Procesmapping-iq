"use client";

import { useState, useTransition } from "react";
import { createQuantQuestion, deleteQuantQuestion } from "@/app/(customer)/agents/actions";
import { ClayButton, Badge } from "./ui";

type QuantQuestion = {
  id: string;
  prompt: string;
  type: string;
  options: string | null;
};

/*
  Faste, sammenlignelige spørgsmål agenten stiller alle respondenter — i
  modsætning til de frie AI-probes. Se buildInterviewSystemPrompt for hvordan
  de bliver en del af selve samtalen.
*/
export function QuantQuestionsEditor({
  agentId,
  questions,
}: {
  agentId: string;
  questions: QuantQuestion[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<"CHOICE" | "SCALE">("CHOICE");
  const [optionsText, setOptionsText] = useState("");

  function submit() {
    if (!prompt.trim()) return;
    startTransition(async () => {
      await createQuantQuestion(
        agentId,
        prompt,
        type,
        optionsText.split(",").map((o) => o.trim()),
      );
      setPrompt("");
      setOptionsText("");
      setOpen(false);
    });
  }

  return (
    <div>
      <div className="mb-3 space-y-2">
        {questions.length === 0 && (
          <p className="text-[12.5px] text-(--color-faint)">
            Ingen faste spørgsmål endnu — agenten stiller kun frie, adaptive
            spørgsmål.
          </p>
        )}
        {questions.map((q) => (
          <div
            key={q.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-(--color-line-soft) bg-(--color-raised) px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-[13px]">{q.prompt}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <Badge tone="muted">{q.type === "CHOICE" ? "Valg" : "Skala 1-5"}</Badge>
                {q.type === "CHOICE" && q.options && (
                  <span className="text-[11px] text-(--color-faint)">
                    {(JSON.parse(q.options) as string[]).join(", ")}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => startTransition(() => deleteQuantQuestion(q.id))}
              disabled={pending}
              className="shrink-0 text-[12px] text-(--color-faint) hover:text-(--color-alert)"
            >
              Slet
            </button>
          </div>
        ))}
      </div>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-dashed border-(--color-line) px-3.5 py-1.5 text-[12px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
        >
          + Tilføj spørgsmål
        </button>
      ) : (
        <div className="space-y-1.5 rounded-xl border border-(--color-line-soft) bg-(--color-raised) p-3.5">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Spørgsmålets ordlyd"
            className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => setType("CHOICE")}
              className={`rounded-full border px-3 py-1 text-[12px] ${type === "CHOICE" ? "border-(--color-clay) bg-(--color-clay-wash) text-(--color-clay)" : "border-(--color-line) text-(--color-muted)"}`}
            >
              Valgmuligheder
            </button>
            <button
              onClick={() => setType("SCALE")}
              className={`rounded-full border px-3 py-1 text-[12px] ${type === "SCALE" ? "border-(--color-clay) bg-(--color-clay-wash) text-(--color-clay)" : "border-(--color-line) text-(--color-muted)"}`}
            >
              Skala 1-5
            </button>
          </div>
          {type === "CHOICE" && (
            <input
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              placeholder="Muligheder, adskilt af komma"
              className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
            />
          )}
          <div className="flex gap-2 pt-0.5">
            <ClayButton onClick={submit} disabled={pending || !prompt.trim()} className="!py-1.5 !text-[12.5px]">
              Tilføj
            </ClayButton>
            <button
              onClick={() => setOpen(false)}
              className="text-[12px] text-(--color-faint) hover:text-(--color-text)"
            >
              Annullér
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

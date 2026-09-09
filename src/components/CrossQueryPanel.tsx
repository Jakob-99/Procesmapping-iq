"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { askCrossQuery } from "@/app/(customer)/insights/actions";
import { ClayButton } from "./ui";

type Answer = { answer: string; sources: { interviewId: string; snippet: string }[] };

export function CrossQueryPanel({ agentId }: { agentId: string }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ask() {
    if (!question.trim() || pending) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await askCrossQuery(agentId, question);
      if ("error" in res) setError(res.error);
      else setResult(res);
    });
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Spørg noget, der går på tværs af alle interviews…"
          className="flex-1 rounded-lg border border-(--color-line) bg-(--color-surface) px-4 py-3 text-[14px] outline-none transition-colors placeholder:text-(--color-faint) focus:border-(--color-clay-line)"
        />
        <ClayButton onClick={ask} disabled={pending || !question.trim()}>
          {pending ? "Søger…" : "Spørg"}
        </ClayButton>
      </div>

      {error && <p className="mt-4 text-[12.5px] text-(--color-alert)">{error}</p>}

      {result && (
        <div className="mt-6 rounded-xl border border-(--color-clay-line) bg-(--color-clay-wash) p-5">
          <p className="text-[14px] leading-relaxed text-(--color-text)">{result.answer}</p>
          {result.sources.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {result.sources.map((s, i) => (
                <Link
                  key={i}
                  href={`/interviews/${s.interviewId}`}
                  title={s.snippet}
                  className="rounded-full border border-(--color-clay-line) bg-(--color-surface) px-2.5 py-1 text-[11px] text-(--color-clay) hover:bg-(--color-clay-line)"
                >
                  Kilde {i + 1}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

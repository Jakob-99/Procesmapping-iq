"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentTurn } from "@/lib/interview";
import { InterviewForm } from "./InterviewForm";
import { Badge, type Tone } from "./ui";
import { NOTE_CATEGORIES } from "@/lib/interview";
import {
  saveInterviewMessage,
  saveInterviewNote,
  completeInterview,
} from "@/app/(customer)/respond/actions";

const NOTE_TONE: Record<string, Tone> = {
  PAIN: "alert",
  WORKAROUND: "warn",
  RISK: "alert",
  KNOWLEDGE: "muted",
  OPPORTUNITY: "clay",
};

type Turn = {
  role: "agent" | "user";
  content: string;
  form?: AgentTurn["form"];
  formAnswered?: boolean;
};

type MockAgentTurn = AgentTurn & { mock?: boolean };

/*
  Bruges to steder: et rigtigt, afsendt interview (interviewId sat, gemmer
  løbende) og konsulentens "prøv agenten selv"-preview (agentId sat i stedet,
  intet gemmes — preview er sand når interviewId er fraværende).
*/
export function InterviewSession({
  interviewId,
  agentId,
  agentName,
  respondentName,
  preview,
}: {
  interviewId?: string;
  agentId?: string;
  agentName: string;
  respondentName: string;
  preview?: boolean;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [notes, setNotes] = useState<{ category: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const [mock, setMock] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function ask(history: Turn[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          agentId,
          messages: history.map((t) => ({ role: t.role, content: t.content })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Noget gik galt.");
        return;
      }

      const turn = data as MockAgentTurn;
      if (turn.mock) setMock(true);
      setTurns([...history, { role: "agent", content: turn.say, form: turn.form }]);
      if (turn.keynote) setNotes((n) => [...n, turn.keynote!]);
      if (turn.done) setDone(true);

      if (interviewId) {
        saveInterviewMessage(interviewId, "agent", turn.say);
        if (turn.keynote) saveInterviewNote(interviewId, turn.keynote.category, turn.keynote.content);
        if (turn.done) completeInterview(interviewId);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function start() {
    setStarted(true);
    ask([]);
  }

  function reply(text: string, fromFormIndex?: number) {
    if (!text.trim() || busy) return;
    const history = turns.map((t, i) =>
      i === fromFormIndex ? { ...t, formAnswered: true } : t,
    );
    const next: Turn[] = [...history, { role: "user", content: text }];
    setTurns(next);
    setInput("");
    if (interviewId) {
      saveInterviewMessage(interviewId, "user", text);
    }
    ask(next);
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-xl px-8 py-16 text-center">
        <div className="mb-4 text-[13px] text-(--color-muted)">
          {preview ? (
            <>
              Sådan her kommer interviewet <b>{agentName}</b> til at forløbe.
              Intet bliver gemt.
            </>
          ) : (
            <>
              Agenten <b>{agentName}</b> stiller nogle spørgsmål. Du kan
              stoppe undervejs og fortsætte senere.
            </>
          )}
        </div>
        <p className="mb-7 text-[13px] leading-relaxed text-(--color-faint)">
          Der er ingen forkerte svar. Svar frit og konkret.
        </p>
        <button
          onClick={start}
          className="lift rounded-lg border border-(--color-clay) bg-(--color-clay) px-6 py-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          {preview ? "Kør et prøve-interview" : "Start interviewet"}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-5 p-8 lg:grid-cols-[1fr_300px]">
      <div>
        {mock && (
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-(--color-line) bg-(--color-raised) px-2.5 py-1 text-[11px] font-medium text-(--color-muted)">
            Mock-tilstand — scriptede spørgsmål, intet API kaldt
          </div>
        )}
        <div className="space-y-6">
          {turns.map((t, i) => (
            <div key={i} className="rise">
              <div className="eyebrow mb-1.5">
                {t.role === "agent" ? agentName : respondentName}
              </div>
              <p
                className={`whitespace-pre-wrap text-[14px] leading-relaxed ${
                  t.role === "user" ? "text-(--color-muted)" : "text-(--color-text)"
                }`}
              >
                {t.content}
              </p>

              {t.form && !t.formAnswered && (
                <InterviewForm
                  title={t.form.title}
                  fields={t.form.fields}
                  disabled={busy}
                  onSubmit={(summary) => reply(summary, i)}
                />
              )}
            </div>
          ))}

          {busy && (
            <div className="pulse-soft text-[13px] text-(--color-faint)">
              lytter og formulerer næste spørgsmål…
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-[#b3462f33] bg-[#b3462f0d] px-4 py-3 text-[13px] text-(--color-alert)">
              {error}
            </div>
          )}

          {done && (
            <div className="border-l-2 border-(--color-ok) pl-3 text-[13px] text-(--color-ok)">
              Interviewet er færdigt. Tak for din tid!
            </div>
          )}

          <div ref={endRef} />
        </div>

        {!done && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              reply(input);
            }}
            className="mt-8 flex items-center gap-3 border-t border-(--color-line) pt-5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Skriv dit svar…"
              disabled={busy}
              className="flex-1 rounded-lg border border-(--color-line) bg-(--color-surface) px-4 py-3 text-[14px] outline-none transition-colors placeholder:text-(--color-faint) focus:border-(--color-clay-line)"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-lg border border-(--color-clay-line) bg-(--color-clay-wash) px-4 py-3 text-[13px] font-medium text-(--color-clay) disabled:opacity-30"
            >
              Svar
            </button>
          </form>
        )}
      </div>

      <aside className="h-fit border-l border-(--color-line) pl-5">
        <div className="eyebrow mb-3">Agentens noter</div>
        {notes.length === 0 ? (
          <p className="text-[12.5px] leading-relaxed text-(--color-faint)">
            Agenten noterer undervejs, når der dukker noget op der er værd at
            huske bagefter.
          </p>
        ) : (
          <div className="space-y-2">
            {notes.map((n, i) => (
              <div
                key={i}
                className="rise border-b border-(--color-line-soft) pb-3"
              >
                <Badge tone={NOTE_TONE[n.category] ?? "muted"}>
                  {NOTE_CATEGORIES[n.category as keyof typeof NOTE_CATEGORIES] ??
                    n.category}
                </Badge>
                <p className="mt-2 text-[12.5px] leading-relaxed text-(--color-muted)">
                  {n.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

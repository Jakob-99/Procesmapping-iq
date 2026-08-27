"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { AgentTurn } from "@/lib/interview";
import { InterviewForm } from "./InterviewForm";
import { Badge, type Tone } from "./ui";
import { NOTE_CATEGORIES } from "@/lib/domain";
import {
  startInterview,
  saveInterviewMessage,
  saveInterviewNote,
  completeInterview,
  submitImprovementLog,
} from "@/app/(customer)/interviews/actions";

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

export function InterviewSession({
  subProcessId,
  subProcessName,
  employeeName,
  preview,
  userId,
}: {
  subProcessId: string;
  subProcessName: string;
  employeeName: string;
  preview?: boolean;
  userId?: string;
}) {
  // Rigtigt interview (ikke preview): gemmer beskeder, noter og status i
  // databasen løbende, så det kan genoptages og bruges til kortlægningen.
  const interviewIdRef = useRef<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [notes, setNotes] = useState<{ category: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [started, setStarted] = useState(false);
  const [mock, setMock] = useState(false);
  const [wish, setWish] = useState("");
  const [wishSent, setWishSent] = useState(false);
  const [wishPending, startWishTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  function sendWish() {
    if (!wish.trim()) return;
    startWishTransition(async () => {
      await submitImprovementLog(subProcessId, employeeName, wish);
      setWish("");
      setWishSent(true);
      setTimeout(() => setWishSent(false), 3000);
    });
  }

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
          subProcessId,
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

      const interviewId = interviewIdRef.current;
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

  async function start() {
    setStarted(true);
    if (userId) {
      interviewIdRef.current = await startInterview(subProcessId, userId);
    }
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
    if (interviewIdRef.current) {
      saveInterviewMessage(interviewIdRef.current, "user", text);
    }
    ask(next);
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-xl px-8 py-16 text-center">
        <div className="mb-4 text-[13px] text-(--color-muted)">
          {preview ? (
            <>
              Sådan her kommer interviewet om <b>{subProcessName}</b> til at
              forløbe. Du taler som {employeeName} — intet bliver gemt.
            </>
          ) : (
            <>
              Agenten stiller spørgsmål om <b>{subProcessName}</b> i cirka 30
              minutter. Du kan stoppe undervejs og fortsætte senere.
            </>
          )}
        </div>
        <p className="mb-7 text-[13px] leading-relaxed text-(--color-faint)">
          Der er ingen forkerte svar. Fortæl hvad du faktisk gør — også det der
          foregår i et regneark eller over telefonen.
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
                {t.role === "agent" ? "Corner IQ" : employeeName}
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
              Interviewet er færdigt. Processen sendes nu til procesejeren for
              validering.
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

        {!preview && (
          <div className="mt-6 border-t border-(--color-line) pt-5">
            <div className="eyebrow mb-2">Foreslå en forbedring</div>
            <p className="mb-2.5 text-[12px] leading-relaxed text-(--color-faint)">
              Har du en idé eller et ønske til hvordan noget kunne gøres bedre?
              Det bliver synligt sammen med resten af kortlægningen.
            </p>
            <textarea
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              placeholder="Fx: Det ville hjælpe hvis…"
              disabled={wishPending}
              rows={3}
              className="w-full resize-none rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-(--color-faint) focus:border-(--color-clay-line)"
            />
            <button
              type="button"
              onClick={sendWish}
              disabled={wishPending || !wish.trim()}
              className="mt-2 rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-3 py-1.5 text-[12px] font-medium text-(--color-clay) transition-opacity hover:opacity-80 disabled:opacity-40"
            >
              {wishPending ? "Sender…" : "Send"}
            </button>
            {wishSent && (
              <p className="mt-2 text-[11.5px] text-(--color-ok)">Sendt, tak!</p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

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
  saveQuantAnswers,
} from "@/app/(respond)/respond/actions";

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
  showImage?: string | null;
};

type AgentImageInput = { label: string; data: string };

type MockAgentTurn = AgentTurn & { mock?: boolean };

// Minimal typing for the (non-standard, Chrome/Edge-only) Web Speech API —
// no @types package covers it.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type WindowWithSpeech = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

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
  agentImages,
  initialTurns,
  initialNotes,
  initialDone,
}: {
  interviewId?: string;
  agentId?: string;
  agentName: string;
  respondentName: string;
  preview?: boolean;
  // Billeder agenten kan vise undervejs — se showImage i AGENT_TURN_SCHEMA.
  agentImages?: AgentImageInput[];
  // Genoptagelse af et allerede påbegyndt (ikke afsluttet) interview — den
  // gemte besked-historik/noter fra forrige besøg, se [interviewId]/page.tsx.
  initialTurns?: Turn[];
  initialNotes?: { category: string; content: string }[];
  initialDone?: boolean;
}) {
  const resuming = !!initialTurns && initialTurns.length > 0;
  const [turns, setTurns] = useState<Turn[]>(initialTurns ?? []);
  const [notes, setNotes] = useState<{ category: string; content: string }[]>(initialNotes ?? []);
  const images = agentImages ?? [];
  const initialShown = images.filter((img) =>
    (initialTurns ?? []).some((t) => t.showImage === img.label),
  );
  const [shownImages, setShownImages] = useState<AgentImageInput[]>(initialShown);
  const [activeImageIndex, setActiveImageIndex] = useState(Math.max(0, initialShown.length - 1));
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(!!initialDone);
  const [started, setStarted] = useState(resuming);
  const [mock, setMock] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  // Svarfeltet vokser med indholdet — vigtigst når man dikterer, hvor teksten
  // kan blive lang uden man selv har trykket Enter undervejs.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Hvis browseren blev lukket lige efter respondentens svar blev gemt, men
  // før agentens næste spørgsmål nåede at komme tilbage, mangler samtalen sit
  // sidste agent-svar ved genoptagelse — hent det med det samme.
  useEffect(() => {
    if (resuming && !initialDone && initialTurns![initialTurns!.length - 1].role === "user") {
      ask(initialTurns!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Diktering af svar via browserens Web Speech API — ingen ekstern
  // afhængighed/nøgle, men kun understøttet i Chrome/Edge (ikke Firefox/Safari).
  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as WindowWithSpeech).SpeechRecognition ??
      (window as WindowWithSpeech).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "da-DK";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => recognition.stop();
  }, []);

  function toggleListening() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      setInput("");
      recognition.start();
      setListening(true);
    }
  }

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
      setTurns([...history, { role: "agent", content: turn.say, form: turn.form, showImage: turn.showImage }]);
      if (turn.keynote) setNotes((n) => [...n, turn.keynote!]);
      if (turn.done) setDone(true);

      const image = turn.showImage ? images.find((img) => img.label === turn.showImage) : undefined;
      if (image) {
        setShownImages((prev) => {
          const i = prev.findIndex((p) => p.label === image.label);
          const next = i === -1 ? [...prev, image] : prev;
          setActiveImageIndex(i === -1 ? next.length - 1 : i);
          return next;
        });
      }

      if (interviewId) {
        saveInterviewMessage(interviewId, "agent", turn.say, turn.showImage);
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

  function reply(
    text: string,
    fromFormIndex?: number,
    values?: Record<string, string | string[]>,
  ) {
    if (!text.trim() || busy) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    }
    const history = turns.map((t, i) =>
      i === fromFormIndex ? { ...t, formAnswered: true } : t,
    );
    const next: Turn[] = [...history, { role: "user", content: text }];
    setTurns(next);
    setInput("");
    if (interviewId) {
      saveInterviewMessage(interviewId, "user", text);
      // Faste kvant-spørgsmål har felt-id'et "quant:<quantQuestionId>" — se
      // buildInterviewSystemPrompt. Alt andet er frie AI-probes og gemmes kun
      // som den flade tekst-besked ovenfor.
      if (values) {
        const answers = Object.entries(values)
          .filter(([id]) => id.startsWith("quant:"))
          .map(([id, v]) => ({
            quantQuestionId: id.slice("quant:".length),
            value: Array.isArray(v) ? v.join(", ") : v,
          }))
          .filter((a) => a.value);
        if (answers.length) saveQuantAnswers(interviewId, answers);
      }
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

  const questionCount = turns.filter((t) => t.role === "agent").length;
  const hasRightPanel = preview || shownImages.length > 0;
  const activeImage = shownImages[activeImageIndex];
  const hasImage = shownImages.length > 0;

  return (
    <div className={`grid gap-5 p-8 ${hasImage ? "lg:grid-cols-2" : hasRightPanel ? "lg:grid-cols-[1fr_300px]" : ""}`}>
      <div>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {mock && (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-(--color-line) bg-(--color-raised) px-2.5 py-1 text-[11px] font-medium text-(--color-muted)">
              Mock-tilstand — scriptede spørgsmål, intet API kaldt
            </div>
          )}
          {!done && questionCount > 0 && (
            <div className="eyebrow">Spørgsmål {questionCount}</div>
          )}
        </div>
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
                  onSubmit={(summary, values) => reply(summary, i, values)}
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
          <div className="mt-8 border-t border-(--color-line) pt-5">
            {listening && (
              <div className="pulse-soft mb-2 flex items-center gap-1.5 text-[12px] text-(--color-clay)">
                <span className="h-1.5 w-1.5 rounded-full bg-(--color-clay)" />
                Lytter — tal roligt, svaret skrives med mens du taler
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                reply(input);
              }}
              className="flex items-end gap-3"
            >
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={busy}
                  title={listening ? "Stop diktering" : "Tal dit svar ind"}
                  className={`flex shrink-0 items-center justify-center rounded-lg border p-3 transition-colors disabled:opacity-30 ${
                    listening
                      ? "border-(--color-clay) bg-(--color-clay) text-white"
                      : "border-(--color-line) bg-(--color-surface) text-(--color-muted) hover:border-(--color-clay-line) hover:text-(--color-clay)"
                  }`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
                    <path d="M19 11a7 7 0 0 1-14 0" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="8" y1="22" x2="16" y2="22" />
                  </svg>
                </button>
              )}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    reply(input);
                  }
                }}
                placeholder={listening ? "Taler…" : "Skriv dit svar, eller tal det ind…"}
                disabled={busy}
                rows={1}
                className="max-h-64 flex-1 resize-none overflow-y-auto rounded-lg border border-(--color-line) bg-(--color-surface) px-4 py-3 text-[14px] leading-relaxed outline-none transition-colors placeholder:text-(--color-faint) focus:border-(--color-clay-line)"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-lg border border-(--color-clay-line) bg-(--color-clay-wash) px-4 py-3 text-[13px] font-medium text-(--color-clay) disabled:opacity-30"
              >
                Svar
              </button>
            </form>
          </div>
        )}
      </div>

      {hasRightPanel && (
        <aside className="h-fit space-y-6 border-l border-(--color-line) pl-5">
          {activeImage && (
            <div>
              <div className="eyebrow mb-3">Billede</div>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="block w-full cursor-zoom-in overflow-hidden rounded-lg border border-(--color-line-soft)"
                aria-label="Forstør billede"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeImage.data} alt={activeImage.label} className="w-full" />
              </button>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[12px] text-(--color-muted)">{activeImage.label}</span>
                {shownImages.length > 1 && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => setActiveImageIndex((i) => (i - 1 + shownImages.length) % shownImages.length)}
                      className="text-[13px] text-(--color-faint) hover:text-(--color-clay)"
                      aria-label="Forrige billede"
                    >
                      ←
                    </button>
                    <span className="text-[11px] text-(--color-faint)">
                      {activeImageIndex + 1} / {shownImages.length}
                    </span>
                    <button
                      onClick={() => setActiveImageIndex((i) => (i + 1) % shownImages.length)}
                      className="text-[13px] text-(--color-faint) hover:text-(--color-clay)"
                      aria-label="Næste billede"
                    >
                      →
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {preview && notes.length > 0 && (
            <div>
              <div className="eyebrow mb-3">Agentens noter</div>
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
            </div>
          )}
        </aside>
      )}

      {lightboxOpen && activeImage && (
        <div
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-8"
          onClick={() => setLightboxOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeImage.data}
            alt={activeImage.label}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </div>
  );
}

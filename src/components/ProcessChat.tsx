"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearProcessChat,
  sendProcessChat,
  startProcessInterview,
  stopProcessInterview,
} from "@/app/(customer)/processes/[processId]/[subId]/actions";
import { InlineDelete } from "./InlineDelete";

type ChatMessage = { id: string; role: string; content: string; userName: string | null };

// Browserens egen talegenkendelse (Web Speech API) — findes i Chrome og Edge,
// ikke i Firefox. TypeScript har ingen typer til den, så kun det vi bruger.
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
};
type RecognitionCtor = new () => Recognition;

function speechRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SUGGESTIONS_EMPTY = [
  "Forløbet starter når en ny ordre kommer ind pr. mail. Salgsassistenten opretter ordren i ERP og …",
  "Tilføj svimlanerne Salg, Lager og Økonomi",
];
const SUGGESTIONS = [
  "Tilføj en beslutning efter første skridt: er ordren komplet?",
  "Flyt det sidste skridt over til en anden rolle",
  "Hvilke skridt er manuelle?",
];

/*
  Chatten med proces-agenten som kolonne i højre side af arbejdsfladen:
  samtalen fylder højden, skrivefeltet står nederst. Man beskriver med
  almindelige ord hvad der skal ændres ("tilføj en godkendelse hos partneren
  før opslaget sendes"), og agenten retter diagrammet. Kolonnen kan klappes
  sammen til en smal fane, når diagrammet skal have hele bredden.

  "Interview" lader agenten interviewe den, der kender processen — samme
  interview som procesdiagram-skillen (lib/interview-guide.ts): ét stort
  åbningsspørgsmål, opfølgning, validering og en overlevering, som agenten
  tegner diagrammet ud fra, når den er bekræftet.
*/
export function ProcessChat({
  processId,
  subProcessId,
  messages,
  hasSteps,
  interviewActive,
}: {
  processId: string;
  subProcessId: string;
  messages: ChatMessage[];
  hasSteps: boolean;
  interviewActive: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [clearing, startClear] = useTransition();
  const [interviewPending, startInterviewTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const [canListen, setCanListen] = useState(false);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);

  // Husk om kolonnen er klappet sammen — en ren bekvemmelighed pr. browser.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("process-chat-collapsed") === "1");
    } catch {}
    setCanListen(speechRecognition() !== null);
    return () => recognitionRef.current?.stop();
  }, []);

  /*
    Tal i stedet for at skrive: det man siger skrives ind i feltet løbende
    (efter det der allerede står der), så man kan læse det igennem og rette
    før man sender. Send-knappen stopper selv optagelsen.
  */
  function startListening() {
    const Ctor = speechRecognition();
    if (!Ctor || listening) return;
    const recognition = new Ctor();
    recognition.lang = "da-DK";
    recognition.continuous = true;
    recognition.interimResults = true;
    const before = text.trim() ? text.trim() + " " : "";
    recognition.onresult = (e) => {
      // Efter stop/send kan der stadig komme et sidste resultat — det må ikke
      // fylde feltet igen, når beskeden allerede er sendt.
      if (recognitionRef.current !== recognition) return;
      let spoken = "";
      for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript;
      setText(before + spoken.trim());
    };
    recognition.onerror = (e) => {
      setMicError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "Browseren har ikke adgang til mikrofonen."
          : e.error === "no-speech"
            ? "Hørte ingen tale — prøv igen."
            : "Talegenkendelsen fejlede.",
      );
    };
    recognition.onend = () => {
      setListening(false);
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setMicError(null);
    setListening(true);
    recognition.start();
  }
  function stopListening() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.stop();
  }
  function toggle(next: boolean) {
    setCollapsed(next);
    try {
      localStorage.setItem("process-chat-collapsed", next ? "1" : "0");
    } catch {}
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, pendingText, collapsed]);

  function send(value = text) {
    const message = value.trim();
    if (!message || pending) return;
    stopListening();
    setText("");
    setPendingText(message);
    startTransition(async () => {
      await sendProcessChat(processId, subProcessId, message);
      router.refresh();
      setPendingText(null);
    });
  }

  function startInterview() {
    startInterviewTransition(async () => {
      await startProcessInterview(processId, subProcessId);
      router.refresh();
    });
  }
  function stopInterview() {
    startInterviewTransition(async () => {
      await stopProcessInterview(processId, subProcessId);
      router.refresh();
    });
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => toggle(false)}
        title="Vis chatten"
        className="flex w-10 shrink-0 flex-col items-center gap-2 border-l border-(--color-line) bg-(--color-surface) pt-4 text-(--color-muted) transition-colors hover:text-(--color-clay)"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
          <path d="M4 5.5h16v11H9.5L5 20v-3.5H4z" />
        </svg>
        <span className="text-[11.5px] font-medium [writing-mode:vertical-rl]">Proces-agent</span>
        {pending && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-(--color-clay)" />}
      </button>
    );
  }

  const suggestions = hasSteps ? SUGGESTIONS : SUGGESTIONS_EMPTY;

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-l border-(--color-line) bg-(--color-surface)">
      <div className="flex shrink-0 items-center gap-2 border-b border-(--color-line) px-4 py-2.5">
        <h2 className="text-[14px] font-semibold tracking-tight">Proces-agent</h2>
        {!interviewActive && (
          <button
            type="button"
            onClick={startInterview}
            disabled={pending || interviewPending}
            title="Lad agenten interviewe den, der kender processen, og tegne diagrammet bagefter"
            className="rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-2 py-1 text-[11.5px] font-medium text-(--color-clay) transition-colors hover:bg-(--color-clay-line) disabled:opacity-40"
          >
            Interview
          </button>
        )}
        <span className="ml-auto flex items-center gap-3 text-[11px] text-(--color-faint)">
          {messages.length > 0 && (
            <InlineDelete
              label="Ryd"
              title="Ryd samtalen"
              pending={clearing}
              onConfirm={() =>
                startClear(async () => {
                  await clearProcessChat(processId, subProcessId);
                  router.refresh();
                })
              }
            />
          )}
          <button
            type="button"
            onClick={() => toggle(true)}
            title="Skjul chatten"
            className="text-[15px] leading-none hover:text-(--color-text)"
          >
            »
          </button>
        </span>
      </div>

      {interviewActive && (
        <div className="flex shrink-0 items-center gap-2 border-b border-(--color-line) bg-(--color-clay-wash) px-4 py-2 text-[11.5px] text-(--color-text)">
          <span className="h-1.5 w-1.5 rounded-full bg-(--color-clay)" />
          <span className="leading-snug">
            Interview i gang — agenten tegner diagrammet, når forløbet er gennemgået og bekræftet.
          </span>
          <button
            type="button"
            onClick={stopInterview}
            disabled={interviewPending}
            className="ml-auto shrink-0 text-(--color-muted) underline-offset-2 hover:text-(--color-text) hover:underline disabled:opacity-40"
          >
            Afslut
          </button>
        </div>
      )}

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !pendingText ? (
          <div className="space-y-3">
            <p className="text-[12.5px] leading-relaxed text-(--color-muted)">
              Beskriv forløbet eller hvad der skal ændres, så retter agenten diagrammet. Den noterer også
              problemer, ønsker og ideer i analysen.
            </p>
            <button
              type="button"
              onClick={startInterview}
              disabled={interviewPending}
              className="w-full rounded-lg border border-(--color-clay-line) bg-(--color-clay-wash) px-3 py-2.5 text-left transition-colors hover:bg-(--color-clay-line) disabled:opacity-40"
            >
              <span className="block text-[12.5px] font-medium text-(--color-clay)">Start et interview</span>
              <span className="mt-0.5 block text-[11.5px] leading-snug text-(--color-muted)">
                Agenten stiller ét stort spørgsmål om hele processen, spørger ind til det der mangler, og
                tegner diagrammet, når I har gennemgået det.
              </span>
            </button>
            <div className="flex flex-col items-start gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setText(s)}
                  className="rounded-lg border border-(--color-line) px-2.5 py-1.5 text-left text-[12px] leading-snug text-(--color-muted) transition-colors hover:border-(--color-clay-line) hover:text-(--color-text)"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} content={m.content} name={m.userName} />
            ))}
            {pendingText && (
              <>
                <Bubble role="user" content={pendingText} name={null} />
                <div className="flex items-center gap-2 text-[12px] text-(--color-faint)">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-(--color-clay)" />
                  {interviewActive ? "Agenten læser svaret…" : "Agenten retter diagrammet…"}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-(--color-line) p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="rounded-lg border border-(--color-line) bg-(--color-surface) p-1.5 shadow-[0_1px_2px_rgba(20,16,12,0.03)] focus-within:border-(--color-clay-line)"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={3}
            disabled={pending}
            placeholder={
              interviewActive
                ? "Svar med dine egne ord — gerne med mikrofonen…"
                : hasSteps
                ? "Skriv hvad der skal ændres i diagrammet…"
                : "Beskriv forløbet — hvem gør hvad, i hvilke systemer, og hvornår…"
            }
            className="block max-h-48 w-full resize-none bg-transparent px-2 py-1.5 text-[13px] leading-snug outline-none placeholder:text-(--color-faint) disabled:opacity-50"
          />
          <div className="flex items-center gap-1.5 pl-2">
            <span className={`mr-auto text-[10.5px] ${micError ? "text-(--color-alert)" : "text-(--color-faint)"}`}>
              {micError ?? (listening ? "Lytter… tryk igen for at stoppe" : "Enter sender · Shift+Enter ny linje")}
            </span>
            {canListen && (
              <button
                type="button"
                onClick={listening ? stopListening : startListening}
                disabled={pending}
                title={listening ? "Stop optagelsen" : "Tal i stedet for at skrive"}
                aria-pressed={listening}
                className={`flex h-[30px] w-[30px] items-center justify-center rounded-md border transition-colors disabled:opacity-40 ${
                  listening
                    ? "animate-pulse border-(--color-clay-line) bg-(--color-clay-wash) text-(--color-clay)"
                    : "border-(--color-line) text-(--color-muted) hover:border-(--color-clay-line) hover:text-(--color-clay)"
                }`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <rect x="9" y="3" width="6" height="11" rx="3" />
                  <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              disabled={pending || !text.trim()}
              className="rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-3 py-1.5 text-[12.5px] font-medium text-(--color-clay) transition-colors hover:bg-(--color-clay-line) disabled:opacity-40"
            >
              {pending ? "Arbejder…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}

function Bubble({ role, content, name }: { role: string; content: string; name: string | null }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-[12.5px] leading-relaxed ${
          mine ? "bg-(--color-clay-wash) text-(--color-text)" : "bg-(--color-raised) text-(--color-text)"
        }`}
      >
        {!mine && <div className="eyebrow mb-1">Proces-agent</div>}
        {mine && name && <div className="eyebrow mb-1">{name}</div>}
        <MessageText content={content} />
      </div>
    </div>
  );
}

/*
  Beskedens tekst som den er skrevet, bortset fra Markdown-tabeller (linjer
  der starter med "|") — dem skriver agenten i interviewets overlevering, og
  de vises som en rigtig tabel, der kan rulles vandret i den smalle kolonne.
*/
function MessageText({ content }: { content: string }) {
  const blocks: { table: boolean; lines: string[] }[] = [];
  for (const line of content.split("\n")) {
    const table = line.trim().startsWith("|");
    const last = blocks[blocks.length - 1];
    if (last && last.table === table) last.lines.push(line);
    else blocks.push({ table, lines: [line] });
  }
  return (
    <>
      {blocks.map((b, i) => {
        if (!b.table) return <span key={i}>{b.lines.join("\n")}</span>;
        const cells = (l: string) =>
          l
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((c) => c.trim());
        const rows = b.lines.filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l)).map(cells);
        const [head, ...body] = rows;
        if (!head) return null;
        return (
          <div key={i} className="my-1.5 overflow-x-auto whitespace-normal">
            <table className="border-collapse text-[11px] leading-snug">
              <thead>
                <tr>
                  {head.map((c, j) => (
                    <th key={j} className="border-b border-(--color-line) px-1.5 py-1 text-left font-semibold whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((r, k) => (
                  <tr key={k} className="align-top">
                    {r.map((c, j) => (
                      <td key={j} className="border-b border-(--color-line-soft) px-1.5 py-1 min-w-[64px]">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}

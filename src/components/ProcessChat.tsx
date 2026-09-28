"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearProcessChat, sendProcessChat } from "@/app/(customer)/processes/[processId]/[subId]/actions";
import { InlineDelete } from "./InlineDelete";

type ChatMessage = { id: string; role: string; content: string; userName: string | null };

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
*/
export function ProcessChat({
  processId,
  subProcessId,
  messages,
  hasSteps,
}: {
  processId: string;
  subProcessId: string;
  messages: ChatMessage[];
  hasSteps: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [clearing, startClear] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  // Husk om kolonnen er klappet sammen — en ren bekvemmelighed pr. browser.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("process-chat-collapsed") === "1");
    } catch {}
  }, []);
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
    setText("");
    setPendingText(message);
    startTransition(async () => {
      await sendProcessChat(processId, subProcessId, message);
      router.refresh();
      setPendingText(null);
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

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !pendingText ? (
          <div className="space-y-3">
            <p className="text-[12.5px] leading-relaxed text-(--color-muted)">
              Beskriv forløbet eller hvad der skal ændres, så retter agenten diagrammet. Den noterer også
              problemer, ønsker og ideer i analysen.
            </p>
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
                  Agenten retter diagrammet…
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
              hasSteps
                ? "Skriv hvad der skal ændres i diagrammet…"
                : "Beskriv forløbet — hvem gør hvad, i hvilke systemer, og hvornår…"
            }
            className="block max-h-48 w-full resize-none bg-transparent px-2 py-1.5 text-[13px] leading-snug outline-none placeholder:text-(--color-faint) disabled:opacity-50"
          />
          <div className="flex items-center justify-between pl-2">
            <span className="text-[10.5px] text-(--color-faint)">Enter sender · Shift+Enter ny linje</span>
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
        {content}
      </div>
    </div>
  );
}

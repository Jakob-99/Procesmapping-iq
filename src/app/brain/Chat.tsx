"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Hvad sker der, når en kunde afgiver en ordre?",
  "Hvilke systemer rører data om en faktura?",
  "Hvor bruger vi mest manuel tid?",
  "Hvilke processer er ikke valideret endnu?",
];

export function Chat({ intro }: { intro?: ReactNode }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || busy) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok || !res.body) {
        const { error } = await res.json().catch(() => ({ error: "Ukendt fejl" }));
        setMessages([...next, { role: "assistant", content: `⚠ ${error}` }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages([...next, { role: "assistant", content: acc }]);
      }
    } finally {
      setBusy(false);
    }
  }

  // Så snart samtalen er i gang, viger overblikket for den.
  const started = messages.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
        {!started ? (
          <div className="rise">
            {intro}
            <div className="mx-auto mt-10 max-w-3xl">
              <div className="eyebrow mb-3">Prøv at spørge</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-lg border border-(--color-line) px-4 py-3 text-left text-[12.5px] text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-text)"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-7">
            {messages.map((m, i) => (
              <div key={i} className="rise">
                <div className="eyebrow mb-1.5">
                  {m.role === "user" ? "Dig" : "Corner IQ"}
                </div>
                <div
                  className={`whitespace-pre-wrap text-[14px] leading-relaxed ${
                    m.role === "user"
                      ? "text-(--color-muted)"
                      : "text-(--color-text)"
                  }`}
                >
                  {m.content ||
                    (busy && (
                      <span className="pulse-soft text-(--color-faint)">
                        tænker…
                      </span>
                    ))}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="border-t border-(--color-line) px-8 py-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-3xl items-center gap-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Spørg om en proces, et system eller et dataobjekt…"
            className="flex-1 rounded-lg border border-(--color-line) px-4 py-3 text-[14px] outline-none transition-colors placeholder:text-(--color-faint) focus:border-(--color-clay)"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg bg-(--color-clay) px-5 py-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            Spørg
          </button>
        </form>
      </div>
    </div>
  );
}

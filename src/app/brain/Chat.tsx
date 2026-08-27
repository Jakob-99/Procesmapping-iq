"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Msg = { role: "user" | "assistant"; content: string };
type Attachable = { id: string; name: string };

const SUGGESTIONS = [
  "Hvad sker der, når en kunde afgiver en ordre?",
  "Hvilke systemer rører data om en faktura?",
  "Hvor bruger vi mest manuel tid?",
  "Hvilke processer er ikke valideret endnu?",
];

// Systemlandskabets AI-parathedsrapport er beregnet, ikke en gemt
// AiosProposal — men skal kunne vedhæftes på lige fod med de rigtige
// rapporter. Id'et skal matche SYSTEM_READINESS_ID i api/brain/route.ts.
const SYSTEM_READINESS: Attachable = {
  id: "__system_readiness__",
  name: "AI-parathed (systemlandskab)",
};

export function Chat({ intro, attachables = [] }: { intro?: ReactNode; attachables?: Attachable[] }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [attached, setAttached] = useState<Attachable[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const options = [SYSTEM_READINESS, ...attachables];

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPickerOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  function toggleAttach(a: Attachable) {
    setAttached((cur) => (cur.some((x) => x.id === a.id) ? cur.filter((x) => x.id !== a.id) : [...cur, a]));
  }

  async function send(text: string) {
    if (!text.trim() || busy) return;

    // Markeringen står i selve beskeden, så vedhæftningen forbliver synlig i
    // samtalehistorikken bagefter — agenten kan altid se hvad der blev
    // vedhæftet hvornår, selv i senere ture, og hente den igen med
    // hent_rapport hvis det bliver relevant igen.
    const attachedNote = attached.length
      ? `[Vedhæftet: ${attached.map((a) => `"${a.name}"`).join(", ")}]\n`
      : "";

    const next: Msg[] = [...messages, { role: "user", content: attachedNote + text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    const attachmentIds = attached.map((a) => a.id);
    setAttached([]);
    setBusy(true);

    try {
      const res = await fetch("/api/brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, attachmentIds }),
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

  const inputBar = (
    <div className="mx-auto max-w-3xl">
      {!started && (
        <p className="mb-3 text-[14px] text-(--color-text)">
          Hej, hvordan kan jeg hjælpe?
        </p>
      )}

      {attached.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {attached.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-(--color-clay-line) bg-(--color-clay-wash) py-1 pl-2.5 pr-1.5 text-[11.5px] font-medium text-(--color-clay)"
            >
              {a.name}
              <button
                onClick={() => toggleAttach(a)}
                aria-label={`Fjern ${a.name}`}
                className="rounded-full p-0.5 hover:bg-(--color-clay-line)"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-3"
      >
        <div className="relative shrink-0" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            title="Vedhæft en rapport"
            aria-label="Vedhæft en rapport"
            className={`flex h-11 w-11 items-center justify-center rounded-lg border text-lg transition-colors ${
              pickerOpen
                ? "border-(--color-clay-line) bg-(--color-clay-wash) text-(--color-clay)"
                : "border-(--color-line) text-(--color-muted) hover:border-(--color-clay-line) hover:text-(--color-clay)"
            }`}
          >
            +
          </button>

          {pickerOpen && (
            <div className="absolute bottom-full left-0 z-20 mb-2 w-72 rounded-lg border border-(--color-line-soft) bg-(--color-surface) p-2 shadow-lg">
              <div className="mb-1.5 px-1.5 text-[11px] font-medium text-(--color-faint)">
                Vedhæft en rapport
              </div>
              <div className="max-h-64 overflow-y-auto">
                {options.map((a) => {
                  const isAttached = attached.some((x) => x.id === a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => toggleAttach(a)}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors ${
                        isAttached ? "bg-(--color-clay-wash) text-(--color-clay)" : "hover:bg-(--color-sunken)"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    </button>
                  );
                })}
                {attachables.length === 0 && (
                  <div className="px-2 py-2 text-[11.5px] text-(--color-faint)">
                    Ingen forbedringsrapporter endnu.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

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
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-7">
        {!started ? (
          <div className="rise">
            {intro}

            <div className="mt-10">{inputBar}</div>

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

      {started && <div className="px-8 py-5">{inputBar}</div>}
    </div>
  );
}

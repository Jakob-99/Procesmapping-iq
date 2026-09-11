"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAgent, updateAgent, deleteAgent, duplicateAgent } from "@/app/(customer)/agents/actions";
import { ClayButton, OutlineButton } from "./ui";
import { LevelScale } from "./LevelScale";

type Agent = {
  id: string;
  name: string;
  purpose: string;
  prequalification: string | null;
  investigate: string | null;
  followUpLevel: number;
  formalityLevel: number;
  questionLengthLevel: number;
};

type AgentImageRef = { label: string };

/*
  Delt mellem /agents/new (opret) og /agents/[id] (rediger) — agenten skal
  have en hel side for sig selv: venstre spalte (fylder mest) er selve
  prompten i tre stykker, højre spalte er de faste indstillinger (navn +
  tre 1-5 stil-skalaer).
*/
export function AgentEditor({
  agent,
  images,
  extraSections,
}: {
  agent?: Agent;
  images?: AgentImageRef[];
  extraSections?: React.ReactNode;
}) {
  const isNew = !agent;
  const [name, setName] = useState(agent?.name ?? "");
  const [purpose, setPurpose] = useState(agent?.purpose ?? "");
  const [prequalification, setPrequalification] = useState(agent?.prequalification ?? "");
  const [investigate, setInvestigate] = useState(agent?.investigate ?? "");
  const [followUpLevel, setFollowUpLevel] = useState(agent?.followUpLevel ?? 3);
  const [formalityLevel, setFormalityLevel] = useState(agent?.formalityLevel ?? 3);
  const [questionLengthLevel, setQuestionLengthLevel] = useState(agent?.questionLengthLevel ?? 3);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const router = useRouter();

  // "/" i "Hvad skal agenten undersøge" åbner en lille billedvælger, så man
  // ikke skal huske/stave et billedes label rigtigt for at referere det.
  const investigateRef = useRef<HTMLTextAreaElement>(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashStart, setSlashStart] = useState(0);
  const availableImages = images ?? [];
  const slashMatches = availableImages.filter((img) =>
    img.label.toLowerCase().includes(slashQuery.toLowerCase()),
  );

  function handleInvestigateChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInvestigate(val);
    const pos = e.target.selectionStart ?? val.length;
    const before = val.slice(0, pos);
    const idx = before.lastIndexOf("/");
    if (idx !== -1 && !/\s/.test(before.slice(idx + 1))) {
      setSlashStart(idx);
      setSlashQuery(before.slice(idx + 1));
      setSlashOpen(availableImages.length > 0);
    } else {
      setSlashOpen(false);
    }
  }

  function insertImageRef(label: string) {
    const el = investigateRef.current;
    const pos = el?.selectionStart ?? investigate.length;
    const next = `${investigate.slice(0, slashStart)}[${label}] ${investigate.slice(pos)}`;
    setInvestigate(next);
    setSlashOpen(false);
    requestAnimationFrame(() => {
      const caret = slashStart + label.length + 3;
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  }

  const valid = name.trim() && purpose.trim();

  function save() {
    if (!valid) return;
    const input = { name, purpose, prequalification, investigate, followUpLevel, formalityLevel, questionLengthLevel };
    startTransition(async () => {
      if (isNew) {
        const created = await createAgent(input);
        if (created) router.push(`/agents/${created.id}`);
      } else {
        await updateAgent(agent.id, input);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  function remove() {
    if (!agent) return;
    startTransition(async () => {
      await deleteAgent(agent.id);
      router.push("/agents");
    });
  }

  function duplicate() {
    if (!agent) return;
    startTransition(async () => {
      const copy = await duplicateAgent(agent.id);
      if (copy) router.push(`/agents/${copy.id}`);
    });
  }

  const sectionHeading = "mb-2 text-[13px] font-semibold tracking-tight text-(--color-text)";
  const textareaClass =
    "w-full rounded-lg border border-(--color-line) bg-(--color-surface) px-3.5 py-3 text-[14px] leading-relaxed outline-none focus:border-(--color-clay)";

  return (
    <div>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-(--color-line) bg-(--color-surface) px-8 py-4">
        <div className="min-w-0">
          <div className="eyebrow">{isNew ? "Ny interview agent" : "Interview agent"}</div>
          <h1 className="truncate text-[18px] font-semibold tracking-tight">{isNew ? "Opret agent" : agent!.name}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {saved && <span className="text-[12.5px] text-(--color-ok)">Gemt</span>}
          {!isNew && (
            <OutlineButton onClick={() => router.push(`/agents/${agent!.id}/preview`)}>
              Prøv agenten selv
            </OutlineButton>
          )}
          {!isNew && (
            <OutlineButton onClick={duplicate} disabled={pending}>
              Dupliker
            </OutlineButton>
          )}
          <ClayButton onClick={save} disabled={pending || !valid}>
            {pending ? "Gemmer…" : isNew ? "Opret agent" : "Gem"}
          </ClayButton>
          {!isNew && (
            confirmingDelete ? (
              <>
                <span className="text-[12px] text-(--color-alert)">Sikker?</span>
                <button
                  onClick={remove}
                  className="text-[12px] font-medium text-(--color-alert) hover:opacity-70"
                >
                  Ja, slet
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-[12px] text-(--color-faint) hover:text-(--color-text)"
                >
                  Annullér
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-[12px] text-(--color-faint) hover:text-(--color-alert)"
              >
                Slet agent
              </button>
            )
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
        <div className="space-y-7 border-b border-(--color-line) p-8 lg:border-b-0 lg:border-r">
          <div>
            <div className={sectionHeading}>Hvad er agentens formål</div>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={4}
              placeholder="Hvad skal interviewet afdække?"
              className={textareaClass}
            />
          </div>
          <div>
            <div className={sectionHeading}>Hvad skal afklares, før interviewet går i gang</div>
            <textarea
              value={prequalification}
              onChange={(e) => setPrequalification(e.target.value)}
              rows={3}
              placeholder='Fx rolle, afdeling eller tidsperiode agenten bør have styr på inden de rigtige spørgsmål starter (valgfrit). Ikke en spærring — respondenten skal ikke afvises, kun sættes rigtigt i kontekst.'
              className={textareaClass}
            />
          </div>
          <div className="relative">
            <div className={sectionHeading}>Hvad skal agenten undersøge</div>
            <textarea
              ref={investigateRef}
              value={investigate}
              onChange={handleInvestigateChange}
              onBlur={() => setTimeout(() => setSlashOpen(false), 150)}
              rows={6}
              placeholder='Konkrete emner, spørgsmål eller ting agenten skal bore i (valgfrit). Skriv "/" for at indsætte et billede.'
              className={textareaClass}
            />
            {slashOpen && (
              <div className="absolute z-10 mt-1 w-64 overflow-hidden rounded-lg border border-(--color-line) bg-(--color-surface) shadow-[0_4px_16px_-4px_rgba(20,16,12,0.18)]">
                {slashMatches.length === 0 ? (
                  <div className="px-3 py-2 text-[12.5px] text-(--color-faint)">Ingen billeder matcher.</div>
                ) : (
                  slashMatches.map((img) => (
                    <button
                      key={img.label}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertImageRef(img.label);
                      }}
                      className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[12.5px] hover:bg-(--color-raised)"
                    >
                      <span className="text-(--color-faint)">🖼</span> {img.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6 p-6">
          <div className={sectionHeading}>Agent indstillinger</div>
          <div>
            <div className="eyebrow mb-1.5">Navn</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Fx "Onboarding-feedback"'
              className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-3 py-2 text-[14px] outline-none focus:border-(--color-clay)"
            />
          </div>
          <LevelScale
            label="Hvor opfølgende?"
            value={followUpLevel}
            onChange={setFollowUpLevel}
            lowLabel="Lidt"
            highLabel="Meget"
          />
          <LevelScale
            label="Hvor formelt?"
            value={formalityLevel}
            onChange={setFormalityLevel}
            lowLabel="Uformel"
            highLabel="Formel"
          />
          <LevelScale
            label="Hvor lange spørgsmål?"
            value={questionLengthLevel}
            onChange={setQuestionLengthLevel}
            lowLabel="Korte"
            highLabel="Lange"
          />
        </aside>
      </div>

      {extraSections && <div className="space-y-6 border-t border-(--color-line) p-8">{extraSections}</div>}
    </div>
  );
}

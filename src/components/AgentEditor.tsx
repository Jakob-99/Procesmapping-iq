"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAgent, updateAgent, deleteAgent } from "@/app/(customer)/agents/actions";
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

/*
  Delt mellem /agents/new (opret) og /agents/[id] (rediger) — agenten skal
  have en hel side for sig selv: venstre spalte (fylder mest) er selve
  prompten i tre stykker, højre spalte er de faste indstillinger (navn +
  tre 1-5 stil-skalaer).
*/
export function AgentEditor({ agent, extraSections }: { agent?: Agent; extraSections?: React.ReactNode }) {
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
  const router = useRouter();

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
    if (!confirm(`Slet interview agenten "${agent.name}"? Alle tilknyttede interviews slettes med.`)) return;
    startTransition(async () => {
      await deleteAgent(agent.id);
      router.push("/agents");
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
          <ClayButton onClick={save} disabled={pending || !valid}>
            {pending ? "Gemmer…" : isNew ? "Opret agent" : "Gem"}
          </ClayButton>
          {!isNew && (
            <button
              onClick={remove}
              className="text-[12px] text-(--color-faint) hover:text-(--color-alert)"
            >
              Slet agent
            </button>
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
            <div className={sectionHeading}>Hvad er prækvalificering</div>
            <textarea
              value={prequalification}
              onChange={(e) => setPrequalification(e.target.value)}
              rows={3}
              placeholder="Hvem/hvad skal være opfyldt for at respondenten er relevant (valgfrit)?"
              className={textareaClass}
            />
          </div>
          <div>
            <div className={sectionHeading}>Hvad skal agenten undersøge</div>
            <textarea
              value={investigate}
              onChange={(e) => setInvestigate(e.target.value)}
              rows={6}
              placeholder="Konkrete emner, spørgsmål eller ting agenten skal bore i (valgfrit)."
              className={textareaClass}
            />
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

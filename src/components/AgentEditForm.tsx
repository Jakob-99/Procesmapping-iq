"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAgent, deleteAgent } from "@/app/(customer)/agents/actions";
import { ClayButton, OutlineButton } from "./ui";

export function AgentEditForm({
  id,
  name,
  goal,
  instructions,
}: {
  id: string;
  name: string;
  goal: string;
  instructions: string | null;
}) {
  const [nameVal, setNameVal] = useState(name);
  const [goalVal, setGoalVal] = useState(goal);
  const [instructionsVal, setInstructionsVal] = useState(instructions ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  function save() {
    if (!nameVal.trim() || !goalVal.trim()) return;
    startTransition(async () => {
      await updateAgent(id, nameVal, goalVal, instructionsVal);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function remove() {
    if (!confirm(`Slet interview agenten "${name}"? Alle tilknyttede interviews slettes med.`)) return;
    startTransition(async () => {
      await deleteAgent(id);
      router.push("/agents");
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <div className="eyebrow mb-1.5">Navn</div>
        <input
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-3 py-2 text-[14px] outline-none focus:border-(--color-clay)"
        />
      </div>
      <div>
        <div className="eyebrow mb-1.5">Formål</div>
        <textarea
          value={goalVal}
          onChange={(e) => setGoalVal(e.target.value)}
          rows={3}
          placeholder="Hvad skal interviewet afdække?"
          className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-3 py-2 text-[14px] outline-none focus:border-(--color-clay)"
        />
      </div>
      <div>
        <div className="eyebrow mb-1.5">Yderligere instruktioner (valgfrit)</div>
        <textarea
          value={instructionsVal}
          onChange={(e) => setInstructionsVal(e.target.value)}
          rows={4}
          placeholder="Tone, ting agenten skal spørge ekstra ind til, osv."
          className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-3 py-2 text-[14px] outline-none focus:border-(--color-clay)"
        />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <ClayButton onClick={save} disabled={pending || !nameVal.trim() || !goalVal.trim()}>
          {pending ? "Gemmer…" : "Gem"}
        </ClayButton>
        <OutlineButton onClick={() => router.push(`/agents/${id}/preview`)}>
          Prøv agenten selv
        </OutlineButton>
        {saved && <span className="text-[12.5px] text-(--color-ok)">Gemt</span>}
        <button
          onClick={remove}
          className="ml-auto text-[12px] text-(--color-faint) hover:text-(--color-alert)"
        >
          Slet agent
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAgent } from "@/app/(customer)/agents/actions";
import { ClayButton } from "./ui";

export function AgentCreator() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const router = useRouter();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-1.5 rounded-full border border-dashed border-(--color-line) px-3.5 py-1.5 text-[12px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay) hover:text-(--color-clay)"
      >
        + Ny interview agent
      </button>
    );
  }

  function submit() {
    if (!name.trim() || !goal.trim()) return;
    startTransition(async () => {
      const agent = await createAgent(name, goal);
      setName("");
      setGoal("");
      setOpen(false);
      if (agent) router.push(`/agents/${agent.id}`);
    });
  }

  return (
    <div className="mb-4 space-y-1.5 rounded-xl border border-(--color-line-soft) bg-(--color-raised) p-3.5">
      <div className="eyebrow mb-1">Ny interview agent</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder='Navn, fx "Onboarding-feedback"'
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder="Hvad skal interviewet afdække?"
        rows={3}
        className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <div className="flex gap-2 pt-0.5">
        <ClayButton onClick={submit} disabled={pending || !name.trim() || !goal.trim()} className="!py-1.5 !text-[12.5px]">
          Opret
        </ClayButton>
        <button
          onClick={() => setOpen(false)}
          className="text-[12px] text-(--color-faint) hover:text-(--color-text)"
        >
          Annullér
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendInterview } from "@/app/(customer)/interviews/actions";
import { ClayButton } from "./ui";

type Agent = { id: string; name: string };
type Respondent = { id: string; name: string; email: string };
type Round = { id: string; name: string };
type SendResult = { sentCount: number; mailedCount: number };

export function SendInterviewForm({
  agents,
  respondents,
  rounds,
  lockedRoundId,
}: {
  agents: Agent[];
  respondents: Respondent[];
  rounds: Round[];
  // Sat når formularen vises inde på selve rundens side — runden er så givet
  // af konteksten, og rundevælgeren skal ikke vises.
  lockedRoundId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [roundId, setRoundId] = useState(lockedRoundId ?? rounds[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<SendResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function submit() {
    if (!agentId || !roundId || selected.size === 0) return;
    startTransition(async () => {
      const res = await sendInterview(agentId, Array.from(selected), roundId);
      setResult(res);
      setTimeout(() => setResult(null), 8000);
      setSelected(new Set());
      setOpen(false);
      router.refresh();
    });
  }

  const resultBanner = result && (
    <p className="mb-3 text-[12.5px] leading-relaxed text-(--color-ok)">
      {result.sentCount} interview{result.sentCount === 1 ? "" : "s"} sendt.{" "}
      {result.mailedCount > 0
        ? `${result.mailedCount} af ${result.sentCount} respondenter fik en mail med login-link.`
        : "Ingen mail sendt endnu (mailudsendelse er ikke sat op) — respondenten skal selv gå ind på /respond/login med sin mail."}
    </p>
  );

  if (!open) {
    return (
      <div>
        {resultBanner}
        <ClayButton onClick={() => setOpen(true)} className="mb-5" disabled={rounds.length === 0}>
          + Send interview
        </ClayButton>
      </div>
    );
  }

  if (rounds.length === 0) {
    return (
      <p className="mb-5 text-[13px] text-(--color-faint)">
        Opret en interview runde ovenfor først — den samler de interviews du
        sender ud.
      </p>
    );
  }

  return (
    <div>
      {resultBanner}
      <div className="mb-5 space-y-3 rounded-xl border border-(--color-line-soft) bg-(--color-raised) p-4">
        {!lockedRoundId && (
          <div>
            <div className="eyebrow mb-1.5">Interview runde</div>
            <select
              value={roundId}
              onChange={(e) => setRoundId(e.target.value)}
              className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[13px] outline-none focus:border-(--color-clay)"
            >
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="eyebrow mb-1.5">Interview agent</div>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[13px] outline-none focus:border-(--color-clay)"
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="eyebrow mb-1.5">Respondenter</div>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-(--color-line) bg-(--color-surface) p-2">
            {respondents.map((r) => (
              <label key={r.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-(--color-raised)">
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                {r.name} <span className="text-(--color-faint)">({r.email})</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-0.5">
          <ClayButton
            onClick={submit}
            disabled={pending || !agentId || !roundId || selected.size === 0}
            className="!py-1.5 !text-[12.5px]"
          >
            {pending ? "Sender…" : `Send til ${selected.size || ""} respondent${selected.size === 1 ? "" : "er"}`}
          </ClayButton>
          <button onClick={() => setOpen(false)} className="text-[12px] text-(--color-faint) hover:text-(--color-text)">
            Annullér
          </button>
        </div>
      </div>
    </div>
  );
}

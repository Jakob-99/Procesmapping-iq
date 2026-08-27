"use client";

import { useState, useTransition } from "react";
import { submitValidation } from "@/app/(customer)/processes/[processId]/[subId]/actions";
import { Badge } from "./ui";

type Validation = {
  id: string;
  verdict: string;
  comment: string | null;
  validatorId: string;
  createdAt: string;
};

export function ValidationPanel({
  processId,
  subProcessId,
  validations,
  users,
}: {
  processId: string;
  subProcessId: string;
  validations: Validation[];
  users: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [validatorId, setValidatorId] = useState(users[0]?.id ?? "");
  const [comment, setComment] = useState("");

  const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "Ukendt";

  function submit(verdict: "APPROVED" | "CHANGES_REQUESTED") {
    if (!validatorId) return;
    startTransition(async () => {
      await submitValidation(processId, subProcessId, validatorId, verdict, comment);
      setComment("");
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg bg-(--color-raised) p-3">
        <div className="eyebrow mb-1">Afgiv validering</div>
        <select
          value={validatorId}
          onChange={(e) => setValidatorId(e.target.value)}
          disabled={pending || users.length === 0}
          className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
        >
          {users.length === 0 && <option value="">Ingen brugere</option>}
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Kommentar (valgfri)…"
          disabled={pending}
          rows={2}
          className="w-full resize-none rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none placeholder:text-(--color-faint) focus:border-(--color-clay)"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending || !validatorId}
            onClick={() => submit("APPROVED")}
            className="flex-1 rounded-md border border-(--color-ok) bg-[#4f7c520d] px-2.5 py-1.5 text-[12px] font-medium text-(--color-ok) transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            Godkend
          </button>
          <button
            type="button"
            disabled={pending || !validatorId}
            onClick={() => submit("CHANGES_REQUESTED")}
            className="flex-1 rounded-md border border-(--color-warn) bg-[#b8801f0d] px-2.5 py-1.5 text-[12px] font-medium text-(--color-warn) transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            Bed om rettelser
          </button>
        </div>
      </div>

      <div>
        <div className="eyebrow mb-2">Historik</div>
        {validations.length === 0 ? (
          <p className="text-[12.5px] text-(--color-faint)">Ikke valideret endnu.</p>
        ) : (
          <div className="space-y-3">
            {[...validations]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((v) => (
                <div key={v.id} className="border-b border-(--color-line-soft) pb-3 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={v.verdict === "APPROVED" ? "ok" : "warn"}>
                      {v.verdict === "APPROVED" ? "Godkendt" : "Rettelser ønsket"}
                    </Badge>
                    <span className="text-[11px] text-(--color-faint)">{nameOf(v.validatorId)}</span>
                  </div>
                  {v.comment && (
                    <p className="mt-2 text-[12.5px] leading-relaxed text-(--color-muted)">
                      {v.comment}
                    </p>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

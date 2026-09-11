"use client";

import { useState, useTransition } from "react";
import { grantAccess, revokeAccess } from "@/app/admin/actions";
import { ClayButton, OutlineButton } from "./ui";

type Consultant = { id: string; name: string; email: string };

export function AccessManager({
  engagementId,
  currentId,
  withAccess,
  withoutAccess,
}: {
  engagementId: string;
  currentId: string;
  withAccess: Consultant[];
  withoutAccess: Consultant[];
}) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState(withoutAccess[0]?.id ?? "");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="eyebrow">Konsulent-adgang</div>
        {!adding && withoutAccess.length > 0 && (
          <OutlineButton onClick={() => setAdding(true)}>+ Giv adgang</OutlineButton>
        )}
      </div>

      <div className="divide-y divide-(--color-line-soft) rounded-lg border border-(--color-line-soft)">
        {withAccess.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">
                {c.name} {c.id === currentId && <span className="text-(--color-faint)">(dig)</span>}
              </div>
              <div className="truncate text-[11px] text-(--color-faint)">{c.email}</div>
            </div>
            {confirmingId === c.id ? (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[11.5px] text-(--color-alert)">
                  {c.id === currentId ? "Fjerner din egen adgang?" : "Sikker?"}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setConfirmingId(null);
                    startTransition(() => revokeAccess(engagementId, c.id));
                  }}
                  className="rounded-md px-2 py-1.5 text-[12px] font-medium text-(--color-alert) transition-opacity hover:opacity-70 disabled:opacity-40"
                >
                  Ja, fjern
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingId(null)}
                  className="rounded-md px-2 py-1.5 text-[12px] text-(--color-muted) transition-opacity hover:opacity-70"
                >
                  Annuller
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmingId(c.id)}
                className="shrink-0 rounded-md px-2 py-1.5 text-[12px] text-(--color-alert) transition-opacity hover:opacity-70 disabled:opacity-40"
              >
                Fjern
              </button>
            )}
          </div>
        ))}

        {adding && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
            >
              {withoutAccess.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
            <ClayButton
              disabled={pending || !selected}
              onClick={() =>
                startTransition(async () => {
                  await grantAccess(engagementId, selected);
                  setAdding(false);
                })
              }
              className="!py-1.5 !text-[12.5px]"
            >
              Giv adgang
            </ClayButton>
            <OutlineButton onClick={() => setAdding(false)}>Annuller</OutlineButton>
          </div>
        )}
      </div>
    </section>
  );
}

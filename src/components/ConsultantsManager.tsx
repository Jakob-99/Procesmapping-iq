"use client";

import { useState, useTransition } from "react";
import { inviteConsultant, removeConsultant } from "@/app/admin/consultants/actions";
import { ClayButton, OutlineButton } from "./ui";

type Consultant = { id: string; name: string; email: string; role: string; createdAt: string };

export function ConsultantsManager({
  consultants,
  currentId,
}: {
  consultants: Consultant[];
  currentId: string;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="eyebrow">Konsulenter</div>
        {!adding && (
          <OutlineButton onClick={() => setAdding(true)}>+ Tilføj konsulent</OutlineButton>
        )}
      </div>

      <div className="divide-y divide-(--color-line-soft) rounded-lg border border-(--color-line-soft)">
        {consultants.length === 0 && !adding && (
          <p className="px-3 py-4 text-[12.5px] text-(--color-faint)">Ingen konsulenter endnu.</p>
        )}
        {consultants.map((c) => (
          <ConsultantRow key={c.id} consultant={c} isSelf={c.id === currentId} />
        ))}
        {adding && <AddConsultantRow onDone={() => setAdding(false)} />}
      </div>
    </section>
  );
}

function ConsultantRow({ consultant, isSelf }: { consultant: Consultant; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium">
          {consultant.name} {isSelf && <span className="text-(--color-faint)">(dig)</span>}
        </div>
        <div className="truncate text-[11px] text-(--color-faint)">{consultant.email}</div>
      </div>
      {!isSelf && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Fjern ${consultant.name} som konsulent? Al deres kundeadgang forsvinder.`)) {
              startTransition(() => removeConsultant(consultant.id));
            }
          }}
          className="shrink-0 rounded-md px-2 py-1.5 text-[12px] text-(--color-alert) transition-opacity hover:opacity-70 disabled:opacity-40"
        >
          Fjern
        </button>
      )}
    </div>
  );
}

function AddConsultantRow({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim() || !email.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await inviteConsultant(name, email);
      if (res?.error) {
        setError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Navn"
        className="min-w-0 flex-1 rounded-md border border-(--color-line) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Mail"
        type="email"
        className="min-w-0 flex-1 rounded-md border border-(--color-line) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      />
      <ClayButton
        disabled={pending || !name.trim() || !email.trim()}
        onClick={submit}
        className="!py-1.5 !text-[12.5px]"
      >
        Tilføj
      </ClayButton>
      <OutlineButton onClick={onDone}>Annuller</OutlineButton>
      {error && <p className="w-full text-[12px] text-(--color-alert)">{error}</p>}
    </div>
  );
}

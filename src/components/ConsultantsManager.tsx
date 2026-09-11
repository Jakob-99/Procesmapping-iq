"use client";

import { useState, useTransition } from "react";
import { inviteConsultant, removeConsultant, updateConsultantRole } from "@/app/admin/consultants/actions";
import { ClayButton, OutlineButton, Badge } from "./ui";
import { CONSULTANT_ROLES, type ConsultantRole } from "@/lib/consultant-roles";

type Consultant = { id: string; name: string; email: string; role: string; createdAt: string };

export function ConsultantsManager({
  consultants,
  currentId,
  currentRole,
}: {
  consultants: Consultant[];
  currentId: string;
  currentRole: string;
}) {
  const [adding, setAdding] = useState(false);
  const isAdmin = currentRole === "ADMIN";

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
          <ConsultantRow key={c.id} consultant={c} isSelf={c.id === currentId} canManageRoles={isAdmin} />
        ))}
        {adding && <AddConsultantRow onDone={() => setAdding(false)} />}
      </div>
    </section>
  );
}

function ConsultantRow({
  consultant,
  isSelf,
  canManageRoles,
}: {
  consultant: Consultant;
  isSelf: boolean;
  canManageRoles: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function changeRole(role: ConsultantRole) {
    setError(null);
    startTransition(async () => {
      const res = await updateConsultantRole(consultant.id, role);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium">
          {consultant.name} {isSelf && <span className="text-(--color-faint)">(dig)</span>}
        </div>
        <div className="truncate text-[11px] text-(--color-faint)">{consultant.email}</div>
        {error && <p className="mt-1 text-[11px] text-(--color-alert)">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canManageRoles ? (
          <select
            value={consultant.role}
            disabled={pending}
            onChange={(e) => changeRole(e.target.value as ConsultantRole)}
            className="rounded-md border border-(--color-line) bg-(--color-surface) px-2 py-1.5 text-[12px] outline-none focus:border-(--color-clay) disabled:opacity-40"
          >
            {Object.entries(CONSULTANT_ROLES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <Badge tone={consultant.role === "ADMIN" ? "clay" : "muted"}>
            {CONSULTANT_ROLES[consultant.role as ConsultantRole] ?? consultant.role}
          </Badge>
        )}
        {!isSelf && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (confirm(`Fjern ${consultant.name} som konsulent? Al deres kundeadgang forsvinder.`)) {
                startTransition(() => removeConsultant(consultant.id));
              }
            }}
            className="rounded-md px-2 py-1.5 text-[12px] text-(--color-alert) transition-opacity hover:opacity-70 disabled:opacity-40"
          >
            Fjern
          </button>
        )}
      </div>
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

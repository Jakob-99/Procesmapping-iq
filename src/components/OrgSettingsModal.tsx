"use client";

import { useState, useTransition } from "react";
import { Modal } from "./Modal";
import { ClayButton, OutlineButton } from "./ui";
import {
  updateOrganizationName,
  createUser,
  updateUser,
  deleteUser,
} from "@/app/actions/organization";
import { ROLES, type Role } from "@/lib/domain";

type OrgUser = { id: string; name: string; email: string; role: string };

const PAGES = [
  { key: "organisation", label: "Organisation" },
  { key: "brugere", label: "Brugere" },
] as const;

type PageKey = (typeof PAGES)[number]["key"];

/*
  Kontrolpanelet: organisationens navn, og listen af brugere — dem der kan
  logge ind og bruge systemet. IKKE det samme som respondenter/eksperter
  (SubProcessExpert), som er dem interviews sendes ud til — en bruger kan
  vælges som kilde til en ny respondent (se addExpertFromUser), men de to
  begreber holdes bevidst adskilt i UI'en.
  Siderne vælges i en sidemenu, ligesom resten af appens navigation, i stedet
  for at ligge stablet under hinanden i én lang scroll.
*/
export function OrgSettingsModal({
  open,
  onClose,
  organization,
  users,
}: {
  open: boolean;
  onClose: () => void;
  organization: { id: string; name: string };
  users: OrgUser[];
}) {
  const [page, setPage] = useState<PageKey>("organisation");

  return (
    <Modal open={open} onClose={onClose} title="Kontrolpanel" padded={false}>
      <nav className="w-52 shrink-0 space-y-0.5 border-r border-(--color-line) bg-(--color-raised) p-3">
        {PAGES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPage(p.key)}
            className={`block w-full rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
              page === p.key
                ? "bg-(--color-clay) font-medium text-white"
                : "text-(--color-muted) hover:bg-(--color-sunken) hover:text-(--color-text)"
            }`}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {page === "organisation" && (
          <OrgNameSection organizationId={organization.id} name={organization.name} />
        )}
        {page === "brugere" && (
          <UsersSection organizationId={organization.id} users={users} />
        )}
      </div>
    </Modal>
  );
}

function OrgNameSection({ organizationId, name }: { organizationId: string; name: string }) {
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();
  const dirty = value.trim() !== name && value.trim().length > 0;

  return (
    <section>
      <div className="eyebrow mb-2">Organisation</div>
      <div className="flex max-w-md items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Organisationens navn"
          className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-3 py-2 text-[13px] outline-none focus:border-(--color-clay)"
        />
        <ClayButton
          disabled={!dirty || pending}
          onClick={() => startTransition(() => updateOrganizationName(organizationId, value))}
        >
          Gem
        </ClayButton>
      </div>
    </section>
  );
}

export function UsersSection({
  organizationId,
  users,
}: {
  organizationId: string;
  users: OrgUser[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="eyebrow">Brugere</div>
        {!adding && (
          <OutlineButton onClick={() => setAdding(true)}>+ Tilføj bruger</OutlineButton>
        )}
      </div>

      <div className="divide-y divide-(--color-line-soft) rounded-lg border border-(--color-line-soft)">
        {users.length === 0 && !adding && (
          <p className="px-3 py-4 text-[12.5px] text-(--color-faint)">
            Ingen brugere endnu.
          </p>
        )}
        {users.map((u) =>
          editingId === u.id ? (
            <UserRow key={u.id} user={u} onDone={() => setEditingId(null)} />
          ) : (
            <UserDisplayRow
              key={u.id}
              user={u}
              onEdit={() => setEditingId(u.id)}
            />
          ),
        )}
        {adding && (
          <UserRow
            organizationId={organizationId}
            onDone={() => setAdding(false)}
          />
        )}
      </div>
    </section>
  );
}

function UserDisplayRow({ user, onEdit }: { user: OrgUser; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const roleLabel = ROLES[user.role as Role] ?? user.role;

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium">{user.name}</div>
        <div className="truncate text-[11px] text-(--color-faint)">
          {user.email} · {roleLabel}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <OutlineButton onClick={onEdit}>Rediger</OutlineButton>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Fjern ${user.name} som bruger?`)) {
              startTransition(() => deleteUser(user.id));
            }
          }}
          className="rounded-md px-2 py-1.5 text-[12px] text-(--color-alert) transition-opacity hover:opacity-70 disabled:opacity-40"
        >
          Fjern
        </button>
      </div>
    </div>
  );
}

function UserRow({
  user,
  organizationId,
  onDone,
}: {
  user?: OrgUser;
  organizationId?: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<string>(user?.role ?? "EMPLOYEE");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim() || !email.trim()) return;
    startTransition(async () => {
      if (user) {
        await updateUser(user.id, name, email, role);
      } else if (organizationId) {
        await createUser(organizationId, name, email, role);
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
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
      >
        {Object.entries(ROLES).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <ClayButton
        disabled={pending || !name.trim() || !email.trim()}
        onClick={submit}
        className="!py-1.5 !text-[12.5px]"
      >
        Gem
      </ClayButton>
      <OutlineButton onClick={onDone}>Annuller</OutlineButton>
    </div>
  );
}

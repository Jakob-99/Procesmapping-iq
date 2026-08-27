"use client";

import { useState, useTransition } from "react";
import { addExpertFromUser, sendInvite } from "@/app/(customer)/processes/[processId]/[subId]/actions";
import { ClayButton } from "./ui";

type Expert = { id: string; name: string; email: string; invitedAt: string | null };
type UserOption = { id: string; name: string };

export function ExpertsPanel({
  processId,
  subProcessId,
  experts,
  users,
}: {
  processId: string;
  subProcessId: string;
  experts: Expert[];
  users: UserOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [selectedUserId, setSelectedUserId] = useState("");

  // Allerede tilføjede eksperter må godt vælges igen (fx en anden e-mail på
  // samme person findes ikke), men vi filtrerer på navn for at undgå
  // åbenlyse dubletter i dropdownen.
  const expertNames = new Set(experts.map((e) => e.name));
  const availableUsers = users.filter((u) => !expertNames.has(u.name));

  function submit() {
    if (!selectedUserId) return;
    startTransition(async () => {
      await addExpertFromUser(processId, subProcessId, selectedUserId);
      setSelectedUserId("");
    });
  }

  return (
    <div className="space-y-3">
      {experts.length === 0 ? (
        <p className="text-[12.5px] text-(--color-faint)">Ingen procesksperter tilknyttet endnu.</p>
      ) : (
        <div className="divide-y divide-(--color-line-soft)">
          {experts.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{e.name}</div>
                <div className="truncate text-[11px] text-(--color-faint)">{e.email}</div>
              </div>
              {e.invitedAt ? (
                <span className="shrink-0 text-[11px] text-(--color-ok)">Inviteret</span>
              ) : (
                <button
                  disabled={pending}
                  onClick={() => startTransition(() => sendInvite(processId, subProcessId, e.id))}
                  className="shrink-0 rounded-md border border-(--color-clay) px-2.5 py-1 text-[11px] font-medium text-(--color-clay) transition-opacity hover:opacity-80"
                >
                  Send invitation
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5 rounded-lg bg-(--color-raised) p-3">
        <div className="eyebrow mb-1">Tilføj procesekspert</div>
        {availableUsers.length === 0 ? (
          <p className="text-[12px] text-(--color-faint)">
            Ingen flere brugere at vælge — tilføj dem i Kontrolpanelet.
          </p>
        ) : (
          <>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay)"
            >
              <option value="">Vælg bruger…</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <ClayButton onClick={submit} disabled={pending || !selectedUserId} className="!py-1.5 !text-[12.5px]">
              Tilføj
            </ClayButton>
          </>
        )}
      </div>
    </div>
  );
}

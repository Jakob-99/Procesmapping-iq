"use client";

import { useTransition } from "react";
import { setAssignee } from "@/app/processes/[processId]/[subId]/actions";

type UserOption = { id: string; name: string };

/*
  Hvem der skal interviewes — sættes både fra procesoversigten (uden at åbne
  underprocessen) og inde fra selve arbejdsfladens "Ansvarlig"-panel.
*/
export function AssigneeSelect({
  processId,
  subProcessId,
  assigneeId,
  users,
  className = "",
}: {
  processId: string;
  subProcessId: string;
  assigneeId: string | null;
  users: UserOption[];
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={assigneeId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const id = e.target.value || null;
        startTransition(() => setAssignee(processId, subProcessId, id));
      }}
      onClick={(e) => e.stopPropagation()}
      className={`rounded-md border border-(--color-line) bg-(--color-surface) px-2.5 py-1.5 text-[12.5px] outline-none focus:border-(--color-clay) ${className}`}
    >
      <option value="">Ikke tildelt</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}

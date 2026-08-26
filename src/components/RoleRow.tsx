"use client";

import { useTransition } from "react";
import { deleteRole } from "@/app/roles/actions";

export function RoleRow({
  id,
  name,
  description,
}: {
  id: string;
  name: string;
  description: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`Slet rollen "${name}"?`)) return;
    startTransition(() => deleteRole(id));
  }

  return (
    <div className={`group flex items-start justify-between gap-3 py-4 first:pt-0 ${pending ? "opacity-40" : ""}`}>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold">{name}</div>
        {description && (
          <p className="mt-1 text-[12.5px] leading-relaxed text-(--color-muted)">
            {description}
          </p>
        )}
      </div>
      <button
        onClick={remove}
        disabled={pending}
        title="Slet rolle"
        className="shrink-0 text-[11px] text-(--color-faint) opacity-0 transition-opacity hover:text-(--color-alert) group-hover:opacity-100"
      >
        Slet
      </button>
    </div>
  );
}

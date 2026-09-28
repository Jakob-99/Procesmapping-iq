"use client";

import { useTransition } from "react";
import { deleteRole } from "@/app/(customer)/roles/actions";
import { InlineDelete } from "./InlineDelete";
import { CardShell, Monogram, UsageList, type Usage } from "./EntityParts";

export function RoleRow({
  id,
  name,
  description,
  usage,
  stepCount,
}: {
  id: string;
  name: string;
  description: string | null;
  usage: Usage[];
  stepCount: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <CardShell pending={pending}>
      <div className="flex items-start gap-3">
        <Monogram name={name} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold leading-tight">{name}</div>
          <div className="mt-1 text-[11px] text-(--color-faint)">
            {stepCount > 0
              ? `Udfører ${stepCount} skridt i ${usage.length} ${usage.length === 1 ? "underproces" : "underprocesser"}`
              : "Udfører endnu ingen skridt"}
          </div>
        </div>
        <InlineDelete
          onConfirm={() => startTransition(() => deleteRole(id))}
          pending={pending}
          title={`Slet rollen "${name}"`}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
        />
      </div>
      {description && (
        <p className="mt-3 line-clamp-3 text-[12px] leading-relaxed text-(--color-muted)">{description}</p>
      )}
      {stepCount > 0 && <UsageList usage={usage} label="Arbejder i" />}
    </CardShell>
  );
}

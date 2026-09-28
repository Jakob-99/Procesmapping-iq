import type { ReactNode } from "react";

/*
  Sidehovedet er den eneste hvide flade der går helt ud til kanten. Det giver
  siden en fast overkant at hænge i, og skiller navigation fra indhold.
*/
export function PageHeader({
  eyebrow,
  title,
  lead,
  action,
  icon,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <header className="shrink-0 border-b border-(--color-line) px-8 py-5">
      <div className="flex items-start justify-between gap-8">
        <div className="flex max-w-2xl items-start gap-4">
          {icon && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-(--color-clay-wash)">
              {icon}
            </div>
          )}
          <div>
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight">
            {title}
          </h1>
          {lead && (
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-(--color-muted)">
              {lead}
            </p>
          )}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}

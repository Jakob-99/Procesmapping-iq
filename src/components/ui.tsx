import type { ReactNode } from "react";

const TONES = {
  clay: "text-(--color-clay) border-(--color-clay-line) bg-(--color-clay-wash)",
  ok: "text-(--color-ok) border-[#4f7c5233] bg-[#4f7c520d]",
  warn: "text-(--color-warn) border-[#b8801f33] bg-[#b8801f0d]",
  alert: "text-(--color-alert) border-[#b3462f33] bg-[#b3462f0d]",
  muted: "text-(--color-muted) border-(--color-line-soft) bg-(--color-raised)",
  faint: "text-(--color-faint) border-(--color-line-soft) bg-transparent",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/*
  Panelet er et rigtigt kort: hvid flade, tynd kant, blød skygge, runde
  hjørner. Det er den form der bærer resten af systemet — labels ligger over
  som små spærrede versaler, indholdet sidder roligt i kortet.
*/
export function Panel({
  title,
  action,
  children,
  bodyClass = "",
  className = "",
}: {
  eyebrow?: string;
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  bodyClass?: string;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-(--color-line-soft) bg-(--color-surface) p-5 shadow-[0_1px_2px_rgba(20,16,12,0.03)] ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex items-end justify-between gap-4">
          {title && (
            <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
          )}
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

/* Bruges hvor noget skal grupperes let — en tonet flade, ingen kant. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`rounded-lg bg-(--color-raised) ${className}`}>{children}</div>;
}

export function SectionTitle({
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-(--color-line) pb-2.5">
      <h2 className="text-[16px] font-semibold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

/* Nøgletal. Tallet bærer, etiketten hvisker. Kun en lodret linje skiller dem. */
export function Stat({
  label,
  value,
  suffix,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="border-l border-(--color-line) pl-4">
      <div className="eyebrow mb-2">{label}</div>
      <div className="tabular flex items-baseline gap-1">
        <span
          className={`font-mono text-[32px] font-normal leading-none tracking-tight ${
            accent ? "text-(--color-clay)" : ""
          }`}
        >
          {value}
        </span>
        {suffix && <span className="text-base text-(--color-faint)">{suffix}</span>}
      </div>
      {hint && (
        <div className="mt-2 text-[11.5px] leading-snug text-(--color-faint)">
          {hint}
        </div>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="py-10 text-center text-sm text-(--color-faint)">{children}</div>
  );
}

/*
  Den primære handling. Let orange flade med kant i samme farvefamilie —
  aldrig en massiv, mættet knap. Bruges sparsomt, én pr. skærm.
*/
export function ClayButton({
  children,
  onClick,
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border border-(--color-clay-line) bg-(--color-clay-wash) px-3.5 py-2 text-[13px] font-medium text-(--color-clay) transition-colors hover:bg-(--color-clay-line) disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/* Sekundær handling. Hvid flade, hårfin kant — "Docs"/"Examples"-mønstret. */
export function OutlineButton({
  children,
  onClick,
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md border border-(--color-line) bg-(--color-surface) px-3 py-1.5 text-[12.5px] font-medium text-(--color-muted) transition-colors hover:border-(--color-clay-line) hover:text-(--color-text) disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

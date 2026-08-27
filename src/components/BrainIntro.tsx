import Link from "next/link";
import { Badge, type Tone } from "./ui";
import { PixelLogo } from "./PixelLogo";

/*
  Det hjernen ved, før man har spurgt om noget.

  Formålet er ikke at være et dashboard, men at vise at der ER noget at spørge
  om — og hvor meget. Hero-tallet siger dækningsgraden på et halvt sekund, og
  hver blok fører videre til det fulde billede. Så snart man skriver,
  forsvinder det hele: samtalen skal have hele fladen.
*/

type Row = { label: string; sub?: string; badge?: string; tone?: Tone };

function Block({
  eyebrow,
  href,
  rows,
}: {
  eyebrow: string;
  href: string;
  rows: Row[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-(--color-line) pb-1.5">
        <div className="eyebrow">{eyebrow}</div>
        <Link
          href={href}
          className="shrink-0 text-[11px] font-medium text-(--color-clay) hover:underline"
        >
          Se mere →
        </Link>
      </div>

      <div className="divide-y divide-(--color-line-soft)">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-3 py-1.5"
          >
            <div className="min-w-0">
              <div className="truncate text-[12.5px]">{r.label}</div>
              {r.sub && (
                <div className="truncate text-[10.5px] text-(--color-faint)">
                  {r.sub}
                </div>
              )}
            </div>
            {r.badge && <Badge tone={r.tone ?? "faint"}>{r.badge}</Badge>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Kompakt nøgletal — etiket over, tal under, ingen ramme. */
function Metric({
  label,
  value,
  hint,
  dark,
}: {
  label: string;
  value: string | number;
  hint?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3.5 py-3 ${
        dark ? "bg-(--color-text) text-white" : "bg-(--color-raised)"
      }`}
    >
      <div
        className={`eyebrow mb-1.5 ${dark ? "text-white/50" : ""}`}
      >
        {label}
      </div>
      <div className="tabular font-mono text-[19px] font-medium leading-none">{value}</div>
      {hint && (
        <div
          className={`mt-1.5 text-[10.5px] ${
            dark ? "text-white/50" : "text-(--color-faint)"
          }`}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

export function BrainIntro({
  orgName,
  coverage,
  stats,
  processes,
  systems,
  insights,
}: {
  orgName: string;
  coverage: number;
  stats: { validated: number; total: number; systems: number; roles: number };
  processes: Row[];
  systems: Row[];
  insights: { category: string; content: string }[];
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <PixelLogo />

      <div className="mb-7 mt-8 flex flex-wrap items-end justify-between gap-6">
        <div className="dot-grid relative -mx-3 -my-2 rounded-2xl px-3 py-2" style={{ backgroundPosition: "-3px -2px" }}>
          <div className="eyebrow mb-2">Kortlagt af {orgName}</div>
          <div className="hero-number">
            {coverage}
            <span className="dim">%</span>
          </div>
          <p className="mt-2.5 text-[12.5px] text-(--color-muted)">
            {stats.validated} af {stats.total} underprocesser er kortlagt og
            valideret
          </p>
        </div>

        <div className="grid flex-1 grid-cols-3 gap-2 sm:max-w-sm">
          <Metric label="Systemer" value={stats.systems} />
          <Metric label="Roller" value={stats.roles} />
          <Metric label="Noter" value={insights.length} dark />
        </div>
      </div>

      <p className="mb-8 border-l-2 border-(--color-clay) pl-3.5 text-[13px] leading-relaxed text-(--color-muted)">
        Jeg ved hvem der gør hvad, og i hvilke systemer — helt ned på det
        enkelte skridt. Spørg om hvad som helst af det.
      </p>

      <div className="grid gap-7 sm:grid-cols-2">
        <Block eyebrow="Processer jeg kender" href="/processes" rows={processes} />
        <Block eyebrow="Systemer i spil" href="/landscape" rows={systems} />
      </div>

      {insights.length > 0 && (
        <div className="mt-7">
          <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-(--color-line) pb-1.5">
            <div className="eyebrow">Det jeg har lagt mærke til</div>
            <Link
              href="/processes"
              className="shrink-0 text-[11px] font-medium text-(--color-clay) hover:underline"
            >
              Se mere →
            </Link>
          </div>

          <div className="space-y-2">
            {insights.map((n, i) => (
              <p
                key={i}
                className="border-l-2 border-(--color-line) pl-3 text-[12.5px] leading-relaxed text-(--color-muted)"
              >
                {n.content}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

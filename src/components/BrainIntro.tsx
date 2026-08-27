import { PixelLogo } from "./PixelLogo";

/*
  Det hjernen ved, før man har spurgt om noget.

  Formålet er ikke at være et dashboard, men at vise at der ER noget at spørge
  om — og hvor meget. Hero-tallet siger dækningsgraden på et halvt sekund. Så
  snart man skriver, forsvinder det hele: samtalen skal have hele fladen.
*/

/* Kompakt nøgletal — etiket over, tal under, ingen ramme. */
function Metric({
  label,
  value,
  dark,
}: {
  label: string;
  value: string | number;
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
    </div>
  );
}

export function BrainIntro({
  orgName,
  coverage,
  stats,
}: {
  orgName: string;
  coverage: number;
  stats: { validated: number; total: number; systems: number; roles: number; notes: number };
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <PixelLogo />

      <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
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
          <Metric label="Noter" value={stats.notes} dark />
        </div>
      </div>
    </div>
  );
}

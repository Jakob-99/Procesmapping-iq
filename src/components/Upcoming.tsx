import { PageHeader } from "./PageHeader";
import { Panel } from "./ui";

/*
  Siden findes, men funktionen er ikke bygget endnu. Vi viser hvad der kommer,
  så flowet kan læses fra ende til anden allerede nu.
*/
export function Upcoming({
  eyebrow,
  title,
  lead,
  steps,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  steps: { title: string; body: string }[];
}) {
  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        lead={lead}
        action={
          <span className="inline-flex items-center gap-2 text-[11px] font-medium text-(--color-muted)">
            <span className="pulse-soft h-1.5 w-1.5 rounded-full bg-(--color-clay)" />
            Under udvikling
          </span>
        }
      />

      <div className="px-8 py-8">
        <Panel eyebrow="Sådan kommer det til at fungere" title="Flowet">
          <div className="grid gap-6 lg:grid-cols-2">
            {steps.map((s, i) => (
              <div key={s.title} className="border-l-2 border-(--color-line) pl-4">
                <div className="tabular mb-1.5 text-[11px] font-medium text-(--color-faint)">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="text-[13.5px] font-semibold">{s.title}</div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-(--color-muted)">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

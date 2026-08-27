import { Badge, Empty, Panel } from "./ui";
import { splitInsights, type Note } from "@/lib/insights";

type LogItem = { id: string; content: string; status: string; createdAt: string };

const LOG_STATUS_LABEL: Record<string, string> = {
  NEW: "Ny",
  REVIEWED: "Set",
  CONVERTED: "Blevet til forbedring",
  CLOSED: "Lukket",
};

export function InsightsPanel({ notes, logs = [] }: { notes: Note[]; logs?: LogItem[] }) {
  const { works, broken } = splitInsights(notes);

  if (notes.length === 0 && logs.length === 0) {
    return (
      <Panel eyebrow="Fra kortlægningen" title="Indsigter" bodyClass="p-4">
        <Empty>Ingen indsigter endnu — de kommer fra interviewene.</Empty>
      </Panel>
    );
  }

  return (
    <Panel eyebrow="Fra kortlægningen" title="Indsigter" bodyClass="p-4">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <div className="mb-2 text-[11px] font-medium text-(--color-ok)">
            Fungerer ({works.length})
          </div>
          <div className="space-y-2">
            {works.length === 0 ? (
              <p className="text-[12px] text-(--color-faint)">Intet fundet endnu.</p>
            ) : (
              works.map((n, i) => (
                <p
                  key={i}
                  className="border-l-2 border-(--color-ok) pl-3 text-[12px] leading-relaxed text-(--color-muted)"
                >
                  {n.content}
                </p>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[11px] font-medium text-(--color-alert)">
            Fungerer ikke ({broken.length})
          </div>
          <div className="space-y-2">
            {broken.length === 0 ? (
              <p className="text-[12px] text-(--color-faint)">Intet fundet endnu.</p>
            ) : (
              broken.map((n, i) => (
                <p
                  key={i}
                  className="border-l-2 border-(--color-alert) pl-3 text-[12px] leading-relaxed text-(--color-muted)"
                >
                  {n.content}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {/*
        Medarbejderens egne forbedringsønsker, sendt fra interview-siden
        (submitImprovementLog i app/interviews/actions.ts) — de skal kunne
        ses samme sted som resten af indsigterne, ikke gemt væk et andet sted.
      */}
      <div className="mt-5 border-t border-(--color-line-soft) pt-4">
        <div className="mb-2 text-[11px] font-medium text-(--color-clay)">
          Ønskede forbedringer fra medarbejdere ({logs.length})
        </div>
        <div className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-[12px] text-(--color-faint)">Ingen ønsker endnu.</p>
          ) : (
            logs.map((l) => (
              <div
                key={l.id}
                className="border-l-2 border-(--color-clay) pl-3 text-[12px] leading-relaxed text-(--color-muted)"
              >
                <p>{l.content}</p>
                <Badge tone="faint">{LOG_STATUS_LABEL[l.status] ?? l.status}</Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </Panel>
  );
}

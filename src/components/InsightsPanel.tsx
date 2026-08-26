import { Empty, Panel } from "./ui";
import { splitInsights, type Note } from "@/lib/insights";

export function InsightsPanel({ notes }: { notes: Note[] }) {
  const { works, broken } = splitInsights(notes);

  if (notes.length === 0) {
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
    </Panel>
  );
}

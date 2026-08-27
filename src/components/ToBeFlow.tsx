import type { ToBeStep } from "@/lib/aios";

/*
  Et bevidst simpelt HTML-flow — ikke det redigerbare bpmn-js-lærred
  (se BpmnViewer/SubProcessWorkspace) — fordi to-be-processen her kun er ét
  illustrativt eksempel i rapporten, ikke en editor man arbejder videre i.
*/
export function ToBeFlow({ steps }: { steps: ToBeStep[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-stretch gap-2">
          <div
            className={`w-[168px] shrink-0 rounded-lg border p-3 ${
              step.isAi
                ? "border-(--color-clay-line) bg-(--color-clay-wash)"
                : "border-(--color-line-soft) bg-(--color-raised)"
            }`}
          >
            <div
              className={`mb-1.5 text-[10px] font-medium uppercase tracking-wide ${
                step.isAi ? "text-(--color-clay)" : "text-(--color-faint)"
              }`}
            >
              {step.isAi ? "AI-agent" : step.actorRole || "Menneske"}
            </div>
            <div className="text-[13px] font-medium leading-snug text-(--color-text)">{step.name}</div>
            {step.description && (
              <div className="mt-1.5 text-[11.5px] leading-snug text-(--color-muted)">{step.description}</div>
            )}
            {step.isAi && step.actorRole && (
              <div className="mt-1.5 text-[10.5px] text-(--color-faint)">i stedet for {step.actorRole}</div>
            )}
          </div>
          {i < steps.length - 1 && (
            <div className="flex shrink-0 items-center text-(--color-faint)">
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M1 7h16M12 1l6 6-6 6" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

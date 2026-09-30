/*
  Diagrammets CSS — samme mål som SwimlaneDiagram.tsx i Corner IQ. Delt af
  procesdiagram-skillens side (render.ts) og Cornerstones' procesmodel-side
  (scripts/artifact). Farverne er --d-*-tokens, som siden selv sætter.
*/
export const DIAGRAM_CSS = `.canvas { position: relative; display: inline-block; color: var(--d-text); }
.pools { display: flex; align-items: flex-start; gap: 20px; }
.pool { border: 1.5px solid var(--d-text); background: var(--d-surface); width: max-content; }
.pool-head { display: flex; align-items: center; height: 40px; border-bottom: 1.5px solid var(--d-text); padding: 0 14px; font-size: 16px; font-weight: 600; }
.lanes { display: flex; }
.no-lanes { display: flex; align-items: center; justify-content: center; height: 96px; width: 100%; padding: 0 16px; font-size: 11.5px; color: var(--d-faint); }
.lane { flex: none; border-right: 1px solid var(--d-text); }
.lane:last-child { border-right: 0; }
.lane-head { display: flex; align-items: center; justify-content: center; height: 44px; border-bottom: 1px solid var(--d-text); padding: 0 8px; text-align: center; font-size: 13.5px; font-weight: 600; line-height: 1.25; }
.lane-body { position: relative; display: grid; padding: 14px 0 22px; }
.cell { position: absolute; display: flex; align-items: center; justify-content: center; min-width: 0; }
.cell.with-docs { justify-content: flex-start; padding-left: 22px; }
.event { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 150px; }
.event-ring { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; background: var(--d-surface); border: 1.5px solid var(--d-text); }
.event-ring.end { border-width: 3.5px; }
.event-caption { text-align: center; font-size: 12px; line-height: 1.375; }
.marker-cell { position: relative; display: flex; align-items: center; justify-content: center; width: 150px; }
.gateway { position: relative; display: block; width: 42px; height: 42px; }
.gateway-diamond { position: absolute; inset: 6px; transform: rotate(45deg); border: 1.5px solid var(--d-text); background: var(--d-surface); }
.gw-marker { position: absolute; inset: 0; width: 100%; height: 100%; }
.timer { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; border: 4px double var(--d-text); background: var(--d-surface); }
.clock { width: 18px; height: 18px; }
.marker-label { position: absolute; left: calc(50% + 29px); top: 50%; width: 112px; transform: translateY(-50%); text-align: left; font-size: 11.5px; line-height: 1.25; color: var(--d-muted); }
.task-cell { display: flex; align-items: center; gap: 22px; }
.task { width: 150px; border-radius: 10px; border: 1.5px solid var(--d-text); background: var(--d-surface); padding: 9px 8px; text-align: center; font-size: 12.5px; line-height: 1.3; }
.task-name { display: block; }
.task-systems { display: block; margin-top: 8px; font-size: 12px; font-weight: 700; }
.docs { display: flex; flex-direction: column; gap: 8px; }
.docs.lifted { transform: translateY(calc(-50% - 6px)); }
.doc { position: relative; display: flex; align-items: center; justify-content: center; min-height: 50px; width: 90px; padding: 9px 14px 7px 6px; text-align: center; font-size: 11px; line-height: 1.25; }
.doc-icon { position: absolute; inset: 0; width: 100%; height: 100%; }
.doc-name { position: relative; }
.arrows { position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.labels { position: absolute; inset: 0; pointer-events: none; }
.flow-label { position: absolute; width: max-content; max-width: 120px; transform: translate(-50%, -50%); background: var(--d-surface); padding: 1px 4px; text-align: center; font-size: 11px; line-height: 1.25; }
`;

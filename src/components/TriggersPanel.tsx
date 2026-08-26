"use client";

import { TriggerList } from "./TriggerList";

export function TriggersPanel({
  processId,
  subProcessId,
  startEvents,
  endEvents,
}: {
  processId: string;
  subProcessId: string;
  startEvents: string[];
  endEvents: string[];
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="eyebrow mb-2">Starter når</div>
        <TriggerList
          processId={processId}
          subProcessId={subProcessId}
          field="startEvent"
          events={startEvents}
          placeholder="Fx “Ordre modtaget pr. mail”"
        />
      </div>
      <div>
        <div className="eyebrow mb-2">Slutter når</div>
        <TriggerList
          processId={processId}
          subProcessId={subProcessId}
          field="endEvent"
          events={endEvents}
          placeholder="Fx “Ordre leveret til kunde”"
        />
      </div>
    </div>
  );
}

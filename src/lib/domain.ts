// Fælles vokabular for procesmapping. Ét sted at rette, når sproget i
// forretningen ændrer sig.

// Flere hændelser i ét fritekstfelt, adskilt af linjeskift. Bruges til
// SubProcess.startEvent/endEvent, der kan have flere triggere (fx "Ordre
// modtaget pr. mail" OG "Ordre oprettet i webshop").
export function splitEvents(text: string | null) {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function joinEvents(events: string[]) {
  return events.join("\n");
}

export const SUBPROCESS_STATUS = {
  NOT_STARTED: { label: "Ikke startet", tone: "faint" },
  DRAFT: { label: "Udkast", tone: "muted" },
  IN_VALIDATION: { label: "Til validering", tone: "warn" },
  VALIDATED: { label: "Valideret", tone: "ok" },
  NEEDS_UPDATE: { label: "Skal opdateres", tone: "alert" },
} as const;

export type SubProcessStatus = keyof typeof SUBPROCESS_STATUS;

// Elementtyper i diagrammet. De fire gateways følger BPMN: eksklusiv (X —
// præcis én vej), parallel (+ — alle veje samtidig), inklusiv (O — én eller
// flere veje) og hændelsesbaseret (den første hændelse der indtræffer
// afgør vejen). DECISION er den eksklusive, af hensyn til eksisterende data.
// TIMER_START er en start på et fast tidspunkt ("Hver onsdag kl. 9") —
// startcirklen med et ur; TIMER er ventetiden undervejs (dobbeltcirkel).
export const STEP_TYPES = [
  "START",
  "TIMER_START",
  "END",
  "TASK",
  "DECISION",
  "PARALLEL",
  "INCLUSIVE",
  "EVENT_GATEWAY",
  "TIMER",
] as const;
export type StepType = (typeof STEP_TYPES)[number];

export const GATEWAY_TYPES: readonly StepType[] = ["DECISION", "PARALLEL", "INCLUSIVE", "EVENT_GATEWAY"];

export function isGateway(type: string) {
  return (GATEWAY_TYPES as readonly string[]).includes(type);
}

// En starthændelse — almindelig eller på et fast tidspunkt.
export function isStart(type: string) {
  return type === "START" || type === "TIMER_START";
}

// Start eller slut: hændelser, der ikke tæller som tegnede skridt.
export function isStartOrEnd(type: string) {
  return isStart(type) || type === "END";
}

// Hvordan man kommer til et system. Et system kan have flere; gemmes som
// kommasepareret tekst i SystemRef.integrations. Alt andet end MANUAL
// betyder at en AI-agent kan komme til systemet (canAgentConnect).
export const INTEGRATION_TYPES = ["MANUAL", "API", "MCP", "RPA"] as const;
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

export const INTEGRATION_LABELS: Record<IntegrationType, string> = {
  MANUAL: "Manuelt",
  API: "API",
  MCP: "MCP",
  RPA: "Computer use / RPA",
};

export function parseIntegrations(text: string | null | undefined): IntegrationType[] {
  const set = new Set((text ?? "").split(",").map((s) => s.trim()));
  return INTEGRATION_TYPES.filter((t) => set.has(t));
}

export function joinIntegrations(list: readonly string[]) {
  return INTEGRATION_TYPES.filter((t) => list.includes(t)).join(",");
}

export function agentCanConnect(list: readonly string[]) {
  return list.some((t) => t !== "MANUAL");
}

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  TASK: "Aktivitet",
  DECISION: "Eksklusiv gateway (X)",
  PARALLEL: "Parallel gateway (+)",
  INCLUSIVE: "Inklusiv gateway (O)",
  EVENT_GATEWAY: "Hændelsesbaseret gateway",
  TIMER: "Timer",
  START: "Start",
  TIMER_START: "Start på tidspunkt",
  END: "Slut",
};

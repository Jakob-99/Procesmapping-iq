// Fælles vokabular. Ét sted at rette, når sproget i forretningen ændrer sig.

// Flere hændelser i ét fritekstfelt, adskilt af linjeskift — samme mønster som
// strategiske mål. Bruges til SubProcess.startEvent/endEvent, der kan have
// flere trigge (fx "Ordre modtaget pr. mail" OG "Ordre oprettet i webshop").
export function splitEvents(text: string | null) {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function joinEvents(events: string[]) {
  return events.join("\n");
}

export const ROLES = {
  FDE: "Senior konsulent (FDE)",
  PROCESS_OWNER: "Procesejer",
  EMPLOYEE: "Medarbejder",
  CUSTOMER_LEAD: "Kundeansvarlig",
  PARTNER: "Udviklingspartner",
} as const;

export type Role = keyof typeof ROLES;

// De otte faser et engagement bevæger sig igennem.
export const STAGES = [
  { key: "SCOPING", label: "Scoping", blurb: "Strategiske mål, procesmodel og organisation" },
  { key: "MAPPING", label: "Kortlægning", blurb: "Interviews og BPMN pr. underproces" },
  { key: "ANALYSIS", label: "Analyse", blurb: "Flaskehalse og AIOS-forslag" },
  { key: "ROADMAP", label: "Roadmap", blurb: "Prioritering og partnervalg" },
  { key: "HANDOFF", label: "Overdragelse", blurb: "Materiale og test cases til partner" },
  { key: "TRAINING", label: "Træning", blurb: "Oplæring på de nye systemer" },
  { key: "LIVE", label: "Drift", blurb: "Løbende forbedring og kvartalseftersyn" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export function stageIndex(stage: string) {
  const i = STAGES.findIndex((s) => s.key === stage);
  return i === -1 ? 0 : i;
}

// De tre håndtag agenten må trække i, når den finder en flaskehals.
export const LEVERS = {
  DIFFERENT: {
    label: "Gør det helt anderledes",
    blurb: "Processen kan tænkes forfra — ikke optimeres, men erstattes",
    tone: "clay",
  },
  IMPROVE: {
    label: "Gør det bedre",
    blurb: "Samme proces, færre trin, mindre spild",
    tone: "ok",
  },
  VOLUME: {
    label: "Gør det i højere volumen",
    blurb: "Kapaciteten er loftet — skalér i stedet for at effektivisere",
    tone: "warn",
  },
} as const;

export type Lever = keyof typeof LEVERS;

export const SUBPROCESS_STATUS = {
  NOT_STARTED: { label: "Ikke startet", tone: "faint" },
  INTERVIEW: { label: "Interview i gang", tone: "clay" },
  DRAFT: { label: "Udkast", tone: "muted" },
  IN_VALIDATION: { label: "Til validering", tone: "warn" },
  VALIDATED: { label: "Valideret", tone: "ok" },
  NEEDS_UPDATE: { label: "Skal opdateres", tone: "alert" },
} as const;

export const NOTE_CATEGORIES = {
  PAIN: "Smertepunkt",
  WORKAROUND: "Workaround",
  RISK: "Risiko",
  KNOWLEDGE: "Tavs viden",
  OPPORTUNITY: "Mulighed",
} as const;

// Hvert AIOS-forslag får sin egen baggrundsfarve — kortet er billedet, der
// findes ikke rigtige produktbilleder endnu. Farven er stabil pr. forslag
// (udledt af id'et), så den ikke skifter når listen sorteres om.
const PROPOSAL_PALETTE = [
  ["#e35f1e", "#f0894a"], // clay
  ["#14100c", "#3a2d22"], // ink
  ["#3d6b40", "#6b9a6e"], // grøn
  ["#96661a", "#c9a24a"], // okker
  ["#8f3320", "#c85f3f"], // terrakotta
  ["#5c2a3d", "#8a4a63"], // vin
] as const;

function proposalPaletteEntry(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PROPOSAL_PALETTE[hash % PROPOSAL_PALETTE.length];
}

export function proposalGradient(id: string) {
  const [from, to] = proposalPaletteEntry(id);
  return `linear-gradient(135deg, ${from}, ${to})`;
}

// Bare grundfarven — bruges hvor forslaget skal genkendes i miniature, fx som
// et lille mærke i menuen, hvor en hel gradient bliver for meget.
export function proposalColor(id: string) {
  return proposalPaletteEntry(id)[0];
}

// Pick-matrix: samlet prioritet. Strategisk relevans vægter tungest,
// fordi et forslag uden strategisk fodfæste aldrig bliver bygget.
export function pickScore(p: {
  scoreStrategic?: number | null;
  scoreImpact?: number | null;
  scoreFeasibility?: number | null;
}) {
  const s = p.scoreStrategic ?? 0;
  const i = p.scoreImpact ?? 0;
  const f = p.scoreFeasibility ?? 0;
  if (!s && !i && !f) return null;
  return Math.round(((s * 0.4 + i * 0.35 + f * 0.25) / 5) * 100);
}

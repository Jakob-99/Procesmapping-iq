// AIOS-byggestenene — teorien bag "hvad et AI-system består af", som
// Forbedringsrapportens systemfunktion-liste struktureres efter. Hentet fra
// Jakobs eget AI-native-materiale (harness/model-analogien: motoren er
// modellen, resten af bilen er harnesset man bygger omkring den).

export const AIOS_BUILDING_BLOCKS = {
  MODEL: {
    label: "Model",
    blurb: "Hjernens kapacitet og grundlæggende evner.",
  },
  ONTOLOGY: {
    label: "Skelet / ontologi",
    blurb: "Hvad systemet skal manipulere i, og hvilken kontekst det arbejder ud fra.",
  },
  CONTEXT: {
    label: "Kontekst",
    blurb:
      "Data der tages beslutninger på: input-data, viden der bruges til at bearbejde det, og hukommelse (kort- og langtids) om hvad der allerede er gjort.",
  },
  SKILLS: {
    label: "Skills",
    blurb: "Udfører opgaver med en helt bestemt, fast tilgang.",
  },
  PLAN: {
    label: "Plan",
    blurb: "Den overordnede plan og de mål agenten holder sit arbejde op imod.",
  },
  ARTIFACTS: {
    label: "Artefakter",
    blurb: "De faste formater agenten altid skal bruge — skabeloner, visuel identitet.",
  },
  TOOLS: {
    label: "Værktøjer & subagenter",
    blurb: "Udløser konkrete handlinger der skaber værdi — værktøjer, subagenter, MCP-servere.",
  },
  TRIGGER: {
    label: "Trigger",
    blurb: "Hvornår agenten skal reagere.",
  },
  GOALS: {
    label: "Mål & optimering",
    blurb: "De mål agenten holder sig op imod og selv retter ind efter.",
  },
  INTERFACE: {
    label: "Interface",
    blurb: "Hvordan man styrer og ser information — dashboard, chat, kontrolpanel.",
  },
} as const;

export type AiosBlock = keyof typeof AIOS_BUILDING_BLOCKS;

// Alle rapporter handler om at forbedre EKSISTERENDE processer gennem
// AIOS-systemer og andre løsninger — ikke om at redesigne organisationen
// eller opfinde nye værditilbud. Hvor bygges AIOS-systemet ind: i hvordan
// forretningen selv arbejder, i det kunderne allerede køber, eller begge?
export const BUILD_TARGETS = {
  INTERNAL_PROCESS: {
    label: "Interne processer",
    blurb: "Bygges ind i hvordan forretningen selv arbejder.",
  },
  PRODUCT: {
    label: "Produktet",
    blurb: "Bygges ind i det kunderne køber og oplever.",
  },
} as const;

export type BuildTarget = keyof typeof BUILD_TARGETS;

// Et forslag kan være strategisk rigtigt, men stadig strande på at
// virksomheden ikke har ressourcerne eller kompetencerne til at bygge og
// drive det — Fit/Gap-vurderingen fra projektmodellens trin 1.
export const RESOURCE_READINESS_LABELS = {
  READY: { label: "Ressourcer og kompetencer er til stede", tone: "ok" },
  PARTIAL: { label: "Delvist til stede", tone: "warn" },
  GAP: { label: "Stort gab — kræver opbygning først", tone: "alert" },
} as const;

export type ResourceReadiness = keyof typeof RESOURCE_READINESS_LABELS;

export type SystemFunction = { block: AiosBlock; description: string };
export type ToBeStep = { name: string; actorRole: string; isAi: boolean; description: string };

export function parseJsonList<T>(json: string | null): T[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}

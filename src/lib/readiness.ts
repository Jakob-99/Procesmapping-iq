// AI-parathed af systemlandskabet — de tre forudsætninger et systemfundament
// (typisk ERP) skal opfylde for at være berettiget til AI native, hentet fra
// Jakobs AI-native-materiale: åbne API'er (læse OG skrive), ren og konsistent
// stamdata, og løbende (ikke efterslæbt) opdatering af data i systemet.

export const READINESS_CRITERIA = {
  hasOpenApi: {
    label: "Åbne API'er",
    blurb: "Systemet har åbne API'er (REST/GraphQL) og understøtter tilbageskrivning, så data kan streames ud og handlinger sendes retur.",
  },
  masterDataQuality: {
    label: "Stamdata-hygiejne",
    blurb: "Varenumre, id'er og styklister er konsistente — datamæssigt affald ødelægger den digitale tvilling.",
  },
  processesUpToDate: {
    label: "Løbende opdatering",
    blurb: "Lagerbevægelser og hændelser registreres med det samme i systemet, ikke samlet op senere.",
  },
} as const;

export const MASTER_DATA_QUALITY_LABELS = {
  GOOD: "God",
  PARTIAL: "Delvis",
  POOR: "Dårlig",
} as const;

export type SystemReadinessInput = {
  hasOpenApi: boolean;
  masterDataQuality: string | null;
  processesUpToDate: boolean;
};

export type ReadinessVerdict = "READY" | "PARTIAL" | "NOT_READY";

export const VERDICT_LABELS: Record<ReadinessVerdict, { label: string; tone: "ok" | "warn" | "alert" }> = {
  READY: { label: "Klar til AI", tone: "ok" },
  PARTIAL: { label: "Delvist klar", tone: "warn" },
  NOT_READY: { label: "Ikke klar", tone: "alert" },
};

// Alle tre skal være opfyldt for "klar" — ét eneste hul (fx lukkede API'er)
// gør den digitale tvilling upålidelig for en agent, uanset hvor gode de
// andre to er.
export function systemReadiness(s: SystemReadinessInput): { verdict: ReadinessVerdict; metCount: number } {
  const met = [s.hasOpenApi, s.masterDataQuality === "GOOD", s.processesUpToDate].filter(Boolean).length;
  const verdict: ReadinessVerdict = met === 3 ? "READY" : met === 0 ? "NOT_READY" : "PARTIAL";
  return { verdict, metCount: met };
}

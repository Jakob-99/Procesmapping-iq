import { db } from "./db";
import { generateJson, hasApiKey } from "./claude";
import { AIOS_BUILDING_BLOCKS } from "./aios";

/*
  Flaskehalsanalysen og AIOS-forslaget agenten skulle generere fandtes ikke
  som kode noget sted — kun de manuelt seedede eksempler i /improvements.
  Denne funktion er den agent-genererede vej: den læser én underproces'
  kortlægning (skridt, smertepunkter, interviewnoter) plus konsulenternes
  egen AIOS-log (ConsultantLogEntry — differentiatoren mod generiske
  procesværktøjer, som ellers ikke blev slået op noget sted i appen) og
  skriver en Improvement + AiosProposal i nøjagtig samme facon som
  Forbedringsrapporten på /improvements/[id] viser.
*/

const BLOCK_KEYS = Object.keys(AIOS_BUILDING_BLOCKS);

const PROPOSAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "bottleneck", "lever", "rationale", "proposal"],
  properties: {
    title: { type: "string", description: "Kort titel på flaskehalsen, dansk." },
    bottleneck: { type: "string", description: "1-2 sætninger: hvad er selve flaskehalsen." },
    lever: {
      type: "string",
      enum: ["DIFFERENT", "IMPROVE", "VOLUME"],
      description: "DIFFERENT = gør det helt anderledes. IMPROVE = gør det bedre. VOLUME = gør det i højere volumen.",
    },
    rationale: { type: "string", description: "Hvorfor dette håndtag er det rigtige, 1-2 sætninger." },
    proposal: {
      type: "object",
      additionalProperties: false,
      required: [
        "name",
        "description",
        "howItWorks",
        "example",
        "roiEstimate",
        "systemsUsed",
        "dataUsed",
        "rolesAffected",
        "strategicGoal",
        "requiresSystem",
        "systemFunctions",
        "toBeSteps",
        "buildsInto",
        "resourceReadiness",
        "resourceNotes",
        "inspiredByLogTitle",
      ],
      properties: {
        name: { type: "string", description: "Navnet på AIOS-systemet/løsningen, kort og konkret." },
        description: { type: "string", description: "Ledeafsnit, 2-4 sætninger, dansk." },
        howItWorks: { type: "string", description: "Uddybende — hvordan virker det. Tom streng hvis intet at tilføje." },
        example: { type: "string", description: "Et konkret hændelsesforløb i brug, fortalt som en lille scene." },
        roiEstimate: { type: "string", description: "Grove tal for forventet afkast — ikke en detaljeret businesscase." },
        systemsUsed: { type: "array", items: { type: "string" } },
        dataUsed: { type: "array", items: { type: "string" } },
        rolesAffected: { type: "array", items: { type: "string" } },
        strategicGoal: {
          type: "string",
          description: "Én linje fra de strategiske mål der passer bedst, ordret. Tom streng hvis ingen passer.",
        },
        requiresSystem: { type: "boolean", description: "Kræver forslaget at der bygges et nyt AIOS-system?" },
        systemFunctions: {
          type: "array",
          description: "Kun relevant når requiresSystem er sand, ellers tom liste.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["block", "description"],
            properties: {
              block: { type: "string", enum: BLOCK_KEYS },
              description: { type: "string" },
            },
          },
        },
        toBeSteps: {
          type: "array",
          description: "Et forenklet to-be-procesforløb, 3-6 skridt.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "actorRole", "isAi", "description"],
            properties: {
              name: { type: "string" },
              actorRole: { type: "string", description: "Tom streng hvis isAi er sand." },
              isAi: { type: "boolean" },
              description: { type: "string" },
            },
          },
        },
        buildsInto: {
          type: "array",
          items: { type: "string", enum: ["INTERNAL_PROCESS", "PRODUCT"] },
        },
        resourceReadiness: { type: "string", enum: ["READY", "PARTIAL", "GAP"] },
        resourceNotes: { type: "string", description: "Fit/gap-vurdering, 1-3 sætninger. Tom streng hvis intet at tilføje." },
        inspiredByLogTitle: {
          type: "string",
          description:
            "Hvis ét af eksemplerne i konsulenternes AIOS-log direkte inspirerede løsningen, dets PRÆCISE titel som den står i loggen. Ellers tom streng.",
        },
      },
    },
  },
} as const;

type GeneratedProposal = {
  title: string;
  bottleneck: string;
  lever: "DIFFERENT" | "IMPROVE" | "VOLUME";
  rationale: string;
  proposal: {
    name: string;
    description: string;
    howItWorks: string;
    example: string;
    roiEstimate: string;
    systemsUsed: string[];
    dataUsed: string[];
    rolesAffected: string[];
    strategicGoal: string;
    requiresSystem: boolean;
    systemFunctions: { block: string; description: string }[];
    toBeSteps: { name: string; actorRole: string; isAi: boolean; description: string }[];
    buildsInto: ("INTERNAL_PROCESS" | "PRODUCT")[];
    resourceReadiness: "READY" | "PARTIAL" | "GAP";
    resourceNotes: string;
    inspiredByLogTitle: string;
  };
};

const jsonOrNull = (list: unknown[]) => (list.length ? JSON.stringify(list) : null);

export async function generateProposalForSubProcess(subProcessId: string): Promise<string> {
  if (!hasApiKey()) {
    throw new Error("Sæt ANTHROPIC_API_KEY i .env for at aktivere agentens forbedringsforslag.");
  }

  const sp = await db.subProcess.findUnique({
    where: { id: subProcessId },
    include: {
      process: { include: { engagement: true } },
      steps: {
        orderBy: { sortOrder: "asc" },
        include: {
          actorRole: true,
          systems: { include: { system: true } },
          data: { include: { dataObject: true } },
        },
      },
      interviews: { include: { notes: true } },
    },
  });
  if (!sp) throw new Error("Underprocessen findes ikke.");
  if (!sp.steps.length) throw new Error("Underprocessen har ingen kortlagte skridt endnu.");

  const engagementId = sp.process.engagementId;
  const notes = sp.interviews.flatMap((i) => i.notes);

  const logEntries = await db.consultantLogEntry.findMany({ orderBy: { createdAt: "desc" }, take: 25 });

  const stepLines = sp.steps
    .map((s) => {
      const meta = [
        s.actorRole && `udføres af ${s.actorRole.name}`,
        s.isManual ? "manuel" : "automatiseret",
        s.frequency && `frekvens: ${s.frequency}`,
        s.durationMin && `${s.durationMin} min`,
      ]
        .filter(Boolean)
        .join(", ");
      const sys = s.systems.map((x) => x.system.name).join(", ") || "ingen";
      const dat = s.data.map((x) => x.dataObject.name).join(", ") || "ingen";
      return [
        `${s.sortOrder + 1}. ${s.name} [${s.stepType}] (${meta})`,
        `   systemer: ${sys} | data: ${dat}`,
        s.painPoint ? `   smertepunkt: ${s.painPoint}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const context = [
    `Virksomhed: ${sp.process.engagement.name}`,
    sp.process.engagement.strategicGoals ? `Strategiske mål:\n${sp.process.engagement.strategicGoals}` : null,
    `Proces: ${sp.process.name} — Underproces: ${sp.name}`,
    sp.summary ? `Resume: ${sp.summary}` : null,
    `Skridt:\n${stepLines}`,
    notes.length
      ? `Interviewnoter:\n${notes.map((n) => `- [${n.category}] ${n.content}`).join("\n")}`
      : null,
    logEntries.length
      ? `Konsulenternes AIOS-log (eksempler på tidligere leverede løsninger, til inspiration — genbrug kun hvis det reelt passer):\n${logEntries
          .map((l) => `- "${l.title}" (${l.technology}, løser: ${l.problemType}): ${l.description}${l.outcome ? ` — udkomme: ${l.outcome}` : ""}`)
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await generateJson<GeneratedProposal>({
    system:
      "Du er Corner IQ's flaskehalsanalyse-agent. Ud fra en kortlagt underproces finder du den mest oplagte " +
      "flaskehals og skriver et konkret forbedringsforslag — enten et AIOS-system eller en anden løsning — i " +
      "nøjagtig den stil som Corner IQs forbedringsrapporter: konkret, jordnær, ingen buzzwords. Rapporter " +
      "handler udelukkende om at forbedre EKSISTERENDE processer — ikke om at redesigne organisationen eller " +
      "opfinde nye værditilbud. Brug konsulenternes AIOS-log som inspiration når et eksempel reelt passer på " +
      "flaskehalsen, men opfind ikke en kobling der ikke giver mening. Svar altid på dansk.",
    prompt: `${context}\n\nFind flaskehalsen og skriv forslaget.`,
    schema: PROPOSAL_SCHEMA,
    effort: "high",
  });

  const matchedLog = result.proposal.inspiredByLogTitle
    ? logEntries.find((l) => l.title.toLowerCase() === result.proposal.inspiredByLogTitle.toLowerCase())
    : undefined;

  const improvement = await db.improvement.create({
    data: {
      engagementId,
      processId: sp.processId,
      subProcessId: sp.id,
      title: result.title,
      bottleneck: result.bottleneck,
      lever: result.lever,
      isCrossProcess: false,
      rationale: result.rationale.trim() || null,
    },
  });

  const p = result.proposal;
  const proposal = await db.aiosProposal.create({
    data: {
      improvementId: improvement.id,
      name: p.name,
      layer: "PROCESS",
      description: p.description,
      howItWorks: p.howItWorks.trim() || null,
      example: p.example.trim() || null,
      roiEstimate: p.roiEstimate.trim() || null,
      systemsUsed: jsonOrNull(p.systemsUsed),
      dataUsed: jsonOrNull(p.dataUsed),
      rolesAffected: jsonOrNull(p.rolesAffected),
      strategicGoal: p.strategicGoal.trim() || null,
      requiresSystem: p.requiresSystem,
      systemFunctions: p.requiresSystem ? jsonOrNull(p.systemFunctions) : null,
      toBeSteps: jsonOrNull(p.toBeSteps),
      buildsInto: jsonOrNull(p.buildsInto),
      resourceReadiness: p.resourceReadiness || null,
      resourceNotes: p.resourceNotes.trim() || null,
      sourceKind: matchedLog ? "CONSULTANT_LOG" : "AGENT",
      sourceRef: matchedLog?.id ?? null,
    },
  });

  await db.aiosProcessLink.create({ data: { proposalId: proposal.id, processId: sp.processId } });

  return proposal.id;
}

import { db } from "./db";
import { generateJson, hasApiKey } from "./claude";

/*
  Broen mellem interviewet og BPMN-kortlægningen. Interviewet fangede før kun
  fri tekst, formularsvar og keynote-noter — aldrig en ordnet liste af
  processkridt, så underprocesejeren måtte tegne hele lærredet fra bunden af
  hukommelsen bagefter. Denne funktion læser den fulde transskription og
  udleder de konkrete skridt, matchet mod de systemer/roller/dataobjekter der
  allerede findes i kortlægningen — ligesom interview-agenten selv gør
  undervejs i samtalen (se INTERVIEW_SYSTEM_PROMPT i lib/interview.ts).
*/

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["steps"],
  properties: {
    steps: {
      type: "array",
      description: "De konkrete arbejdstrin, i rækkefølge, fra lige efter starthændelsen til lige før sluthændelsen. Selve start-/sluthændelsen skal IKKE med som et skridt.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "stepType",
          "isManual",
          "actorRoleName",
          "systemNames",
          "dataObjects",
          "frequency",
          "durationMin",
          "painPoint",
          "decisionCriteria",
          "output",
        ],
        properties: {
          name: { type: "string", description: "Kort, konkret handling — fx 'Slå kunden op i NAV'." },
          stepType: { type: "string", enum: ["TASK", "DECISION"] },
          isManual: { type: "boolean" },
          actorRoleName: {
            type: ["string", "null"],
            description: "PRÆCIS ét navn fra listen af kendte roller, eller null hvis ingen passer.",
          },
          systemNames: {
            type: "array",
            items: { type: "string" },
            description: "Kun navne fra listen af kendte systemer.",
          },
          dataObjects: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "direction"],
              properties: {
                name: { type: "string", description: "Kun navne fra listen af kendte dataobjekter." },
                direction: { type: "string", enum: ["INPUT", "OUTPUT", "BOTH"] },
              },
            },
          },
          frequency: { type: ["string", "null"], description: 'Fx "40 gange om dagen". Kun hvis nævnt.' },
          durationMin: { type: ["number", "null"], description: "Typisk varighed i minutter. Kun hvis nævnt." },
          painPoint: { type: ["string", "null"] },
          decisionCriteria: {
            type: ["string", "null"],
            description: "Kun for stepType DECISION: hvad afgør skridtet.",
          },
          output: { type: ["string", "null"], description: "Hvad skridtet producerer." },
        },
      },
    },
  },
} as const;

type ExtractedStep = {
  name: string;
  stepType: "TASK" | "DECISION";
  isManual: boolean;
  actorRoleName: string | null;
  systemNames: string[];
  dataObjects: { name: string; direction: "INPUT" | "OUTPUT" | "BOTH" }[];
  frequency: string | null;
  durationMin: number | null;
  painPoint: string | null;
  decisionCriteria: string | null;
  output: string | null;
};

export async function generateStepsFromInterview(subProcessId: string) {
  if (!hasApiKey()) {
    throw new Error("Sæt ANTHROPIC_API_KEY i .env for at aktivere kortlægning fra interview.");
  }

  const sp = await db.subProcess.findUnique({
    where: { id: subProcessId },
    include: {
      process: true,
      interviews: {
        include: { notes: true, messages: { orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!sp) throw new Error("Underprocessen findes ikke.");

  const transcript = sp.interviews
    .flatMap((i) => i.messages)
    .map((m) => `${m.role === "agent" ? "AGENT" : "MEDARBEJDER"}: ${m.content}`)
    .join("\n\n");
  if (!transcript.trim()) {
    throw new Error("Intet interview at kortlægge fra endnu.");
  }

  const notes = sp.interviews.flatMap((i) => i.notes);

  const [systems, roles, dataObjects] = await Promise.all([
    db.systemRef.findMany({ where: { engagementId: sp.process.engagementId }, select: { id: true, name: true } }),
    db.businessRole.findMany({ where: { engagementId: sp.process.engagementId }, select: { id: true, name: true } }),
    db.dataObject.findMany({ where: { engagementId: sp.process.engagementId }, select: { id: true, name: true } }),
  ]);

  const context = [
    `Underproces: ${sp.name} (del af proces: ${sp.process.name})`,
    sp.startEvent ? `Starter når: ${sp.startEvent}` : null,
    sp.endEvent ? `Slutter når: ${sp.endEvent}` : null,
    `Kendte systemer: ${systems.map((s) => s.name).join(", ") || "ingen endnu"}`,
    `Kendte roller: ${roles.map((r) => r.name).join(", ") || "ingen endnu"}`,
    `Kendte dataobjekter: ${dataObjects.map((d) => d.name).join(", ") || "ingen endnu"}`,
    notes.length
      ? `Noter fra interviewet:\n${notes.map((n) => `- [${n.category}] ${n.content}`).join("\n")}`
      : null,
    `Transskription:\n${transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await generateJson<{ steps: ExtractedStep[] }>({
    system:
      "Du er Corner IQ's kortlægningsagent. Ud fra et interview-transskript udleder du den ordnede liste af " +
      "konkrete arbejdstrin i underprocessen. Brug PRÆCIS de navne der står i de kendte lister (systemer/roller/" +
      "dataobjekter) når medarbejderen tydeligvis mener det samme, selv med en forkortelse eller et andet ord — " +
      "opfind aldrig et nyt navn, udelad hellere den reference hvis intet kendt matcher. Brug stepType DECISION " +
      "kun for reelle forgreningspunkter, ellers TASK. Svar kort og på dansk.",
    prompt: `${context}\n\nUdled skridtene.`,
    schema: EXTRACT_SCHEMA,
    effort: "medium",
  });

  if (!result.steps.length) {
    throw new Error("Kunne ikke udlede nogen skridt fra interviewet.");
  }

  const roleIdByName = new Map(roles.map((r) => [r.name.toLowerCase(), r.id]));
  const systemIdByName = new Map(systems.map((s) => [s.name.toLowerCase(), s.id]));
  const dataIdByName = new Map(dataObjects.map((d) => [d.name.toLowerCase(), d.id]));

  // Sekventielle await's i én interaktiv transaktion (ikke nested create) —
  // undgår Prisma's type-inferens-fald mellem "checked"/"unchecked" nested
  // create-varianter, og matcher samme trin-for-trin-mønster som seed.ts
  // bruger til StepSystem/StepData.
  await db.$transaction(async (tx) => {
    for (const [index, s] of result.steps.entries()) {
      const step = await tx.processStep.create({
        data: {
          subProcessId,
          name: s.name.trim() || "Unavngivet skridt",
          stepType: s.stepType,
          isManual: s.isManual,
          actorRoleId: s.actorRoleName ? roleIdByName.get(s.actorRoleName.toLowerCase()) ?? null : null,
          frequency: s.frequency?.trim() || null,
          durationMin: s.durationMin != null ? Math.round(s.durationMin) : null,
          painPoint: s.painPoint?.trim() || null,
          decisionCriteria: s.decisionCriteria?.trim() || null,
          output: s.output?.trim() || null,
          lane: 0,
          sortOrder: index,
        },
      });

      const systemIds = [...new Set(s.systemNames.map((n) => systemIdByName.get(n.toLowerCase())))].filter(
        (id): id is string => !!id,
      );
      if (systemIds.length) {
        await tx.stepSystem.createMany({
          data: systemIds.map((systemId) => ({ stepId: step.id, systemId })),
        });
      }

      const dataLinks = s.dataObjects
        .map((d) => ({ dataObjectId: dataIdByName.get(d.name.toLowerCase()), direction: d.direction }))
        .filter((d): d is { dataObjectId: string; direction: "INPUT" | "OUTPUT" | "BOTH" } => !!d.dataObjectId);
      if (dataLinks.length) {
        await tx.stepData.createMany({
          data: dataLinks.map((d) => ({ stepId: step.id, dataObjectId: d.dataObjectId, direction: d.direction })),
        });
      }
    }
  });
}

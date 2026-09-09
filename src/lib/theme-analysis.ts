/*
  Tematisk analyse på tværs af ALLE interviews i et engagement — klynger
  InterviewNote-rækkerne (smertepunkter, workarounds, risici, tavs viden,
  muligheder) i et lille sæt navngivne temaer. Regenereres fra bunden ved
  hvert klik (ikke additivt), så temalisten altid afspejler den fulde,
  aktuelle notemængde.
*/

import { db } from "./db";
import { generateJson, hasApiKey } from "./claude";

export const THEME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["themes"],
  properties: {
    themes: {
      type: "array",
      description: "3-8 temaer, hvert med en kort titel og et resumé.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "summary", "noteIds"],
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          noteIds: {
            type: "array",
            items: { type: "string" },
            description: "id'erne på de noter (fra listen) der understøtter temaet.",
          },
        },
      },
    },
  },
} as const;

type ThemeResult = {
  themes: { title: string; summary: string; noteIds: string[] }[];
};

type NoteForAnalysis = {
  id: string;
  category: string;
  content: string;
  agentName: string;
  respondentName: string;
};

function buildThemeAnalysisPrompt(notes: NoteForAnalysis[]): string {
  const list = notes
    .map((n) => `[${n.id}] (${n.category}, fra "${n.agentName}" / ${n.respondentName}): ${n.content}`)
    .join("\n");
  return `Her er alle noter fra interviews i dette engagement:\n\n${list}\n\nKlyng dem i 3-8 temaer på tværs af interviewene. Et tema skal dække flere noter, gerne fra forskellige interviews, ikke bare gengive én enkelt note. Skriv titel og resumé på dansk.`;
}

export async function generateThemeClusters(engagementId: string): Promise<number> {
  if (!hasApiKey()) {
    throw new Error("Sæt ANTHROPIC_API_KEY for at generere temaer.");
  }

  const notesRaw = await db.interviewNote.findMany({
    where: { interview: { engagementId } },
    include: { interview: { include: { interviewAgent: true, respondent: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  if (notesRaw.length === 0) {
    throw new Error("Ingen noter at analysere endnu — gennemfør nogle interviews først.");
  }

  const notes: NoteForAnalysis[] = notesRaw.map((n) => ({
    id: n.id,
    category: n.category,
    content: n.content,
    agentName: n.interview.interviewAgent.name,
    respondentName: n.interview.respondent.name,
  }));

  const result = await generateJson<ThemeResult>({
    system:
      "Du er en dygtig kvalitativ researcher, der finder mønstre på tværs af mange interviewnoter. Skriv præcist og på dansk.",
    prompt: buildThemeAnalysisPrompt(notes),
    schema: THEME_SCHEMA as unknown as Record<string, unknown>,
    effort: "high",
  });

  await db.$transaction([
    db.themeCluster.deleteMany({ where: { engagementId } }),
    ...result.themes.map((t) =>
      db.themeCluster.create({
        data: {
          engagementId,
          title: t.title,
          summary: t.summary,
          noteIds: JSON.stringify(t.noteIds),
        },
      }),
    ),
  ]);

  return result.themes.length;
}

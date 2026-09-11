/*
  Tematisk analyse på tværs af interviews i ÉN interview-runde (den navngivne
  "samling" man opretter under /rounds og sender interviews ind i) — klynger
  InterviewNote-rækkerne (smertepunkter, workarounds, risici, tavs viden,
  muligheder) i et lille sæt navngivne temaer. To forskellige runder (fx
  "Trivsel Q1" og "Trivsel Q2", selv med samme agent) blandes aldrig sammen.
  Regenereres fra bunden ved hvert klik (ikke additivt), så temalisten altid
  afspejler den fulde, aktuelle notemængde for netop den runde.
*/

import { db } from "./db";
import { generateJson, hasApiKey, hasClaudeCli } from "./claude";

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
  respondentName: string;
};

function buildThemeAnalysisPrompt(roundName: string, notes: NoteForAnalysis[]): string {
  const list = notes.map((n) => `[${n.id}] (${n.category}, ${n.respondentName}): ${n.content}`).join("\n");
  return `Her er alle noter fra interviews i runden "${roundName}":\n\n${list}\n\nKlyng dem i 3-8 temaer på tværs af interviewene. Et tema skal dække flere noter, gerne fra forskellige respondenter, ikke bare gengive én enkelt note. Skriv titel og resumé på dansk.`;
}

export async function generateThemeClusters(roundId: string): Promise<number> {
  if (!hasApiKey() && !hasClaudeCli()) {
    throw new Error("Sæt ANTHROPIC_API_KEY, eller sørg for at Claude CLI er installeret, for at generere temaer.");
  }

  const round = await db.interviewRound.findUniqueOrThrow({ where: { id: roundId } });

  const notesRaw = await db.interviewNote.findMany({
    where: { interview: { interviewRoundId: roundId } },
    include: { interview: { include: { respondent: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  if (notesRaw.length === 0) {
    throw new Error("Ingen noter at analysere endnu — gennemfør nogle interviews i denne runde først.");
  }

  const notes: NoteForAnalysis[] = notesRaw.map((n) => ({
    id: n.id,
    category: n.category,
    content: n.content,
    respondentName: n.interview.respondent.name,
  }));

  const result = await generateJson<ThemeResult>({
    system:
      "Du er en dygtig kvalitativ researcher, der finder mønstre på tværs af mange interviewnoter. Skriv præcist og på dansk.",
    prompt: buildThemeAnalysisPrompt(round.name, notes),
    schema: THEME_SCHEMA as unknown as Record<string, unknown>,
    effort: "high",
  });

  await db.$transaction([
    db.themeCluster.deleteMany({ where: { interviewRoundId: roundId } }),
    ...result.themes.map((t) =>
      db.themeCluster.create({
        data: {
          engagementId: round.engagementId,
          interviewRoundId: roundId,
          title: t.title,
          summary: t.summary,
          noteIds: JSON.stringify(t.noteIds),
        },
      }),
    ),
  ]);

  return result.themes.length;
}

/*
  "Spørg på tværs" — institutionel hukommelse over ALLE interviews i ÉN
  interview-runde, ikke hele engagementet eller alle runder — to forskellige
  runder skal ikke blandes sammen i samme svar. Stateless: bygger kontekst af
  noter + gemte citater hver gang, ingen chatlog gemmes. Svaret citerer sine
  kilder, så man kan klikke videre til det interview det kommer fra.
*/

import { db } from "./db";
import { generateJson, hasApiKey, hasClaudeCli } from "./claude";

export const CROSS_QUERY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer", "sources"],
  properties: {
    answer: { type: "string", description: "Svaret på dansk, baseret udelukkende på konteksten." },
    sources: {
      type: "array",
      description: "De noter/citater der understøtter svaret.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["interviewId", "snippet"],
        properties: {
          interviewId: { type: "string" },
          snippet: { type: "string" },
        },
      },
    },
  },
} as const;

export type CrossQueryResult = {
  answer: string;
  sources: { interviewId: string; snippet: string }[];
};

export async function answerCrossQuery(
  roundId: string,
  question: string,
): Promise<CrossQueryResult> {
  if (!hasApiKey() && !hasClaudeCli()) {
    throw new Error("Sæt ANTHROPIC_API_KEY, eller sørg for at Claude CLI er installeret, for at spørge på tværs af interviews.");
  }
  if (!question.trim()) {
    throw new Error("Skriv et spørgsmål.");
  }

  const round = await db.interviewRound.findUniqueOrThrow({ where: { id: roundId } });

  const [notes, quotes] = await Promise.all([
    db.interviewNote.findMany({
      where: { interview: { interviewRoundId: roundId } },
      include: { interview: { include: { respondent: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    db.quote.findMany({
      where: { interview: { interviewRoundId: roundId } },
      include: { interview: { include: { respondent: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  if (notes.length === 0 && quotes.length === 0) {
    throw new Error("Der er ikke noget at søge i endnu — gennemfør nogle interviews i denne runde først.");
  }

  const context = [
    ...notes.map(
      (n) => `NOTE [interviewId=${n.interviewId}] (${n.category}, ${n.interview.respondent.name}): ${n.content}`,
    ),
    ...quotes.map((q) => `CITAT [interviewId=${q.interviewId}] (${q.interview.respondent.name}): "${q.text}"`),
  ].join("\n");

  return generateJson<CrossQueryResult>({
    system:
      "Du svarer på spørgsmål ved kun at bruge den viden der findes i de givne interviewnoter og citater. Svar aldrig ud fra generel viden. Sig det tydeligt hvis konteksten ikke indeholder svaret. Skriv på dansk.",
    prompt: `--- Noter og citater fra interviews i runden "${round.name}" ---\n${context}\n\n--- Spørgsmål ---\n${question}`,
    schema: CROSS_QUERY_SCHEMA as unknown as Record<string, unknown>,
    effort: "medium",
  });
}

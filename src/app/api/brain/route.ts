import type Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { requireEngagement } from "@/lib/engagement";
import {
  BRAIN_SYSTEM_PROMPT,
  buildBrainContext,
  getInterviewTranscript,
  getProposalDetail,
  getSystemReadinessDetail,
  searchInterviews,
} from "@/lib/brain";

// Fast id for systemlandskabets AI-parathedsrapport — den er beregnet, ikke
// en gemt AiosProposal, så den har ikke sit eget cuid til vedhæftning/hent_rapport.
const SYSTEM_READINESS_ID = "__system_readiness__";
import { hasApiKey, streamTextWithTools } from "@/lib/claude";

const TOOLS: Anthropic.Tool[] = [
  {
    name: "hent_interview_transskription",
    description:
      "Henter den fulde, rå spørgsmål-svar-transskription fra interviewet for én bestemt underproces. Brug det kun når spørgsmålet kræver detaljer, ordlyd eller nuancer der ikke fremgår af de kondenserede keynotes eller de kortlagte skridt.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["underprocesId"],
      properties: {
        underprocesId: {
          type: "string",
          description: "Underprocessens id, som det står i konteksten ([underproces-id: ...]).",
        },
      },
    },
  },
  {
    name: "sog_i_interviews",
    description:
      "Fritekstsøgning på tværs af ALLE underprocessers interviewnoter og rå transskriptioner. Brug det til at finde frem til det relevante underproces-id, når spørgsmålet nævner et emne uden selv at pege på en bestemt underproces (fx 'hvor har vi problemer med fakturering?').",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["sogetekst"],
      properties: {
        sogetekst: {
          type: "string",
          description: "Søgeordet eller -frasen, fx 'fakturering' eller 'manuelt workaround'.",
        },
      },
    },
  },
  {
    name: "hent_rapport",
    description:
      "Henter den fulde Forbedringsrapport for ét forslag — systemfunktioner, to-be-proces, ressourcer/kompetencer, ROI m.m. Brug rapport-id'et fra indekset i konteksten (eller fra en rapport brugeren selv har vedhæftet).",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["rapportId"],
      properties: {
        rapportId: {
          type: "string",
          description: "Rapportens id, som det står i konteksten ([rapport-id: ...]).",
        },
      },
    },
  },
  {
    name: "hent_system_parathed",
    description:
      "Henter den fulde AI-parathedsrapport for systemlandskabet — pr. system: åbne API'er, stamdata-hygiejne og løbende opdatering.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
];

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!hasApiKey()) {
    return NextResponse.json(
      { error: "Sæt ANTHROPIC_API_KEY i .env for at aktivere hjernen." },
      { status: 400 },
    );
  }

  const { messages, attachmentIds } = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
    attachmentIds?: string[];
  };

  const engagement = await requireEngagement();
  const context = await buildBrainContext(engagement.id);

  // Rapporter brugeren selv har vedhæftet med "+"-vælgeren — deres fulde
  // indhold injiceres direkte i denne tur, så agenten ikke behøver et
  // værktøjskald for noget brugeren allerede har lagt frem.
  let attachedContext = "";
  if (attachmentIds?.length) {
    const details = await Promise.all(
      attachmentIds.map((id) =>
        id === SYSTEM_READINESS_ID ? getSystemReadinessDetail(engagement.id) : getProposalDetail(id),
      ),
    );
    attachedContext = `\n\n---\n\n# Vedhæftet af brugeren\n\n${details.join("\n\n---\n\n")}`;
  }

  const stream = streamTextWithTools({
    system: `${BRAIN_SYSTEM_PROMPT}\n\n---\n\n${context}${attachedContext}`,
    messages,
    tools: TOOLS,
    effort: "medium",
    async runTool(name, input) {
      if (name === "hent_interview_transskription") {
        const { underprocesId } = input as { underprocesId?: string };
        if (!underprocesId) throw new Error("Mangler underprocesId i værktøjskaldet.");
        return getInterviewTranscript(underprocesId);
      }
      if (name === "sog_i_interviews") {
        const { sogetekst } = input as { sogetekst?: string };
        if (!sogetekst) throw new Error("Mangler sogetekst i værktøjskaldet.");
        return searchInterviews(engagement.id, sogetekst);
      }
      if (name === "hent_rapport") {
        const { rapportId } = input as { rapportId?: string };
        if (!rapportId) throw new Error("Mangler rapportId i værktøjskaldet.");
        return getProposalDetail(rapportId);
      }
      if (name === "hent_system_parathed") {
        return getSystemReadinessDetail(engagement.id);
      }
      throw new Error(`Ukendt værktøj: ${name}`);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

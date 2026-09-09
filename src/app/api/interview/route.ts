import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateJson, hasApiKey } from "@/lib/claude";
import {
  AGENT_TURN_SCHEMA,
  buildInterviewSystemPrompt,
  type AgentTurn,
} from "@/lib/interview";
import { generateMockTurn } from "@/lib/interview-mock";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const { interviewId, agentId, messages } = (await req.json()) as {
    interviewId?: string;
    agentId?: string;
    messages: { role: "agent" | "user"; content: string }[];
  };

  // Et rigtigt, afsendt interview har et interviewId; konsulentens "prøv
  // agenten selv"-preview har i stedet et rent agentId og gemmer intet.
  const agent = interviewId
    ? (await db.interview.findUnique({ where: { id: interviewId }, include: { interviewAgent: true } }))
        ?.interviewAgent
    : agentId
      ? await db.interviewAgent.findUnique({ where: { id: agentId } })
      : null;

  if (!agent) {
    return NextResponse.json({ error: "Interview-agenten findes ikke." }, { status: 404 });
  }

  const systemPrompt = buildInterviewSystemPrompt(agent);

  const transcript = messages.length
    ? messages
        .map((m) => `${m.role === "agent" ? "DIG" : "RESPONDENT"}: ${m.content}`)
        .join("\n\n")
    : "(interviewet er ikke begyndt — byd velkommen og stil dit første spørgsmål)";

  // Ingen API-nøgle sat endnu — kør et fast, gratis test-script i stedet for
  // at fejle. Slås fra af sig selv, så snart ANTHROPIC_API_KEY er sat.
  if (!hasApiKey()) {
    const agentTurnIndex = messages.filter((m) => m.role === "agent").length;
    const turn = generateMockTurn({ agentTurnIndex });
    return NextResponse.json({ ...turn, mock: true });
  }

  try {
    const turn = await generateJson<AgentTurn>({
      system: systemPrompt,
      prompt: `--- Samtalen indtil nu ---\n${transcript}\n\n--- Din tur ---`,
      schema: AGENT_TURN_SCHEMA as unknown as Record<string, unknown>,
      effort: "medium",
    });

    return NextResponse.json(turn);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

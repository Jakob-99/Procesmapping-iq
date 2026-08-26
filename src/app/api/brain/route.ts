import { NextResponse } from "next/server";
import { requireEngagement } from "@/lib/engagement";
import { BRAIN_SYSTEM_PROMPT, buildBrainContext } from "@/lib/brain";
import { hasApiKey, streamText } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!hasApiKey()) {
    return NextResponse.json(
      { error: "Sæt ANTHROPIC_API_KEY i .env for at aktivere hjernen." },
      { status: 400 },
    );
  }

  const { messages } = (await req.json()) as {
    messages: { role: "user" | "assistant"; content: string }[];
  };

  const engagement = await requireEngagement();
  const context = await buildBrainContext(engagement.id);

  const stream = streamText({
    system: `${BRAIN_SYSTEM_PROMPT}\n\n---\n\n${context}`,
    messages,
    effort: "medium",
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5";

let client: Anthropic | null = null;

export function claude() {
  if (!client) client = new Anthropic();
  return client;
}

export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/* Svar som ren tekst-stream — chat-UI'et læser den direkte. */
export function streamText(opts: {
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
}) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = claude().messages.stream({
          model: MODEL,
          max_tokens: opts.maxTokens ?? 64000,
          system: [
            { type: "text", text: opts.system, cache_control: { type: "ephemeral" } },
          ],
          thinking: { type: "adaptive" },
          output_config: { effort: opts.effort ?? "high" },
          messages: opts.messages,
        });

        stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
        await stream.finalMessage();
        controller.close();
      } catch (err) {
        const msg =
          err instanceof Anthropic.APIError
            ? `API-fejl ${err.status}: ${err.message}`
            : `Uventet fejl: ${String(err)}`;
        controller.enqueue(encoder.encode(`\n\n[${msg}]`));
        controller.close();
      }
    },
  });
}

/* Ét JSON-svar efter et skema. Bruges til analyse, forslag og test cases. */
export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  const res = await claude().messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: opts.system,
    thinking: { type: "adaptive" },
    output_config: {
      effort: opts.effort ?? "high",
      format: { type: "json_schema", schema: opts.schema },
    },
    messages: [{ role: "user", content: opts.prompt }],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Tomt svar fra modellen");
  return JSON.parse(text.text) as T;
}

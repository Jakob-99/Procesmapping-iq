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

/*
  Samme som streamText, men med værktøjer — til når agenten selv skal kunne
  vælge at hente mere data undervejs (fx den fulde interview-transskription)
  i stedet for at få alt foræret i forvejen. Streamer tekst løbende for hver
  tur, og kører automatisk endnu en tur, når modellen kalder et værktøj —
  indtil den svarer uden flere kald, eller loft'et er nået.
*/
export function streamTextWithTools(opts: {
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.Tool[];
  runTool: (name: string, input: unknown) => Promise<string>;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  maxTurns?: number;
}) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const messages = [...opts.messages];
        const maxTurns = opts.maxTurns ?? 4;

        for (let turn = 0; turn < maxTurns; turn++) {
          const stream = claude().messages.stream({
            model: MODEL,
            max_tokens: opts.maxTokens ?? 64000,
            system: [
              { type: "text", text: opts.system, cache_control: { type: "ephemeral" } },
            ],
            thinking: { type: "adaptive" },
            output_config: { effort: opts.effort ?? "high" },
            tools: opts.tools,
            messages,
          });

          stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
          const final = await stream.finalMessage();

          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );
          if (!toolUses.length) break;

          messages.push({ role: "assistant", content: final.content });
          const toolResults = await Promise.all(
            toolUses.map(async (tu): Promise<Anthropic.ToolResultBlockParam> => {
              try {
                return {
                  type: "tool_result" as const,
                  tool_use_id: tu.id,
                  content: await opts.runTool(tu.name, tu.input),
                };
              } catch (err) {
                // Et fejlende værktøjskald (ukendt værktøj, forkert id, DB-fejl)
                // skal ikke vælte hele svaret — giv Claude fejlen som et
                // tool_result med is_error, så den selv kan forklare brugeren
                // hvad der gik galt eller prøve et andet opslag.
                const message = err instanceof Error ? err.message : String(err);
                return {
                  type: "tool_result" as const,
                  tool_use_id: tu.id,
                  content: `Værktøjet fejlede: ${message}`,
                  is_error: true,
                };
              }
            }),
          );
          messages.push({ role: "user", content: toolResults });
        }

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

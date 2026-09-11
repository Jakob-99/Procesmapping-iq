import Anthropic from "@anthropic-ai/sdk";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";

export const MODEL = "claude-opus-5";

let client: Anthropic | null = null;

export function claude() {
  if (!client) client = new Anthropic();
  return client;
}

export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/*
  Alternativ til en betalt API-nøgle: kald den lokalt installerede Claude
  Code CLI som en subprocess og brug Jakobs eget abonnement som motor i
  stedet. Kun til lokal udvikling — kræver at `claude` er installeret og
  logget ind på maskinen appen kører på.

  Vigtigt: npm's Windows-shims (claude.cmd/.ps1) kan IKKE køres sikkert med
  argumenter som et array uden `shell: true` — men `shell: true` sender
  argumenterne igennem cmd.exe's tekst-parsing, hvilket både er usikkert
  (interview-transskriptioner indeholder respondentens egen fritekst, som
  kunne indeholde shell-metategn) og i praksis korrumperede flagene i test.
  Løsningen er at finde og kalde den rigtige .exe direkte — en almindelig
  Windows-eksekverbar kan trygt kaldes med et argument-array, ingen shell,
  ingen escaping-problemer.

  Selve OPSLAGET af stien bruger bevidst `npm root -g` (et Node-baseret
  værktøj, altså rigtig UTF-8-output) i stedet for Windows' eget `where.exe`
  — `where.exe` skriver konsol-output i den lokale OEM-kodeside, hvilket
  korrumperede danske bogstaver i brugerens filsti (Jakobs "ø" i
  "JakobBreumMøller" blev til "o", så exe'en aldrig blev fundet). `npm` er
  selv en .cmd-shim på Windows, men her er argumenterne ("root","-g") faste
  konstanter uden brugerdata, så `shell: true` er uden risiko netop her.
*/
const execFileAsync = promisify(execFile);
let cachedCliPath: string | null | undefined;

function resolveClaudeCliExecutable(): string | null {
  if (cachedCliPath !== undefined) return cachedCliPath;
  try {
    const globalRoot = execFileSync("npm", ["root", "-g"], {
      encoding: "utf8",
      shell: true,
      timeout: 5000,
    }).trim();
    const candidates =
      process.platform === "win32"
        ? [path.join(globalRoot, "@anthropic-ai", "claude-code", "bin", "claude.exe")]
        : [
            path.join(globalRoot, "@anthropic-ai", "claude-code", "bin", "claude"),
            path.join(globalRoot, "@anthropic-ai", "claude-code", "cli.js"),
          ];
    cachedCliPath = candidates.find((p) => fs.existsSync(p)) ?? null;
  } catch {
    cachedCliPath = null;
  }
  return cachedCliPath;
}

export function hasClaudeCli() {
  return resolveClaudeCliExecutable() !== null;
}

type CliResultEnvelope = {
  is_error: boolean;
  subtype: string;
  result?: string;
  structured_output?: unknown;
};

async function generateJsonViaCli<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  const exe = resolveClaudeCliExecutable();
  if (!exe) {
    throw new Error(
      "Hverken ANTHROPIC_API_KEY er sat eller Claude Code CLI fundet på maskinen — sæt en API-nøgle i .env, eller installér/log ind på `claude` lokalt.",
    );
  }

  const { stdout } = await execFileAsync(
    exe,
    [
      "-p",
      "--output-format", "json",
      "--tools", "",
      "--exclude-dynamic-system-prompt-sections",
      "--effort", opts.effort ?? "medium",
      "--system-prompt", opts.system,
      "--json-schema", JSON.stringify(opts.schema),
      // "--" markerer at resten er positionelle argumenter, ikke flag — uden
      // den fejltolker CLI'ens argument-parser en prompt der (som her) tit
      // starter med "---" (transcript-adskilleren i interview.ts) som et
      // ukendt flag i stedet for selve prompten.
      "--",
      opts.prompt,
    ],
    { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1024 * 1024 * 20, timeout: 120000 },
  );

  const envelope = JSON.parse(stdout) as CliResultEnvelope;
  if (envelope.is_error || envelope.subtype !== "success") {
    throw new Error(`Claude CLI-fejl: ${envelope.result ?? envelope.subtype}`);
  }
  if (envelope.structured_output !== undefined) return envelope.structured_output as T;
  if (!envelope.result) throw new Error("Tomt svar fra Claude CLI");
  return JSON.parse(envelope.result) as T;
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

/*
  Ét JSON-svar efter et skema. Bruges til analyse, forslag og test cases —
  og til interview-agentens egne spørgsmål/turn'e (se api/interview/route.ts).
  Går via den betalte API hvis en nøgle er sat, ellers via den lokale Claude
  Code CLI (se generateJsonViaCli ovenfor) hvis den findes på maskinen.
*/
export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
}): Promise<T> {
  if (!hasApiKey()) return generateJsonViaCli<T>(opts);

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

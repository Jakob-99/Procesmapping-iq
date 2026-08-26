import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateJson, hasApiKey } from "@/lib/claude";
import {
  AGENT_TURN_SCHEMA,
  INTERVIEW_SYSTEM_PROMPT,
  type AgentTurn,
} from "@/lib/interview";
import { generateMockTurn } from "@/lib/interview-mock";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const { subProcessId, messages } = (await req.json()) as {
    subProcessId: string;
    messages: { role: "agent" | "user"; content: string }[];
  };

  const sp = await db.subProcess.findUnique({
    where: { id: subProcessId },
    include: {
      process: { include: { engagement: true } },
      assignee: true,
      steps: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!sp) {
    return NextResponse.json({ error: "Underprocessen findes ikke." }, { status: 404 });
  }

  const [knownSystems, knownRoles, knownDataObjects] = await Promise.all([
    db.systemRef.findMany({
      where: { engagementId: sp.process.engagementId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    db.businessRole.findMany({
      where: { engagementId: sp.process.engagementId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    db.dataObject.findMany({
      where: { engagementId: sp.process.engagementId },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Agenten skal vide hvor den står, men ikke få svarene foræret.
  const context = [
    `Virksomhed: ${sp.process.engagement.name}`,
    `End-to-end proces: ${sp.process.name}`,
    `Underproces der interviewes om: ${sp.name}`,
    sp.startEvent && `Procesejeren har sat start: ${sp.startEvent}`,
    sp.endEvent && `Procesejeren har sat slut: ${sp.endEvent}`,
    sp.assignee && `Medarbejder: ${sp.assignee.name}, ${sp.assignee.title ?? "ukendt titel"}`,
    sp.steps.length
      ? `Allerede kortlagt: ${sp.steps.map((s) => s.name).join(" → ")}. Bekræft og udfyld hullerne frem for at starte forfra.`
      : "Intet er kortlagt endnu. Start bredt.",
    knownSystems.length
      ? `Systemer der allerede findes i kortlægningen: ${knownSystems.map((s) => s.name).join(", ")}. Nævner medarbejderen et af disse under et andet navn (forkortelse, kaldenavn), så genkend det som det samme system — spørg ikke agenten selv, brug dit skøn.`
      : null,
    knownRoles.length
      ? `Kendte roller: ${knownRoles.map((r) => r.name).join(", ")}. Match medarbejderens beskrivelse af hvem der gør noget mod en af disse, hvis den passer.`
      : null,
    knownDataObjects.length
      ? `Kendte dataobjekter: ${knownDataObjects.map((d) => d.name).join(", ")}. Match medarbejderens beskrivelse af oplysninger mod en af disse, hvis den passer.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const transcript = messages.length
    ? messages
        .map((m) => `${m.role === "agent" ? "DIG" : "MEDARBEJDER"}: ${m.content}`)
        .join("\n\n")
    : "(interviewet er ikke begyndt — byd velkommen og stil dit første spørgsmål)";

  // Ingen API-nøgle sat endnu — kør et fast, gratis test-script i stedet for
  // at fejle. Slås fra af sig selv, så snart ANTHROPIC_API_KEY er sat.
  if (!hasApiKey()) {
    const agentTurnIndex = messages.filter((m) => m.role === "agent").length;
    const turn = generateMockTurn({
      systemNames: knownSystems.map((s) => s.name),
      roleNames: knownRoles.map((r) => r.name),
      dataNames: knownDataObjects.map((d) => d.name),
      agentTurnIndex,
    });
    return NextResponse.json({ ...turn, mock: true });
  }

  try {
    const turn = await generateJson<AgentTurn>({
      system: INTERVIEW_SYSTEM_PROMPT,
      prompt: `${context}\n\n--- Samtalen indtil nu ---\n${transcript}\n\n--- Din tur ---`,
      schema: AGENT_TURN_SCHEMA as unknown as Record<string, unknown>,
      effort: "medium",
    });

    return NextResponse.json(turn);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

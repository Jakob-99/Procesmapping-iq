import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db";

// Alle tools er read-only og tager udgangspunkt i InterviewRound — det
// nærmeste appen har på "et gruppeinterview": en navngivet samling af
// afsendte 1:1-interviews man analyserer samlet (se model-kommentaren i
// prisma/schema.prisma). Hvert tool scoper altid til den engagementId som
// API-nøglen blev opløst til i auth.ts — aldrig til et id klienten selv
// angiver — så en nøgle for kunde A ikke kan bruges til at læse kunde B's
// runder blot ved at gætte et roundId.

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

async function assertRoundInEngagement(roundId: string, engagementId: string) {
  const round = await db.interviewRound.findUnique({
    where: { id: roundId },
    select: { id: true, engagementId: true, name: true },
  });
  if (!round || round.engagementId !== engagementId) return null;
  return round;
}

export function registerTools(server: McpServer, engagementId: string) {
  server.registerTool(
    "list_rounds",
    {
      title: "List interview rounds",
      description:
        "Lister engagementets interview-runder (gruppe-samlinger af afsendte interviews) med navn, oprettelsesdato og hvor mange interviews de indeholder.",
      inputSchema: {},
    },
    async () => {
      const rounds = await db.interviewRound.findMany({
        where: { engagementId },
        orderBy: { createdAt: "desc" },
        include: {
          interviews: { include: { interviewAgent: { select: { name: true } } } },
        },
      });

      return jsonResult(
        rounds.map((r) => ({
          id: r.id,
          name: r.name,
          createdAt: r.createdAt,
          interviewCount: r.interviews.length,
          completedCount: r.interviews.filter((i) => i.status === "COMPLETED").length,
          agentNames: [...new Set(r.interviews.map((i) => i.interviewAgent.name))],
        })),
      );
    },
  );

  server.registerTool(
    "get_round",
    {
      title: "Get interview round",
      description:
        "Henter én interview-rundes metadata og en liste af dens interviews (respondent, agent, status) — brug id fra list_rounds.",
      inputSchema: { roundId: z.string().describe("Id for interview-runden (fra list_rounds)") },
    },
    async ({ roundId }) => {
      const round = await assertRoundInEngagement(roundId, engagementId);
      if (!round) {
        return { content: [{ type: "text" as const, text: "Runden findes ikke." }], isError: true };
      }

      const interviews = await db.interview.findMany({
        where: { interviewRoundId: roundId },
        include: {
          respondent: { select: { name: true, email: true, title: true } },
          interviewAgent: { select: { name: true } },
        },
        orderBy: { startedAt: "desc" },
      });

      return jsonResult({
        id: round.id,
        name: round.name,
        interviews: interviews.map((i) => ({
          id: i.id,
          respondent: i.respondent.name,
          respondentTitle: i.respondent.title,
          agent: i.interviewAgent.name,
          status: i.status,
          startedAt: i.startedAt,
          completedAt: i.completedAt,
        })),
      });
    },
  );

  server.registerTool(
    "get_round_transcripts",
    {
      title: "Get round transcripts",
      description:
        "Henter de fulde samtale-transskriptioner for alle interviews i en runde — brug id fra list_rounds.",
      inputSchema: { roundId: z.string().describe("Id for interview-runden (fra list_rounds)") },
    },
    async ({ roundId }) => {
      const round = await assertRoundInEngagement(roundId, engagementId);
      if (!round) {
        return { content: [{ type: "text" as const, text: "Runden findes ikke." }], isError: true };
      }

      const interviews = await db.interview.findMany({
        where: { interviewRoundId: roundId },
        include: {
          respondent: { select: { name: true } },
          interviewAgent: { select: { name: true } },
          messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } },
        },
        orderBy: { startedAt: "desc" },
      });

      return jsonResult({
        roundName: round.name,
        interviews: interviews.map((i) => ({
          id: i.id,
          respondent: i.respondent.name,
          agent: i.interviewAgent.name,
          status: i.status,
          transcript: i.messages.map((m) => ({ role: m.role, content: m.content })),
        })),
      });
    },
  );

  server.registerTool(
    "get_interview_transcript",
    {
      title: "Get single interview transcript",
      description:
        "Henter den fulde transskription for ét enkelt interview — brug interviewId fra get_round eller get_round_transcripts. Billigere end get_round_transcripts når man kun skal bruge ét interview fra en stor runde.",
      inputSchema: { interviewId: z.string().describe("Id for interviewet (fra get_round eller get_round_transcripts)") },
    },
    async ({ interviewId }) => {
      const interview = await db.interview.findUnique({
        where: { id: interviewId },
        include: {
          respondent: { select: { name: true, title: true } },
          interviewAgent: { select: { name: true } },
          interviewRound: { select: { name: true } },
          messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } },
        },
      });
      if (!interview || interview.engagementId !== engagementId) {
        return { content: [{ type: "text" as const, text: "Interviewet findes ikke." }], isError: true };
      }

      return jsonResult({
        id: interview.id,
        roundName: interview.interviewRound.name,
        respondent: interview.respondent.name,
        respondentTitle: interview.respondent.title,
        agent: interview.interviewAgent.name,
        status: interview.status,
        startedAt: interview.startedAt,
        completedAt: interview.completedAt,
        transcript: interview.messages.map((m) => ({ role: m.role, content: m.content })),
      });
    },
  );
}

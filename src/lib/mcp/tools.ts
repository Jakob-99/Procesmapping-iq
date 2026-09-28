import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db";
import { INTEGRATION_LABELS, STEP_TYPE_LABELS, SUBPROCESS_STATUS, parseIntegrations, type StepType } from "@/lib/domain";
import { MASTER_DATA_QUALITY_LABELS, systemReadiness, VERDICT_LABELS } from "@/lib/readiness";

// MCP-værktøjer til procesmodellen. Hvert værktøj scoper altid til den
// engagementId som API-nøglen blev opløst til i auth.ts — aldrig til et id
// klienten selv angiver — så en nøgle for kunde A ikke kan bruges til at
// læse kunde B's processer blot ved at gætte et id. Alt er læsning, bortset
// fra add_finding, som kun tilføjer et analysepunkt.

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const statusLabel = (s: string) => SUBPROCESS_STATUS[s as keyof typeof SUBPROCESS_STATUS]?.label ?? s;
const typeLabel = (t: string) => STEP_TYPE_LABELS[t as StepType] ?? t;
const FINDING_LABELS: Record<string, string> = {
  PROBLEM: "Problem / finding",
  WISH: "Ønske / forbedring",
  IDEA: "Mulig idé",
};

async function subProcessInEngagement(subProcessId: string, engagementId: string) {
  const sp = await db.subProcess.findUnique({
    where: { id: subProcessId },
    select: { id: true, process: { select: { engagementId: true } } },
  });
  return sp && sp.process.engagementId === engagementId ? sp : null;
}

export function registerTools(server: McpServer, engagementId: string) {
  server.registerTool(
    "get_process_model",
    {
      title: "Hent procesmodellen",
      description:
        "Hele procesmodellen: kerne- og støtteprocesser med procesejer og deres underprocesser (grupper, status, ansvarlig, antal skridt og analysepunkter). Start her for at finde id'er til get_subprocess.",
      inputSchema: {},
    },
    async () => {
      const processes = await db.process.findMany({
        where: { engagementId },
        orderBy: { sortOrder: "asc" },
        include: {
          owner: { select: { name: true } },
          groups: { orderBy: { sortOrder: "asc" } },
          subProcesses: {
            orderBy: { sortOrder: "asc" },
            include: {
              assignee: { select: { name: true } },
              steps: { select: { stepType: true } },
              _count: { select: { findings: true } },
            },
          },
        },
      });
      return jsonResult(
        processes.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category === "CORE" ? "Kerneproces" : "Støtteproces",
          owner: p.owner?.name ?? null,
          subProcesses: p.subProcesses.map((sp) => ({
            id: sp.id,
            name: sp.name,
            group: p.groups.find((g) => g.id === sp.groupId)?.name ?? null,
            status: statusLabel(sp.status),
            inScope: sp.inScope,
            responsible: sp.assignee?.name ?? null,
            stepCount: sp.steps.filter((s) => s.stepType !== "START" && s.stepType !== "END").length,
            findingCount: sp._count.findings,
          })),
        })),
      );
    },
  );

  server.registerTool(
    "get_subprocess",
    {
      title: "Hent en underproces",
      description:
        "Én underproces med hele diagrammet: pools, svimlaner (rolle eller system), skridt i rækkefølge (type, aktør, systemer, data ind/ud, frekvens, varighed, smertepunkt), pile med etiketter, analysepunkter og noter.",
      inputSchema: { subProcessId: z.string().describe("Id fra get_process_model") },
    },
    async ({ subProcessId }) => {
      if (!(await subProcessInEngagement(subProcessId, engagementId))) return errorResult("Underprocessen findes ikke.");
      const sp = await db.subProcess.findUniqueOrThrow({
        where: { id: subProcessId },
        include: {
          process: { select: { name: true } },
          assignee: { select: { name: true } },
          pools: { orderBy: { sortOrder: "asc" } },
          lanes: { orderBy: { sortOrder: "asc" }, include: { actorRole: true, actorSystem: true } },
          steps: {
            orderBy: { sortOrder: "asc" },
            include: {
              actorRole: true,
              actorSystem: true,
              systems: { include: { system: true } },
              data: { include: { dataObject: true } },
            },
          },
          flows: true,
          findings: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
          notes: true,
        },
      });
      const stepName = new Map(sp.steps.map((s) => [s.id, s.name || typeLabel(s.stepType)]));
      return jsonResult({
        id: sp.id,
        process: sp.process.name,
        name: sp.name,
        status: statusLabel(sp.status),
        responsible: sp.assignee?.name ?? null,
        summary: sp.summary,
        pools: [sp.name, ...sp.pools.map((p) => p.name)],
        lanes: sp.lanes
          .filter((l) => !l.isDefault)
          .map((l) => ({
            actor: l.actorRole?.name ?? l.actorSystem?.name,
            kind: l.actorSystemId ? "system" : "rolle",
            pool: sp.pools.find((p) => p.id === l.poolId)?.name ?? sp.name,
          })),
        steps: sp.steps.map((s) => ({
          id: s.id,
          type: typeLabel(s.stepType),
          name: s.name,
          actor: s.actorRole?.name ?? s.actorSystem?.name ?? null,
          systems: s.systems.map((l) => l.system.name),
          dataIn: s.data.filter((d) => d.direction !== "OUTPUT").map((d) => d.dataObject.name),
          dataOut: s.data.filter((d) => d.direction === "OUTPUT" || d.direction === "BOTH").map((d) => d.dataObject.name),
          frequency: s.frequency,
          durationMin: s.durationMin,
          painPoint: s.painPoint,
          decisionCriteria: s.decisionCriteria,
          output: s.output,
        })),
        flows: sp.flows.map((f) => ({
          from: stepName.get(f.fromStepId),
          to: stepName.get(f.toStepId),
          label: f.label,
          kind: f.kind === "MESSAGE" ? "besked" : "forløb",
        })),
        findings: sp.findings.map((f) => ({
          kind: FINDING_LABELS[f.kind] ?? f.kind,
          text: f.text,
          step: f.stepId ? stepName.get(f.stepId) ?? null : null,
        })),
        notes: sp.notes.map((n) => n.text).filter(Boolean),
      });
    },
  );

  server.registerTool(
    "list_systems",
    {
      title: "List systemer",
      description:
        "Systemlandskabet: kategori, master data, integration (åbent API, agent-adgang), AI-parathed og hvilke underprocesser og skridt systemet bruges i.",
      inputSchema: {},
    },
    async () => {
      const systems = await db.systemRef.findMany({
        where: { engagementId },
        orderBy: { name: "asc" },
        include: {
          stepLinks: { include: { step: { include: { subProcess: { select: { name: true } } } } } },
          dataLinks: { select: { name: true } },
        },
      });
      return jsonResult(
        systems.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          isMasterData: s.isMasterData,
          hasOpenApi: s.hasOpenApi,
          canAgentConnect: s.canAgentConnect,
          integrations: parseIntegrations(s.integrations).map((t) => INTEGRATION_LABELS[t]),
          masterDataQuality: s.masterDataQuality
            ? MASTER_DATA_QUALITY_LABELS[s.masterDataQuality as keyof typeof MASTER_DATA_QUALITY_LABELS]
            : null,
          aiReadiness: VERDICT_LABELS[systemReadiness(s).verdict].label,
          notes: s.notes,
          ownsData: s.dataLinks.map((d) => d.name),
          usedIn: s.stepLinks.map((l) => ({ subProcess: l.step.subProcess.name, step: l.step.name })),
        })),
      );
    },
  );

  server.registerTool(
    "list_roles_and_data",
    {
      title: "List roller og data",
      description: "Rollerne i forretningen og dataobjekterne (med ejersystem), og hvor mange skridt de indgår i.",
      inputSchema: {},
    },
    async () => {
      const [roles, data] = await Promise.all([
        db.businessRole.findMany({
          where: { engagementId },
          orderBy: { name: "asc" },
          include: { _count: { select: { steps: true } } },
        }),
        db.dataObject.findMany({
          where: { engagementId },
          orderBy: { name: "asc" },
          include: { ownerSystem: { select: { name: true } }, _count: { select: { stepLinks: true } } },
        }),
      ]);
      return jsonResult({
        roles: roles.map((r) => ({ id: r.id, name: r.name, description: r.description, stepCount: r._count.steps })),
        dataObjects: data.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
          isMasterData: d.isMasterData,
          ownerSystem: d.ownerSystem?.name ?? null,
          stepCount: d._count.stepLinks,
        })),
      });
    },
  );

  server.registerTool(
    "list_findings",
    {
      title: "List analysepunkter",
      description:
        "Analysepunkterne på tværs af alle underprocesser: problemer/findings, ønsker og forbedringer, og mulige ideer — med proces, underproces og evt. skridt.",
      inputSchema: {
        kind: z.enum(["PROBLEM", "WISH", "IDEA"]).optional().describe("Kun én slags; udelad for alle"),
      },
    },
    async ({ kind }) => {
      const findings = await db.processFinding.findMany({
        where: { subProcess: { process: { engagementId } }, ...(kind ? { kind } : {}) },
        orderBy: [{ subProcessId: "asc" }, { kind: "asc" }, { sortOrder: "asc" }],
        include: {
          step: { select: { name: true } },
          subProcess: { select: { id: true, name: true, process: { select: { name: true } } } },
        },
      });
      return jsonResult(
        findings.map((f) => ({
          kind: FINDING_LABELS[f.kind] ?? f.kind,
          text: f.text,
          process: f.subProcess.process.name,
          subProcess: f.subProcess.name,
          subProcessId: f.subProcess.id,
          step: f.step?.name ?? null,
        })),
      );
    },
  );

  server.registerTool(
    "add_finding",
    {
      title: "Tilføj analysepunkt",
      description:
        "Tilføjer et analysepunkt til en underproces — et problem/finding, et ønske/forbedring eller en mulig idé — evt. koblet til et skridt. Punktet vises i underprocessens analyse i Corner IQ.",
      inputSchema: {
        subProcessId: z.string().describe("Id fra get_process_model"),
        kind: z.enum(["PROBLEM", "WISH", "IDEA"]),
        text: z.string().min(1).describe("Kort og konkret, på dansk"),
        stepId: z.string().optional().describe("Id på skridtet punktet handler om (fra get_subprocess)"),
      },
    },
    async ({ subProcessId, kind, text, stepId }) => {
      if (!(await subProcessInEngagement(subProcessId, engagementId))) return errorResult("Underprocessen findes ikke.");
      let validStepId: string | null = null;
      if (stepId) {
        const step = await db.processStep.findUnique({ where: { id: stepId }, select: { subProcessId: true } });
        if (step?.subProcessId === subProcessId) validStepId = stepId;
      }
      const last = await db.processFinding.findFirst({
        where: { subProcessId, kind },
        orderBy: { sortOrder: "desc" },
      });
      const f = await db.processFinding.create({
        data: { subProcessId, kind, text: text.trim(), stepId: validStepId, sortOrder: (last?.sortOrder ?? -1) + 1 },
      });
      return jsonResult({ ok: true, id: f.id });
    },
  );
}

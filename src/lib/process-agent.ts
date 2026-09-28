import { db } from "./db";
import { generateJson } from "./claude";

/*
  Proces-agenten bag chatten under diagrammet.

  Agenten får hele underprocessen som den ser ud nu (svimlaner, skridt, pile,
  systemer og data pr. skridt) plus samtalen indtil nu, og svarer med en kort
  besked og — hvis noget skal ændres — HELE den nye udgave af processen.
  Hele udgaven i stedet for små "tilføj/slet"-kommandoer, fordi det er
  robust over for alt man kan finde på at bede om (flyt tre skridt, del en
  svimlane op, omdøb alt) og kun kræver én diff-funktion her.

  Eksisterende skridt beholder deres id, så felter agenten ikke ser
  (frekvens, varighed, smertepunkt, …) overlever en ændring. Et id der ikke
  findes i forvejen betyder et nyt skridt. Roller, systemer og dataobjekter
  matches på navn mod engagementets lister og oprettes, hvis de mangler.
*/

import { STEP_TYPES, isGateway, type StepType } from "./domain";

type AgentLane = { name: string; kind: "role" | "system"; pool: string };
type AgentFinding = { id: string; kind: "PROBLEM" | "WISH" | "IDEA"; text: string; step: string };
type AgentStep = {
  id: string;
  type: StepType;
  name: string;
  lane: string;
  systems: string[];
  data: { name: string; direction: "INPUT" | "OUTPUT" }[];
};
type AgentFlow = { from: string; to: string; label: string; kind: "SEQUENCE" | "MESSAGE" };
type AgentProcess = {
  summary: string;
  pools: string[];
  lanes: AgentLane[];
  steps: AgentStep[];
  flows: AgentFlow[];
  findings: AgentFinding[];
};
type AgentResult = { reply: string; changed: boolean; process?: AgentProcess };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "changed"],
  properties: {
    reply: { type: "string" },
    changed: { type: "boolean" },
    process: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "pools", "lanes", "steps", "flows", "findings"],
      properties: {
        summary: { type: "string" },
        pools: { type: "array", items: { type: "string" } },
        lanes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "kind", "pool"],
            properties: {
              name: { type: "string" },
              kind: { type: "string", enum: ["role", "system"] },
              pool: { type: "string" },
            },
          },
        },
        findings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "kind", "text", "step"],
            properties: {
              id: { type: "string" },
              kind: { type: "string", enum: ["PROBLEM", "WISH", "IDEA"] },
              text: { type: "string" },
              step: { type: "string" },
            },
          },
        },
        steps: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "type", "name", "lane", "systems", "data"],
            properties: {
              id: { type: "string" },
              type: { type: "string", enum: [...STEP_TYPES] },
              name: { type: "string" },
              lane: { type: "string" },
              systems: { type: "array", items: { type: "string" } },
              data: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "direction"],
                  properties: {
                    name: { type: "string" },
                    direction: { type: "string", enum: ["INPUT", "OUTPUT"] },
                  },
                },
              },
            },
          },
        },
        flows: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["from", "to", "label", "kind"],
            properties: {
              from: { type: "string" },
              to: { type: "string" },
              label: { type: "string" },
              kind: { type: "string", enum: ["SEQUENCE", "MESSAGE"] },
            },
          },
        },
      },
    },
  },
} as const;

const SYSTEM = `Du er Cornerstones' proces-agent. Du hjælper en konsulent eller procesejer med at kortlægge og rette ét procesdiagram (en underproces) ved at tale sammen på dansk.

Diagrammet er et svimlane-diagram i BPMN-stil:
- Svimlaner er lodrette kolonner, én pr. aktør. En aktør er enten en rolle (fx "Onboarding-koordinator", "Partner") eller et system der selv udfører skridtet (fx "Kanpla"). Skridt uden aktør ligger i den grundlæggende svimlane "Proces" — angiv da lane som tom streng "".
- Forløbet løber nedad. Rækkefølgen i steps-listen ER rækkefølgen oppefra og ned, så læg skridtene i den rækkefølge forløbet faktisk sker.
- Skridttyper: START (starthændelse, fx "Ny medarbejder er ansat"), END (sluthændelse, fx "Stillingen er publiceret" — der må gerne være flere, én pr. udfald), TASK (aktivitet, navngivet i bydeform: "Registrér timer", "Send velkomstmail"), TIMER (tidshændelse, fx "Hver onsdag", "Senest kl. 11 dagen før"), og fire gateways som i BPMN — name er spørgsmålet eller tom streng:
  - DECISION: eksklusiv gateway (X) — præcis én af vejene vælges. De udgående pile har hver sin etiket, fx "Ferie"/"Arbejdsdag".
  - PARALLEL: parallel gateway (+) — alle udgående veje kører samtidig; bruges også til at samle parallelle spor igen.
  - INCLUSIVE: inklusiv gateway (O) — én eller flere af vejene, afhængigt af betingelser på pilene.
  - EVENT_GATEWAY: hændelsesbaseret gateway — den første hændelse der indtræffer (fx et svar eller en timer) afgør vejen.
- systems på et skridt er de IT-systemer aktiviteten bruges i (vises som [Outlook] under aktiviteten).
- data på et skridt er dokumenter/dataobjekter aktiviteten læser (INPUT) eller producerer (OUTPUT), fx "Jobprofil".
- Følg dokumenterne videre: når en senere aktivitet bruger et dokument, et tidligere skridt har produceret (fx "Send opslaget" bruger "Stillingsopslag"), så sæt det også som INPUT på den aktivitet — med nøjagtig samme navn. Diagrammet tegner selv pilen fra det eksisterende dokument, hvis de står tæt.
- flows er pilene. kind SEQUENCE er det almindelige forløb; MESSAGE er en stiplet besked til en ekstern part (fx en rekrutteringspartner). label er tom streng medmindre pilen går ud fra en beslutning eller skal forklares.
- pools er ekstra rammer ved siden af hovedpoolen (som har underprocessens navn), typisk en ekstern part som "Rekrutteringspartner". En svimlanes pool angives med poolens navn; tom streng "" = hovedpoolen. Opret kun en ekstra pool når brugeren beder om det, eller når en part tydeligt er ekstern og kun kommunikeres med via besked-pile. Pools der ikke står i listen fjernes (deres svimlaner flytter til hovedpoolen).

Analysen under diagrammet er findings, i tre slags:
- PROBLEM: problemer og findings i processen i dag (flaskehalse, dobbeltarbejde, manuelle indtastninger, fejl, ventetid).
- WISH: ønsker og forbedringer som brugeren eller organisationen giver udtryk for.
- IDEA: mulige ideer der er diskuteret — konkrete løsningsforslag, fx automatisering eller en AI-agent.
step er id på det skridt punktet handler om, eller tom streng hvis det gælder hele processen. Eksisterende punkter beholder deres id; nye får et nyt id som "ny-f1". Når brugeren nævner et problem, et ønske eller en idé — også i forbifarten mens I kortlægger — så notér det som et punkt, formuleret kort og konkret på dansk. Du må gerne selv pege på et åbenlyst problem du ser i forløbet, men skriv kun det der kan begrundes i processen eller samtalen; opfind ingen tal.

Regler:
- Ændr kun det brugeren beder om. Bevar alt andet præcis, også id'er.
- Eksisterende skridt SKAL beholde deres id. Nye skridt får et nyt id du selv finder på, fx "ny-1", "ny-2", og pile til/fra dem bruger samme id.
- Genbrug navne fra kataloget (roller, systemer, data) når det er samme ting — stav dem ens. Nye navne oprettes automatisk.
- Start-, slut- og timerhændelser ligger i svimlanen hos den aktør der starter, afslutter eller venter (fx starthændelsen hos den der modtager ordren, timeren "Hver onsdag" hos den der handler på den). Brug kun den grundlæggende svimlane (lane "") når processen slet ingen aktører har endnu.
- Er start- eller sluthændelsen stadig den generiske "Start"/"Slut", så giv den et konkret navn så snart forløbet er kendt (fx "Planen for ugen er kendt", "Antallet er rettet"). Har forløbet flere udfald, så giv hvert udfald sin egen sluthændelse.
- Hver svimlane i lanes skal have mindst ét skridt; lanes-listen bestemmer kolonnernes rækkefølge fra venstre mod højre.
- Et gyldigt diagram har mindst én START og én END, og alle skridt hænger sammen med pile.
- Hvis brugeren kun spørger om noget eller er uklar, så svar/spørg ind i reply, sæt changed=false og udelad process.
- Når du ændrer noget — også når du kun noterer et analysepunkt: sæt changed=true og returnér HELE processen i process (pools, lanes, steps, flows, findings og summary — en til tre sætninger på dansk der beskriver forløbet i ord).
- reply er kort, på dansk, i almindeligt forretningssprog: hvad du har ændret, eller dit svar. Ingen tekniske id'er i reply.`;

function norm(s: string) {
  return s.trim().toLowerCase();
}

async function loadState(subProcessId: string) {
  const sp = await db.subProcess.findUniqueOrThrow({
    where: { id: subProcessId },
    include: {
      process: true,
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
      pools: { orderBy: { sortOrder: "asc" } },
      lanes: { orderBy: { sortOrder: "asc" }, include: { actorRole: true, actorSystem: true } },
      chatMessages: { orderBy: { createdAt: "asc" } },
      findings: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  const engagementId = sp.process.engagementId;
  const [roles, systems, dataObjects] = await Promise.all([
    db.businessRole.findMany({ where: { engagementId }, orderBy: { name: "asc" } }),
    db.systemRef.findMany({ where: { engagementId }, orderBy: { name: "asc" } }),
    db.dataObject.findMany({ where: { engagementId }, orderBy: { name: "asc" } }),
  ]);
  return { sp, engagementId, roles, systems, dataObjects };
}

type State = Awaited<ReturnType<typeof loadState>>;

function describe(state: State) {
  const { sp } = state;
  return {
    process: sp.process.name,
    subProcess: sp.name,
    summary: sp.summary ?? "",
    pools: sp.pools.map((p) => p.name),
    lanes: sp.lanes
      .filter((l) => !l.isDefault)
      .map((l) => ({
        name: l.actorRole?.name ?? l.actorSystem?.name ?? "",
        kind: l.actorSystemId ? "system" : "role",
        pool: sp.pools.find((p) => p.id === l.poolId)?.name ?? "",
      })),
    findings: sp.findings.map((f) => ({ id: f.id, kind: f.kind, text: f.text, step: f.stepId ?? "" })),
    steps: sp.steps.map((s) => ({
      id: s.id,
      type: s.stepType,
      name: s.name,
      lane: s.actorRole?.name ?? s.actorSystem?.name ?? "",
      systems: s.systems.map((l) => l.system.name),
      data: s.data.map((l) => ({
        name: l.dataObject.name,
        direction: l.direction === "OUTPUT" ? "OUTPUT" : "INPUT",
      })),
    })),
    flows: sp.flows.map((f) => ({
      from: f.fromStepId,
      to: f.toStepId,
      label: f.label ?? "",
      kind: f.kind,
    })),
    catalog: {
      roles: state.roles.map((r) => r.name),
      systems: state.systems.map((s) => s.name),
      dataObjects: state.dataObjects.map((d) => d.name),
    },
  };
}

export async function runProcessAgent(subProcessId: string): Promise<{ reply: string; changed: boolean }> {
  const state = await loadState(subProcessId);
  const history = state.sp.chatMessages.slice(-24);

  const prompt = [
    "Processen som den ser ud nu:",
    JSON.stringify(describe(state), null, 1),
    "",
    "Samtalen indtil nu (sidste besked er den du skal svare på):",
    ...history.map((m) => `${m.role === "user" ? "Bruger" : "Agent"}: ${m.content}`),
  ].join("\n");

  const result = await generateJson<AgentResult>({
    system: SYSTEM,
    prompt,
    schema: SCHEMA as unknown as Record<string, unknown>,
    effort: "medium",
  });

  if (result.changed && result.process) {
    await applyProcess(state, result.process);
    return { reply: result.reply, changed: true };
  }
  return { reply: result.reply, changed: false };
}

async function applyProcess(state: State, next: AgentProcess) {
  const { sp, engagementId } = state;
  const subProcessId = sp.id;

  // ---- Katalog: find eller opret roller/systemer/data ud fra navn
  const roleByName = new Map(state.roles.map((r) => [norm(r.name), r.id]));
  const systemByName = new Map(state.systems.map((s) => [norm(s.name), s.id]));
  const dataByName = new Map(state.dataObjects.map((d) => [norm(d.name), d.id]));

  async function roleId(name: string) {
    const key = norm(name);
    let id = roleByName.get(key);
    if (!id) {
      id = (await db.businessRole.create({ data: { engagementId, name: name.trim() } })).id;
      roleByName.set(key, id);
    }
    return id;
  }
  async function systemId(name: string) {
    const key = norm(name);
    let id = systemByName.get(key);
    if (!id) {
      id = (await db.systemRef.create({ data: { engagementId, name: name.trim() } })).id;
      systemByName.set(key, id);
    }
    return id;
  }
  async function dataId(name: string) {
    const key = norm(name);
    let id = dataByName.get(key);
    if (!id) {
      id = (await db.dataObject.create({ data: { engagementId, name: name.trim() } })).id;
      dataByName.set(key, id);
    }
    return id;
  }

  // ---- Svimlaner: aktør pr. navn, i den rækkefølge agenten angiver
  const laneKind = new Map<string, "role" | "system">();
  for (const l of next.lanes) if (l.name.trim()) laneKind.set(norm(l.name), l.kind);

  const actorByLaneName = new Map<string, { actorRoleId: string | null; actorSystemId: string | null }>();
  async function actorFor(laneName: string) {
    const key = norm(laneName);
    if (!key || key === "proces") return { actorRoleId: null, actorSystemId: null };
    const cached = actorByLaneName.get(key);
    if (cached) return cached;
    // Uden eksplicit art: et navn der allerede findes som system er et system,
    // ellers en rolle.
    const kind = laneKind.get(key) ?? (systemByName.has(key) && !roleByName.has(key) ? "system" : "role");
    const actor =
      kind === "system"
        ? { actorRoleId: null, actorSystemId: await systemId(laneName) }
        : { actorRoleId: await roleId(laneName), actorSystemId: null };
    actorByLaneName.set(key, actor);
    return actor;
  }

  // ---- Pools: find eller opret pr. navn, i agentens rækkefølge; resten slettes
  // (deres svimlaner falder tilbage til hovedpoolen via onDelete: SetNull).
  const poolIdByName = new Map<string, string>();
  const keptPoolIds = new Set<string>();
  for (let i = 0; i < (next.pools ?? []).length; i++) {
    const name = next.pools[i].trim();
    const key = norm(name);
    if (!key || poolIdByName.has(key)) continue;
    const found = sp.pools.find((p) => norm(p.name) === key);
    const pool = found
      ? await db.processPool.update({ where: { id: found.id }, data: { sortOrder: i, name } })
      : await db.processPool.create({ data: { subProcessId, name, sortOrder: i } });
    poolIdByName.set(key, pool.id);
    keptPoolIds.add(pool.id);
  }
  for (const p of sp.pools) {
    if (!keptPoolIds.has(p.id)) await db.processPool.delete({ where: { id: p.id } });
  }
  const poolOfLane = new Map<string, string | null>();
  for (const l of next.lanes) {
    if (!l.name.trim()) continue;
    const poolKey = norm(l.pool ?? "");
    poolOfLane.set(norm(l.name), poolKey ? poolIdByName.get(poolKey) ?? null : null);
  }

  const wantedLanes: { actorRoleId: string | null; actorSystemId: string | null; poolId: string | null }[] = [];
  const laneNames = [
    ...next.lanes.map((l) => l.name),
    ...next.steps.map((s) => s.lane),
  ].filter((n) => n.trim() && norm(n) !== "proces");
  const seen = new Set<string>();
  for (const n of laneNames) {
    const key = norm(n);
    if (seen.has(key)) continue;
    seen.add(key);
    wantedLanes.push({ ...(await actorFor(n)), poolId: poolOfLane.get(key) ?? null });
  }

  const existingLanes = sp.lanes.filter((l) => !l.isDefault);
  const keptLaneIds = new Set<string>();
  for (let i = 0; i < wantedLanes.length; i++) {
    const w = wantedLanes[i];
    const found = existingLanes.find(
      (l) => l.actorRoleId === w.actorRoleId && l.actorSystemId === w.actorSystemId,
    );
    if (found) {
      keptLaneIds.add(found.id);
      await db.processLane.update({ where: { id: found.id }, data: { sortOrder: i + 1, poolId: w.poolId } });
    } else {
      const created = await db.processLane.create({ data: { subProcessId, ...w, sortOrder: i + 1 } });
      keptLaneIds.add(created.id);
    }
  }
  for (const l of existingLanes) {
    if (!keptLaneIds.has(l.id)) await db.processLane.delete({ where: { id: l.id } });
  }

  // ---- Skridt: opdatér de kendte, opret de nye, slet de forsvundne
  const existingIds = new Set(sp.steps.map((s) => s.id));
  const idMap = new Map<string, string>();
  const keptStepIds = new Set<string>();

  for (let i = 0; i < next.steps.length; i++) {
    const s = next.steps[i];
    const type: StepType = STEP_TYPES.includes(s.type) ? s.type : "TASK";
    const actor = await actorFor(s.lane);
    const data = {
      stepType: type,
      name: s.name.trim() || (isGateway(type) ? "" : "Unavngivet skridt"),
      sortOrder: i,
      ...actor,
    };
    if (existingIds.has(s.id) && !keptStepIds.has(s.id)) {
      await db.processStep.update({ where: { id: s.id }, data });
      idMap.set(s.id, s.id);
      keptStepIds.add(s.id);
    } else {
      const created = await db.processStep.create({ data: { subProcessId, ...data } });
      idMap.set(s.id, created.id);
      keptStepIds.add(created.id);
    }
  }
  const removed = sp.steps.filter((s) => !keptStepIds.has(s.id)).map((s) => s.id);
  if (removed.length) await db.processStep.deleteMany({ where: { id: { in: removed } } });

  // ---- Systemer og data pr. skridt: sæt præcis den liste agenten angiver
  for (const s of next.steps) {
    const stepId = idMap.get(s.id)!;
    const current = sp.steps.find((x) => x.id === stepId);

    const wantedSystems = new Set<string>();
    for (const name of s.systems) if (name.trim()) wantedSystems.add(await systemId(name));
    for (const link of current?.systems ?? []) {
      if (!wantedSystems.has(link.systemId)) await db.stepSystem.delete({ where: { id: link.id } });
    }
    for (const sysId of wantedSystems) {
      await db.stepSystem.upsert({
        where: { stepId_systemId: { stepId, systemId: sysId } },
        update: {},
        create: { stepId, systemId: sysId, usage: "BOTH" },
      });
    }

    const wantedData = new Map<string, "INPUT" | "OUTPUT">();
    for (const d of s.data) if (d.name.trim()) wantedData.set(await dataId(d.name), d.direction);
    for (const link of current?.data ?? []) {
      if (!wantedData.has(link.dataObjectId)) await db.stepData.delete({ where: { id: link.id } });
    }
    for (const [dataObjectId, direction] of wantedData) {
      await db.stepData.upsert({
        where: { stepId_dataObjectId: { stepId, dataObjectId } },
        update: { direction },
        create: { stepId, dataObjectId, direction },
      });
    }
  }

  // ---- Pile: erstattes helt
  await db.processFlow.deleteMany({ where: { subProcessId } });
  const pairs = new Set<string>();
  for (const f of next.flows) {
    const from = idMap.get(f.from);
    const to = idMap.get(f.to);
    if (!from || !to || from === to) continue;
    const key = `${from}>${to}`;
    if (pairs.has(key)) continue;
    pairs.add(key);
    await db.processFlow.create({
      data: {
        subProcessId,
        fromStepId: from,
        toStepId: to,
        label: f.label.trim() || null,
        kind: f.kind === "MESSAGE" ? "MESSAGE" : "SEQUENCE",
      },
    });
  }

  // ---- Analyse: kendte punkter opdateres, nye oprettes, forsvundne slettes
  const existingFindingIds = new Set(sp.findings.map((f) => f.id));
  const keptFindingIds = new Set<string>();
  const orderByKind = new Map<string, number>();
  for (const f of next.findings ?? []) {
    const kind = ["PROBLEM", "WISH", "IDEA"].includes(f.kind) ? f.kind : "PROBLEM";
    if (!f.text.trim()) continue;
    const sortOrder = orderByKind.get(kind) ?? 0;
    orderByKind.set(kind, sortOrder + 1);
    const data = { kind, text: f.text.trim(), stepId: (f.step && idMap.get(f.step)) || null, sortOrder };
    if (existingFindingIds.has(f.id) && !keptFindingIds.has(f.id)) {
      await db.processFinding.update({ where: { id: f.id }, data });
      keptFindingIds.add(f.id);
    } else {
      const created = await db.processFinding.create({ data: { subProcessId, ...data } });
      keptFindingIds.add(created.id);
    }
  }
  const removedFindings = sp.findings.filter((f) => !keptFindingIds.has(f.id)).map((f) => f.id);
  if (removedFindings.length) await db.processFinding.deleteMany({ where: { id: { in: removedFindings } } });

  await db.subProcess.update({
    where: { id: subProcessId },
    data: {
      summary: next.summary.trim() || null,
      status: sp.status === "NOT_STARTED" ? "DRAFT" : sp.status,
    },
  });
}

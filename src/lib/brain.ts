import { db } from "./db";
import {
  AIOS_BUILDING_BLOCKS,
  BUILD_TARGETS,
  RESOURCE_READINESS_LABELS,
  parseJsonList,
  type BuildTarget,
  type ResourceReadiness,
  type SystemFunction,
  type ToBeStep,
} from "./aios";
import { MASTER_DATA_QUALITY_LABELS, VERDICT_LABELS, systemReadiness } from "./readiness";

/*
  Hjernens kontekst.

  Vi serialiserer hele procesgrafen til tekst og lægger den i systemprompten.
  Det holder til en virksomhed af den her størrelse. Når grafen bliver for stor
  til ét vindue, skifter vi til opslag pr. proces — men indtil da er den fulde
  kontekst både billigere og markant mere præcis end retrieval.
*/
export async function buildBrainContext(engagementId: string) {
  const engagement = await db.engagement.findUnique({
    where: { id: engagementId },
    include: {
      organization: true,
      systems: true,
      dataObjects: { include: { ownerSystem: true } },
      businessRoles: true,
      processes: {
        orderBy: { sortOrder: "asc" },
        include: {
          owner: true,
          subProcesses: {
            where: { inScope: true },
            orderBy: { sortOrder: "asc" },
            include: {
              assignee: true,
              steps: {
                orderBy: { sortOrder: "asc" },
                include: {
                  systems: { include: { system: true } },
                  data: { include: { dataObject: true } },
                  actorRole: true,
                },
              },
              interviews: { include: { notes: true } },
            },
          },
        },
      },
    },
  });

  if (!engagement) return "";

  const L: string[] = [];

  L.push(`# Virksomhed: ${engagement.organization.name}`);
  if (engagement.organization.industry) L.push(`Branche: ${engagement.organization.industry}`);
  L.push(`Forløb: ${engagement.name} (fase: ${engagement.stage})`);

  if (engagement.strategicGoals) L.push(`\n## Strategiske mål\n${engagement.strategicGoals}`);
  if (engagement.processModel) L.push(`\n## Overordnet procesmodel\n${engagement.processModel}`);
  if (engagement.masterDataNote) L.push(`\n## Master data og platform\n${engagement.masterDataNote}`);

  L.push(`\n## Systemlandskab`);
  for (const s of engagement.systems) {
    L.push(`- ${s.name}${s.category ? ` (${s.category})` : ""}${s.isMasterData ? " [master data]" : ""}${s.canAgentConnect ? " [agent-tilgængelig]" : ""}${s.notes ? ` — ${s.notes}` : ""}`);
  }

  L.push(`\n## Dataobjekter`);
  for (const d of engagement.dataObjects) {
    L.push(`- ${d.name}${d.ownerSystem ? ` — ejes af ${d.ownerSystem.name}` : ""}${d.description ? `: ${d.description}` : ""}`);
  }

  L.push(`\n## Roller`);
  for (const r of engagement.businessRoles) {
    L.push(`- ${r.name}${r.description ? `: ${r.description}` : ""}`);
  }

  L.push(`\n## Processer`);
  for (const p of engagement.processes) {
    L.push(`\n### ${p.name}`);
    if (p.owner) L.push(`Procesejer: ${p.owner.name}`);
    if (p.startEvent || p.endEvent) L.push(`Start: ${p.startEvent ?? "?"} → Slut: ${p.endEvent ?? "?"}`);
    if (p.description) L.push(p.description);

    for (const sp of p.subProcesses) {
      L.push(`\n#### ${sp.name} — status: ${sp.status} [underproces-id: ${sp.id}]`);
      if (sp.assignee) L.push(`Kortlagt af: ${sp.assignee.name}`);
      if (sp.summary) L.push(sp.summary);

      if (sp.steps.length) {
        L.push(`Skridt:`);
        for (const st of sp.steps) {
          const sys = st.systems.map((x) => x.system.name).join(", ") || "ingen";
          const dat = st.data.map((x) => x.dataObject.name).join(", ") || "ingen";
          const meta = [
            st.actorRole && `udføres af ${st.actorRole.name}`,
            st.isManual ? "manuel" : "automatiseret",
            st.frequency && `frekvens: ${st.frequency}`,
            st.durationMin && `${st.durationMin} min`,
          ]
            .filter(Boolean)
            .join(", ");
          L.push(`  ${st.sortOrder + 1}. ${st.name} [${st.stepType}] (${meta})`);
          L.push(`     systemer: ${sys} | data: ${dat}`);
          if (st.painPoint) L.push(`     smertepunkt: ${st.painPoint}`);
        }
      }

      const notes = sp.interviews.flatMap((i) => i.notes);
      if (notes.length) {
        L.push(`Noter fra interview:`);
        for (const n of notes) L.push(`  - [${n.category}] ${n.content}`);
      }
    }
  }

  L.push(await buildReportsIndex(engagementId));

  return L.join("\n");
}

/*
  Letvægts-indeks over Forbedringsrapporterne og systemlandskabets
  AI-parathedsrapport — IKKE den fulde rapport. Agenten skal altid være
  bevidst om hvad der findes (id, navn, hvad den handler om), men henter
  først den fulde rapport med hent_rapport/hent_system_parathed når et
  konkret spørgsmål rent faktisk kræver detaljerne. Samme afvejning som
  interview-transskriptionerne: fuld tekst for alt ville drukne prompten.
*/
async function buildReportsIndex(engagementId: string) {
  const [proposals, systems] = await Promise.all([
    db.aiosProposal.findMany({
      where: { improvement: { engagementId } },
      include: { improvement: { include: { process: true, subProcess: true } } },
    }),
    db.systemRef.findMany({ where: { engagementId } }),
  ]);

  const L: string[] = [`\n## Forbedringsrapporter [rapport-id'er til hent_rapport]`];
  if (!proposals.length) {
    L.push("Ingen forbedringsrapporter endnu.");
  } else {
    for (const p of proposals) {
      const where = p.improvement.subProcess?.name ?? p.improvement.process?.name ?? "på tværs af flere processer";
      L.push(`- [rapport-id: ${p.id}] "${p.name}" — ${p.description} — berører ${where}`);
    }
  }

  const verdicts = systems.map((s) => systemReadiness(s).verdict);
  const ready = verdicts.filter((v) => v === "READY").length;
  L.push(`\n## AI-parathedsrapport [systemlandskab]`);
  L.push(
    `${ready}/${systems.length} systemer i landskabet er fuldt klar til AI (åbne API'er, ren stamdata, løbende opdatering). Hent fuld rapport med hent_system_parathed.`,
  );

  return L.join("\n");
}

/*
  Fuld Forbedringsrapport for ét forslag — det samme grundlag som vises på
  /improvements/[id]. Hentes på agentens eget initiativ (hent_rapport), eller
  injiceres direkte af route.ts når brugeren selv har vedhæftet rapporten
  med "+"-vælgeren i Hjernen.
*/
export async function getProposalDetail(proposalId: string) {
  const p = await db.aiosProposal.findUnique({
    where: { id: proposalId },
    include: {
      improvement: { include: { process: true, subProcess: true } },
      processLinks: { include: { process: true } },
    },
  });
  if (!p) return "Ingen forbedringsrapport fundet med det id.";

  const L: string[] = [`# ${p.name}`];
  if (p.strategicGoal) L.push(`Hjælper på strategisk mål: ${p.strategicGoal}`);
  L.push(`Lag: ${p.layer === "ORCHESTRATION" ? "Orkestrering (flere e2e-processer)" : "Ét procesområde"}`);
  L.push(`\nFlaskehalsen: ${p.improvement.title}\n${p.improvement.bottleneck}`);
  if (p.improvement.rationale) L.push(`Begrundelse: ${p.improvement.rationale}`);
  L.push(`\nBeskrivelse: ${p.description}`);
  if (p.howItWorks) L.push(`\nSådan virker det: ${p.howItWorks}`);
  if (p.example) L.push(`\nEksempel: ${p.example}`);
  if (p.roiEstimate) L.push(`\nEstimeret afkast: ${p.roiEstimate}`);

  const buildsInto = parseJsonList<BuildTarget>(p.buildsInto);
  if (buildsInto.length) {
    L.push(`\nBygges ind i: ${buildsInto.map((b) => BUILD_TARGETS[b]?.label ?? b).join(" og ")}`);
  }

  if (p.resourceReadiness) {
    const readiness = RESOURCE_READINESS_LABELS[p.resourceReadiness as ResourceReadiness];
    L.push(`\nRessourcer & kompetencer: ${readiness?.label ?? p.resourceReadiness}${p.resourceNotes ? ` — ${p.resourceNotes}` : ""}`);
  }

  if (p.requiresSystem) {
    const fns = parseJsonList<SystemFunction>(p.systemFunctions);
    if (fns.length) {
      L.push(`\nAIOS-systemets funktioner:`);
      for (const f of fns) L.push(`- ${AIOS_BUILDING_BLOCKS[f.block]?.label ?? f.block}: ${f.description}`);
    }
  }

  const steps = parseJsonList<ToBeStep>(p.toBeSteps);
  if (steps.length) {
    L.push(`\nTo-be-processen:`);
    for (const s of steps) {
      L.push(`- ${s.name}${s.actorRole ? ` (${s.actorRole})` : ""}${s.isAi ? " [AI]" : ""}${s.description ? `: ${s.description}` : ""}`);
    }
  }

  const roles = parseJsonList<string>(p.rolesAffected);
  const systemsUsed = parseJsonList<string>(p.systemsUsed);
  const dataUsed = parseJsonList<string>(p.dataUsed);
  L.push(
    `\nBerører — processer: ${p.processLinks.map((l) => l.process.name).join(", ") || "—"} | roller: ${roles.join(", ") || "—"} | systemer: ${systemsUsed.join(", ") || "—"} | data: ${dataUsed.join(", ") || "—"}`,
  );

  return L.join("\n");
}

/*
  Fuld AI-parathedsrapport for systemlandskabet — det samme grundlag som
  vises på /landscape/readiness.
*/
export async function getSystemReadinessDetail(engagementId: string) {
  const systems = await db.systemRef.findMany({ where: { engagementId }, orderBy: { name: "asc" } });
  if (!systems.length) return "Ingen systemer kortlagt endnu.";

  const L: string[] = [
    "# AI-parathedsrapport — systemlandskab",
    "Kriterier: åbne API'er med tilbageskrivning, ren og konsistent stamdata, og løbende (ikke efterslæbt) opdatering.",
  ];
  for (const s of systems) {
    const { verdict } = systemReadiness(s);
    L.push(`\n## ${s.name} — ${VERDICT_LABELS[verdict].label}`);
    const quality = s.masterDataQuality
      ? MASTER_DATA_QUALITY_LABELS[s.masterDataQuality as keyof typeof MASTER_DATA_QUALITY_LABELS]
      : "ikke vurderet";
    L.push(
      `Åbne API'er: ${s.hasOpenApi ? "ja" : "nej"} | Stamdata-hygiejne: ${quality} | Løbende opdatering: ${s.processesUpToDate ? "ja" : "nej"}`,
    );
    if (s.readinessNotes) L.push(`Noter: ${s.readinessNotes}`);
  }
  return L.join("\n");
}

/*
  Den fulde, rå spørgsmål-svar-transskription for en underproces' interview(s)
  — bevidst IKKE en del af buildBrainContext(). Konteksten ovenfor giver kun de
  kondenserede keynotes (smertepunkt/workaround/risiko), fordi hele
  transskriptionen for alle underprocesser ville drukne prompten i støj for
  spørgsmål, der ikke har brug for det. Agenten henter selv denne funktion via
  et værktøj, kun for den ene underproces der er relevant for spørgsmålet.
*/
export async function getInterviewTranscript(subProcessId: string) {
  const interviews = await db.interview.findMany({
    where: { subProcessId },
    include: {
      user: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { startedAt: "asc" },
  });

  if (!interviews.length) return "Der findes intet interview for denne underproces endnu.";

  return interviews
    .map((iv) => {
      const header = `Interview med ${iv.user.name} (${iv.status === "COMPLETED" ? "afsluttet" : "i gang"})`;
      const lines = iv.messages.map(
        (m) => `${m.role === "agent" ? "AGENT" : "MEDARBEJDER"}: ${m.content}`,
      );
      return `${header}\n${lines.join("\n")}`;
    })
    .join("\n\n---\n\n");
}

/*
  Fritekstsøgning på tværs af ALLE underprocessers interviewnoter og rå
  transskriptioner. Lukker hullet fra hent_interview_transskription, som
  kræver at man allerede kender underproces-id'et: her kan agenten finde
  frem til den relevante underproces selv, ud fra et emne i spørgsmålet
  ("hvor har vi problemer med fakturering?") i stedet for at være afhængig
  af at id'et allerede stod i konteksten.
*/
export async function searchInterviews(engagementId: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return "Angiv en søgetekst.";

  const [notes, messages] = await Promise.all([
    db.interviewNote.findMany({
      where: { interview: { subProcess: { process: { engagementId } } } },
      include: { interview: { include: { subProcess: { include: { process: true } } } } },
    }),
    db.interviewMessage.findMany({
      where: { interview: { subProcess: { process: { engagementId } } } },
      include: { interview: { include: { subProcess: { include: { process: true } } } } },
    }),
  ]);

  const matchedNotes = notes.filter((n) => n.content.toLowerCase().includes(q)).slice(0, 20);
  const matchedMessages = messages.filter((m) => m.content.toLowerCase().includes(q)).slice(0, 20);

  if (!matchedNotes.length && !matchedMessages.length) {
    return `Ingen match på "${query}" i interviewnoter eller -transskriptioner.`;
  }

  const L: string[] = [];
  if (matchedNotes.length) {
    L.push("Match i interviewnoter (keynotes):");
    for (const n of matchedNotes) {
      const sp = n.interview.subProcess;
      L.push(
        `- [underproces-id: ${sp.id}] ${sp.process.name} / ${sp.name} — [${n.category}] ${n.content}`,
      );
    }
  }
  if (matchedMessages.length) {
    L.push("\nMatch i rå transskription:");
    for (const m of matchedMessages) {
      const sp = m.interview.subProcess;
      L.push(
        `- [underproces-id: ${sp.id}] ${sp.process.name} / ${sp.name} — ${m.role === "agent" ? "AGENT" : "MEDARBEJDER"}: ${m.content}`,
      );
    }
  }
  return L.join("\n");
}

export const BRAIN_SYSTEM_PROMPT = `Du er Corner IQ — virksomhedens hjerne.

Du kender virksomhedens processer, data og systemer i detaljen, fordi de er
kortlagt gennem interviews med de medarbejdere der udfører arbejdet. Konteksten
nedenfor ER virksomheden som den ser ud i dag.

Hver underproces har et [underproces-id: ...]. Konteksten indeholder kun de
kondenserede keynotes fra interviewet (smertepunkt/workaround/risiko), ikke den
fulde samtale. Har du brug for detaljer, ordlyd eller nuancer der ikke er
fanget i keynotes eller de kortlagte skridt — brug værktøjet
hent_interview_transskription med det relevante underproces-id. Brug det kun
når det konkrete spørgsmål faktisk kræver det, ikke som standard for hvert svar.

Nævner spørgsmålet et emne uden at pege på en bestemt underproces (fx "hvor
har vi problemer med fakturering?"), så brug først værktøjet sog_i_interviews
til at finde frem til det relevante underproces-id — gæt aldrig ud fra
navnet på processer/underprocesser alene.

Konteksten indeholder også et indeks over alle Forbedringsrapporter — forslag
til hvordan AIOS-systemer og andre løsninger kan forbedre eksisterende
processer — samt en AI-parathedsrapport for systemlandskabet. Du kender kun overskrifterne fra
indekset, ikke det fulde indhold. Har spørgsmålet brug for detaljerne i en
konkret rapport — eller har brugeren selv vedhæftet én med "+"-vælgeren, hvis
fulde indhold står i en separat sektion herunder — brug værktøjet hent_rapport
med rapport-id'et. Skal du vurdere systemlandskabets AI-parathed i detalje,
brug hent_system_parathed.

Sådan svarer du:
- Svar på dansk, kort og konkret. Ingen indledende høflighedsfraser.
- Henvis altid til den konkrete proces, underproces eller det skridt du bygger på.
- Beskriver du hvordan noget gøres, så nævn hvilke systemer og data der er i spil.
- Er svaret ikke i konteksten (og heller ikke i transskriptionen efter opslag),
  så sig det klart og foreslå hvem der bør interviewes. Gæt aldrig på hvordan
  en proces fungerer.
- Er noget kortlagt men ikke valideret, så nævn det.

Kortlægningen beskriver nutiden — hvad der faktisk gøres, ikke hvad der burde gøres.`;

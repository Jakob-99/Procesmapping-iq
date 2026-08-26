import { db } from "./db";

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
      L.push(`\n#### ${sp.name} — status: ${sp.status}`);
      if (sp.assignee) L.push(`Kortlagt af: ${sp.assignee.name}`);
      if (sp.summary) L.push(sp.summary);

      if (sp.steps.length) {
        L.push(`Skridt:`);
        for (const st of sp.steps) {
          const sys = st.systems.map((x) => x.system.name).join(", ") || "ingen";
          const dat = st.data.map((x) => x.dataObject.name).join(", ") || "ingen";
          const meta = [
            st.actorRole && `udføres af ${st.actorRole}`,
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

  return L.join("\n");
}

export const BRAIN_SYSTEM_PROMPT = `Du er Corner IQ — virksomhedens hjerne.

Du kender virksomhedens processer, data og systemer i detaljen, fordi de er
kortlagt gennem interviews med de medarbejdere der udfører arbejdet. Konteksten
nedenfor ER virksomheden som den ser ud i dag.

Sådan svarer du:
- Svar på dansk, kort og konkret. Ingen indledende høflighedsfraser.
- Henvis altid til den konkrete proces, underproces eller det skridt du bygger på.
- Beskriver du hvordan noget gøres, så nævn hvilke systemer og data der er i spil.
- Er svaret ikke i konteksten, så sig det klart og foreslå hvem der bør interviewes.
  Gæt aldrig på hvordan en proces fungerer.
- Er noget kortlagt men ikke valideret, så nævn det.

Kortlægningen beskriver nutiden — hvad der faktisk gøres, ikke hvad der burde gøres.`;

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/*
  Fylder Forbedringer op til 6 forslag med tilfældige (placeholder) AIOS-idéer,
  uden at røre den øvrige demodata. Kør med: npx tsx prisma/seed-improvements-extra.ts
  Idempotent — gør ingenting hvis der allerede er 6 eller flere forslag.
*/
async function main() {
  const engagement = await db.engagement.findFirst({ orderBy: { createdAt: "asc" } });
  if (!engagement) throw new Error("Intet engagement fundet.");

  const existing = await db.aiosProposal.count();
  if (existing >= 6) {
    console.log(`Der er allerede ${existing} forslag — gør ingenting.`);
    return;
  }

  const processes = await db.process.findMany({ where: { engagementId: engagement.id } });
  if (!processes.length) throw new Error("Ingen processer fundet.");

  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

  const IDEAS = [
    {
      title: "Manuel opfølgning på forsinkede leverancer",
      bottleneck: "Ingen automatisk overvågning af leveringsdatoer — opdages først når kunden ringer.",
      lever: "IMPROVE",
      name: "Leverance-overvåger",
      description: "Holder øje med lovede leveringsdatoer og flager afvigelser, før kunden mærker dem.",
      systems: ["Microsoft Dynamics NAV", "Outlook"],
      data: ["Salgsordre", "Leveringsaftale"],
    },
    {
      title: "Kundehenvendelser besvares enkeltvis",
      bottleneck: "Standardspørgsmål om ordrestatus tager tid fra de sager der kræver et menneske.",
      lever: "VOLUME",
      name: "Ordrestatus-assistent",
      description: "Svarer automatisk på simple statusspørgsmål via mail, og eskalerer resten.",
      systems: ["Outlook", "HubSpot"],
      data: ["Salgsordre", "Kunde"],
    },
    {
      title: "Lagertal opdateres med forsinkelse",
      bottleneck: "Lagerbeholdning tjekkes manuelt flere gange dagligt i et separat system.",
      lever: "DIFFERENT",
      name: "Lagersynk-agent",
      description: "Holder lagertal synkroniseret på tværs af systemer i realtid frem for stikprøver.",
      systems: ["Astro WMS", "Microsoft Dynamics NAV"],
      data: ["Lagerbeholdning", "Vare"],
    },
    {
      title: "Rykkerprocedure køres manuelt hver måned",
      bottleneck: "Bogholderen samler forfaldne fakturaer manuelt og skriver rykkere en for en.",
      lever: "VOLUME",
      name: "Rykker-agent",
      description: "Genkender forfaldne fakturaer og sender første rykker automatisk efter faste regler.",
      systems: ["Microsoft Dynamics NAV"],
      data: ["Faktura", "Kunde"],
    },
  ];

  const need = Math.min(6 - existing, IDEAS.length);

  for (let i = 0; i < need; i++) {
    const idea = IDEAS[i];
    const process = pick(processes);
    const layer = Math.random() < 0.3 ? "ORCHESTRATION" : "PROCESS";

    const improvement = await db.improvement.create({
      data: {
        engagementId: engagement.id,
        processId: process.id,
        title: idea.title,
        bottleneck: idea.bottleneck,
        lever: idea.lever,
        isCrossProcess: layer === "ORCHESTRATION",
      },
    });

    await db.aiosProposal.create({
      data: {
        improvementId: improvement.id,
        name: idea.name,
        layer,
        description: idea.description,
        scoreStrategic: 2 + Math.floor(Math.random() * 4),
        scoreImpact: 2 + Math.floor(Math.random() * 4),
        scoreFeasibility: 2 + Math.floor(Math.random() * 4),
        sourceKind: "AGENT",
        systemsUsed: JSON.stringify(idea.systems),
        dataUsed: JSON.stringify(idea.data),
      },
    });
  }

  console.log(`Tilføjede ${need} forslag.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/*
  Demodata for procesmappingen: en organisation med en lille procesmodel,
  et par roller, systemer og dataobjekter, og én kortlagt underproces
  (Ordremodtagelse) med beslutning, systemer og data i diagrammet.
*/
async function main() {
  await db.organization.deleteMany();

  // ConsultantAccount (admin-panelets login) rammes IKKE af deleteMany
  // ovenfor — den er global og skal overleve at kunde-demodata gensås.
  // Upsert så genkørsel af seedet ikke fejler på det unikke mail-felt.
  await db.consultantAccount.upsert({
    where: { email: "jakob@cornerstones.dk" },
    update: {},
    create: { email: "jakob@cornerstones.dk", name: "Jakob Breum Møller", role: "ADMIN" },
  });
  // Jakobs egen mail — så han altid kan logge ind i /admin uden at skulle
  // huske demo-mailen ovenfor.
  await db.consultantAccount.upsert({
    where: { email: "jakob.breum.moller@gmail.com" },
    update: {},
    create: { email: "jakob.breum.moller@gmail.com", name: "Jakob Breum Møller", role: "ADMIN" },
  });

  const org = await db.organization.create({
    data: { name: "Nordvest Industri A/S", industry: "Produktion og engros" },
  });

  const [fde, , owner1] = await Promise.all(
    [
      { email: "jakob@cornerstones.dk", name: "Jakob Breum Møller", role: "FDE", title: "Senior konsulent" },
      // Samme mail som konsulent-loginet ovenfor, men et almindeligt
      // kunde-sæde — så Jakob også kan logge ind på kundefladen med sin
      // egen mail uden at skulle huske demo-mailen.
      { email: "jakob.breum.moller@gmail.com", name: "Jakob Breum Møller", role: "FDE", title: "Senior konsulent" },
      { email: "mette@nordvest.dk", name: "Mette Krogh", role: "PROCESS_OWNER", title: "HR-chef" },
    ].map((u) => db.user.create({ data: { ...u, organizationId: org.id } })),
  );

  const engagement = await db.engagement.create({
    data: { name: "Procesmodel 2026", organizationId: org.id },
  });

  // Giv begge konsulentkonti adgang til demo-engagementet i /admin —
  // ConsultantEngagementAccess rammes af organization.deleteMany ovenfor
  // (cascade via Engagement), så uden dette ville reseed stille og roligt
  // fjerne adgangen igen, og "Mine kunder" ville se tom ud efter et reseed.
  const consultantAccounts = await db.consultantAccount.findMany();
  await Promise.all(
    consultantAccounts.map((c) =>
      db.consultantEngagementAccess.create({
        data: { consultantId: c.id, engagementId: engagement.id },
      }),
    ),
  );

  // ------------------------------------------------------ aktører og objekter
  const [salg, lager, bogholder] = await Promise.all(
    ["Ordrebehandler", "Lagerkoordinator", "Bogholder"].map((name) =>
      db.businessRole.create({ data: { engagementId: engagement.id, name } }),
    ),
  );
  const [erp, outlook] = await Promise.all([
    db.systemRef.create({
      data: { engagementId: engagement.id, name: "Business Central", category: "ERP", isMasterData: true, hasOpenApi: true },
    }),
    db.systemRef.create({
      data: { engagementId: engagement.id, name: "Outlook", category: "Mail og kalender", hasOpenApi: true, canAgentConnect: true },
    }),
  ]);
  const [ordre, faktura] = await Promise.all([
    db.dataObject.create({ data: { engagementId: engagement.id, name: "Salgsordre", ownerSystemId: erp.id } }),
    db.dataObject.create({ data: { engagementId: engagement.id, name: "Faktura", ownerSystemId: erp.id } }),
  ]);

  // ---------------------------------------------------------------- processer
  const o2c = await db.process.create({
    data: { engagementId: engagement.id, name: "Order to Cash", category: "CORE", ownerId: owner1.id, sortOrder: 0 },
  });
  await db.process.create({
    data: { engagementId: engagement.id, name: "Økonomi", category: "SUPPORT", sortOrder: 1 },
  });

  const sub = await db.subProcess.create({
    data: {
      processId: o2c.id,
      name: "Ordremodtagelse",
      status: "DRAFT",
      summary:
        "Ordrebehandleren opretter ordren i Business Central, når den kommer ind pr. mail. Lageret plukker og sender, og bogholderen fakturerer.",
    },
  });
  await db.processLane.create({ data: { subProcessId: sub.id, isDefault: true } });
  const lanes = [salg, lager, bogholder];
  for (let i = 0; i < lanes.length; i++) {
    await db.processLane.create({ data: { subProcessId: sub.id, actorRoleId: lanes[i].id, sortOrder: i + 1 } });
  }

  const specs = [
    { key: "start", type: "START", name: "Ordre modtaget pr. mail", role: salg },
    { key: "opret", type: "TASK", name: "Opret salgsordre", role: salg, systems: [outlook, erp], data: [{ obj: ordre, dir: "OUTPUT" }] },
    { key: "lagerbeslutning", type: "DECISION", name: "", role: salg },
    { key: "rest", type: "TASK", name: "Informér kunden om restordre", role: salg, systems: [outlook] },
    { key: "pluk", type: "TASK", name: "Pluk og pak ordren", role: lager, systems: [erp], data: [{ obj: ordre, dir: "INPUT" }] },
    { key: "fakturer", type: "TASK", name: "Udsted faktura", role: bogholder, systems: [erp], data: [{ obj: faktura, dir: "OUTPUT" }] },
    { key: "slut", type: "END", name: "Ordren er faktureret", role: bogholder },
  ] as const;
  const ids = new Map<string, string>();
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    const step = await db.processStep.create({
      data: { subProcessId: sub.id, stepType: s.type, name: s.name, actorRoleId: s.role.id, sortOrder: i },
    });
    ids.set(s.key, step.id);
    for (const sys of "systems" in s ? s.systems : []) {
      await db.stepSystem.create({ data: { stepId: step.id, systemId: sys.id, usage: "BOTH" } });
    }
    for (const d of "data" in s ? s.data : []) {
      await db.stepData.create({ data: { stepId: step.id, dataObjectId: d.obj.id, direction: d.dir } });
    }
  }
  const flows: [string, string, string?][] = [
    ["start", "opret"],
    ["opret", "lagerbeslutning"],
    ["lagerbeslutning", "pluk", "På lager"],
    ["lagerbeslutning", "rest", "Ikke på lager"],
    ["rest", "pluk"],
    ["pluk", "fakturer"],
    ["fakturer", "slut"],
  ];
  for (const [from, to, label] of flows) {
    await db.processFlow.create({
      data: { subProcessId: sub.id, fromStepId: ids.get(from)!, toStepId: ids.get(to)!, label: label ?? null },
    });
  }

  void fde;

  console.log("Seed færdig.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

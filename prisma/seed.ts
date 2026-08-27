import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/*
  Demodata: en dansk producent midt i kortlægningen. Nok kød på til at
  hjernen kan svare på rigtige spørgsmål, og til at analysen har noget at bide i.
*/
async function main() {
  await db.organization.deleteMany();
  await db.consultantLogEntry.deleteMany();
  await db.consultant.deleteMany();

  // ConsultantAccount (admin-panelets login) rammes IKKE af deleteMany
  // ovenfor — den er global og skal overleve at kunde-demodata gensås.
  // Upsert så genkørsel af seedet ikke fejler på det unikke mail-felt.
  await db.consultantAccount.upsert({
    where: { email: "jakob@cornerstones.dk" },
    update: {},
    create: { email: "jakob@cornerstones.dk", name: "Jakob Breum Møller", role: "ADMIN" },
  });

  const org = await db.organization.create({
    data: { name: "Nordvest Industri A/S", industry: "Produktion og engros" },
  });

  const [fde, owner1, owner2, emp1, emp2, emp3] = await Promise.all(
    [
      { email: "jakob@cornerstones.dk", name: "Jakob Breum Møller", role: "FDE", title: "Senior konsulent" },
      { email: "mette@nordvest.dk", name: "Mette Krogh", role: "PROCESS_OWNER", title: "Salgschef" },
      { email: "anders@nordvest.dk", name: "Anders Lind", role: "PROCESS_OWNER", title: "Logistikchef" },
      { email: "sofie@nordvest.dk", name: "Sofie Dahl", role: "EMPLOYEE", title: "Ordrebehandler" },
      { email: "kasper@nordvest.dk", name: "Kasper Ø. Nielsen", role: "EMPLOYEE", title: "Lagerkoordinator" },
      { email: "louise@nordvest.dk", name: "Louise Hein", role: "EMPLOYEE", title: "Bogholder" },
    ].map((u) => db.user.create({ data: { ...u, organizationId: org.id } })),
  );

  const engagement = await db.engagement.create({
    data: {
      name: "AI-native transformation 2026",
      organizationId: org.id,
      stage: "MAPPING",
      strategicGoals:
        "1) Halvere gennemløbstiden fra ordre til levering inden udgangen af 2027.\n" +
        "2) Vokse 30% i omsætning uden at øge administrationen.\n" +
        "3) Gøre leveringspræcision til det kunderne vælger os på.",
      processModel:
        "Fire e2e-processer: Order to Cash, Purchase to Pay, Plan to Produce og Hire to Retire. " +
        "Order to Cash er valgt som første fokusområde, fordi det rører flest kunder og flest systemer.",
      masterDataNote:
        "Navision er master på kunde-, vare- og finansdata. HubSpot er master på leads indtil " +
        "de bliver til kunder. Lagerbeholdning ligger i WMS og synkroniseres til Navision hver nat — " +
        "hvilket er kilden til en del af de fejl vi hører om.",
    },
  });

  // ---------------------------------------------------------------- systemer
  const mk = (
    name: string,
    category: string,
    isMasterData = false,
    notes?: string,
    canAgentConnect = false,
  ) =>
    db.systemRef.create({
      data: { engagementId: engagement.id, name, category, isMasterData, notes, canAgentConnect },
    });

  const [nav, hubspot, wms, mail, excel, bi] = await Promise.all([
    mk("Microsoft Dynamics NAV", "ERP", true, "Kerne-ERP. Master på kunde, vare og finans.", true),
    mk("HubSpot", "CRM", true, "Salgspipeline og kundedialog frem til ordre.", true),
    mk("Astro WMS", "Lager", false, "Lagerstyring. Synkroniseres til NAV natligt.", true),
    mk("Outlook", "Mail", false, "Ordrer og godkendelser flyder stadig via mail.", false),
    mk("Excel — Ordreoverblik", "Fil", false, "Sofies eget regneark. Findes ikke officielt.", false),
    mk("Power BI", "BI", false, "Ledelsesrapportering, opdateres ugentligt.", false),
  ]);

  // AI-parathed pr. system — eksempeldata til AI-parathedsrapporten (/landscape/readiness).
  await Promise.all([
    db.systemRef.update({
      where: { id: nav.id },
      data: {
        hasOpenApi: true,
        masterDataQuality: "GOOD",
        processesUpToDate: true,
        readinessNotes: "OData-API med tilbageskrivning. Varekartotek og kundedata holdes rent af bogholderiet.",
      },
    }),
    db.systemRef.update({
      where: { id: hubspot.id },
      data: { hasOpenApi: true, masterDataQuality: "GOOD", processesUpToDate: true },
    }),
    db.systemRef.update({
      where: { id: wms.id },
      data: {
        hasOpenApi: false,
        masterDataQuality: "GOOD",
        processesUpToDate: false,
        readinessNotes: "Varenumre er konsistente, da de synkes fra NAV — men kun natligt. Ingen realtids-API, lagerbevægelser eftertastes.",
      },
    }),
    db.systemRef.update({
      where: { id: excel.id },
      data: {
        hasOpenApi: false,
        masterDataQuality: "POOR",
        processesUpToDate: false,
        readinessNotes: "Findes ikke officielt — intet API, ingen governance, ajourføres manuelt af Sofie.",
      },
    }),
  ]);

  // ------------------------------------------------------------ dataobjekter
  const mkData = (name: string, description: string, ownerSystemId?: string, isMasterData = false) =>
    db.dataObject.create({
      data: { engagementId: engagement.id, name, description, ownerSystemId, isMasterData },
    });

  const [kunde, ordre, vare, lager, faktura, levering] = await Promise.all([
    mkData("Kunde", "Stamdata, betalingsbetingelser og kreditmaks", nav.id, true),
    mkData("Salgsordre", "Linjer, priser, ønsket leveringsdato", nav.id),
    mkData("Vare", "Varenummer, mål, vægt, leverandør", nav.id, true),
    mkData("Lagerbeholdning", "Antal på hylde pr. lokation", wms.id),
    mkData("Faktura", "Fakturahoved og linjer", nav.id),
    mkData("Leveringsaftale", "Aftalt dato og fragtmetode", excel.id),
  ]);

  // ------------------------------------------------------------------ proces
  const o2c = await db.process.create({
    data: {
      engagementId: engagement.id,
      name: "Order to Cash",
      description:
        "Fra kunden sender en forespørgsel til pengene står på kontoen.",
      startEvent: "Kundeforespørgsel modtaget",
      endEvent: "Betaling registreret",
      ownerId: owner1.id,
      sortOrder: 0,
    },
  });

  const p2p = await db.process.create({
    data: {
      engagementId: engagement.id,
      name: "Purchase to Pay",
      description: "Fra behov opstår til leverandøren er betalt.",
      startEvent: "Indkøbsbehov identificeret",
      endEvent: "Leverandørfaktura betalt",
      ownerId: owner2.id,
      sortOrder: 1,
    },
  });

  const plan = await db.process.create({
    data: {
      engagementId: engagement.id,
      name: "Plan to Produce",
      startEvent: "Produktionsplan lagt",
      endEvent: "Færdigvare på lager",
      ownerId: owner2.id,
      sortOrder: 2,
    },
  });

  // Støtteprocesserne bærer kerneprocesserne. De er med i modellen fra dag ét,
  // også før nogen har kortlagt dem — ellers overser man dem.
  await db.process.createMany({
    data: [
      { name: "HR", ownerId: owner1.id },
      { name: "Academy", ownerId: owner1.id },
      { name: "Finans", ownerId: owner2.id },
      { name: "IT", ownerId: owner2.id },
      { name: "Faciliteter", ownerId: null },
      { name: "Leverandørsamarbejde", ownerId: owner2.id },
    ].map((p, i) => ({
      ...p,
      engagementId: engagement.id,
      category: "SUPPORT",
      sortOrder: 10 + i,
    })),
  });

  // ------------------------------------------------------------ underprocesser
  const ordremodtagelse = await db.subProcess.create({
    data: {
      processId: o2c.id,
      name: "Ordremodtagelse",
      startEvent: "Ordre lander i fællespostkassen",
      endEvent: "Ordre oprettet i NAV",
      assigneeId: emp1.id,
      status: "VALIDATED",
      sortOrder: 0,
      summary:
        "Ordrer kommer ind ad tre kanaler: mail til fællespostkassen, telefon og " +
        "EDI fra de fire største kunder. EDI-ordrer går direkte i NAV. Alt andet " +
        "taster Sofie manuelt, og hun holder sideløbende et Excel-ark over hvad der " +
        "mangler afklaring, fordi NAV ikke har et felt til det.",
    },
  });

  const kreditcheck = await db.subProcess.create({
    data: {
      processId: o2c.id,
      name: "Kreditvurdering",
      startEvent: "Ordre oprettet",
      endEvent: "Ordre frigivet eller afvist",
      assigneeId: emp3.id,
      status: "IN_VALIDATION",
      sortOrder: 1,
      summary:
        "Louise kigger dagligt listen af ordrer over kreditmaks igennem. " +
        "Beslutningen tages på mavefornemmelse og en opringning til salg.",
    },
  });

  const plukPak = await db.subProcess.create({
    data: {
      processId: o2c.id,
      name: "Pluk og pak",
      startEvent: "Ordre frigivet til lager",
      endEvent: "Kolli klar til fragtmand",
      assigneeId: emp2.id,
      status: "DRAFT",
      sortOrder: 2,
    },
  });

  await db.subProcess.create({
    data: {
      processId: o2c.id,
      name: "Fakturering og rykker",
      assigneeId: emp3.id,
      status: "NOT_STARTED",
      sortOrder: 3,
    },
  });

  await db.subProcess.create({
    data: {
      processId: o2c.id,
      name: "Returhåndtering",
      inScope: false,
      scopeReason: "Under 1% af ordrerne. Tages i næste runde.",
      status: "NOT_STARTED",
      sortOrder: 4,
    },
  });

  await db.subProcess.createMany({
    data: [
      { processId: p2p.id, name: "Indkøbsanmodning", status: "NOT_STARTED", sortOrder: 0 },
      { processId: p2p.id, name: "Leverandørfaktura-match", status: "NOT_STARTED", sortOrder: 1 },
      { processId: plan.id, name: "Ugeplanlægning", status: "NOT_STARTED", sortOrder: 0 },
    ],
  });

  // ------------------------------------------------------------------- skridt
  const steps = [
    {
      sub: ordremodtagelse.id,
      name: "Åbn fællespostkassen og sortér indbakken",
      actorRole: "Ordrebehandler",
      isManual: true,
      frequency: "3 gange dagligt",
      durationMin: 20,
      painPoint: "Ordrer og forespørgsler ligger i samme postkasse — intet skiller dem ad.",
      systems: [mail.id],
      data: [ordre.id],
    },
    {
      sub: ordremodtagelse.id,
      name: "Slå kunden op i NAV",
      actorRole: "Ordrebehandler",
      isManual: true,
      frequency: "ca. 40 gange dagligt",
      durationMin: 2,
      systems: [nav.id],
      data: [kunde.id],
    },
    {
      sub: ordremodtagelse.id,
      name: "Er kunden oprettet?",
      stepType: "DECISION",
      actorRole: "Ordrebehandler",
      isManual: true,
      decisionCriteria: "Findes kundens CVR-nummer allerede i NAV?",
      output: "Ja → gå videre. Nej → opret ny kunde i NAV først.",
      systems: [nav.id, hubspot.id],
      data: [kunde.id],
    },
    {
      sub: ordremodtagelse.id,
      name: "Tast ordrelinjer manuelt",
      actorRole: "Ordrebehandler",
      isManual: true,
      frequency: "ca. 35 ordrer dagligt",
      durationMin: 8,
      painPoint:
        "Varenumre står sjældent i kundens mail. Sofie gætter ud fra beskrivelsen og " +
        "ringer i tvivlstilfælde. Det er her de fleste fejl opstår.",
      systems: [nav.id, mail.id],
      data: [ordre.id, vare.id],
    },
    {
      sub: ordremodtagelse.id,
      name: "Tjek lagerbeholdning",
      actorRole: "Ordrebehandler",
      isManual: true,
      durationMin: 3,
      painPoint: "Tallet i NAV er op til et døgn gammelt. Ved tvivl ringer hun til lageret.",
      systems: [nav.id, wms.id],
      data: [lager.id],
    },
    {
      sub: ordremodtagelse.id,
      name: "Noter afklaringer i eget regneark",
      actorRole: "Ordrebehandler",
      isManual: true,
      frequency: "dagligt",
      durationMin: 10,
      painPoint: "Viden findes kun i Sofies ark. Ingen andre kan overtage.",
      systems: [excel.id],
      data: [ordre.id],
    },
    {
      sub: ordremodtagelse.id,
      name: "Send ordrebekræftelse",
      actorRole: "Ordrebehandler",
      isManual: false,
      systems: [nav.id, mail.id],
      data: [ordre.id],
    },
    {
      sub: kreditcheck.id,
      name: "Træk liste over ordrer over kreditmaks",
      actorRole: "Bogholder",
      isManual: true,
      frequency: "dagligt",
      durationMin: 15,
      systems: [nav.id],
      data: [kunde.id, ordre.id],
    },
    {
      sub: kreditcheck.id,
      name: "Vurdér kundens betalingshistorik",
      actorRole: "Bogholder",
      isManual: true,
      durationMin: 10,
      painPoint: "Ingen fast regel. Vurderingen sidder i hovedet på Louise.",
      systems: [nav.id],
      data: [kunde.id, faktura.id],
    },
    {
      sub: kreditcheck.id,
      name: "Frigiv eller hold ordren",
      stepType: "DECISION",
      actorRole: "Bogholder",
      isManual: true,
      decisionCriteria: "Er kunden inden for kreditmaks, og er betalingshistorikken ren?",
      output: "Frigivet → videre til lager. Holdt → salg kontaktes for afklaring.",
      systems: [nav.id],
      data: [ordre.id],
    },
    {
      sub: plukPak.id,
      name: "Modtag plukliste i WMS",
      actorRole: "Lagerkoordinator",
      isManual: false,
      systems: [wms.id],
      data: [ordre.id, lager.id],
    },
    {
      sub: plukPak.id,
      name: "Pluk varer på lager",
      actorRole: "Lagermedarbejder",
      isManual: true,
      frequency: "ca. 35 ordrer dagligt",
      durationMin: 12,
      systems: [wms.id],
      data: [lager.id, vare.id],
    },
    {
      sub: plukPak.id,
      name: "Book fragt",
      actorRole: "Lagerkoordinator",
      isManual: true,
      durationMin: 6,
      painPoint: "Fragtvalg sker manuelt ud fra erfaring — ikke pris eller leveringstid.",
      systems: [excel.id, mail.id],
      data: [levering.id],
    },
  ];

  let plukStepId: string | null = null;

  for (const [i, s] of steps.entries()) {
    const step = await db.processStep.create({
      data: {
        subProcessId: s.sub,
        name: s.name,
        actorRole: s.actorRole,
        stepType: s.stepType ?? "TASK",
        isManual: s.isManual ?? true,
        frequency: s.frequency,
        durationMin: s.durationMin,
        painPoint: s.painPoint,
        decisionCriteria: s.decisionCriteria,
        output: s.output,
        sortOrder: i,
      },
    });
    await db.stepSystem.createMany({
      data: s.systems.map((systemId) => ({ stepId: step.id, systemId })),
    });
    await db.stepData.createMany({
      data: s.data.map((dataObjectId) => ({ stepId: step.id, dataObjectId })),
    });
    if (s.name === "Pluk varer på lager") plukStepId = step.id;
  }

  // Et parallelt spor: kvalitetskontrol løber sideløbende med fragtbooking og
  // afslutter for sig selv — det behøver ikke smelte sammen med hovedforløbet.
  if (plukStepId) {
    const kvalitet = await db.processStep.create({
      data: {
        subProcessId: plukPak.id,
        name: "Stikprøvekontrol af pluk",
        actorRole: "Lagermedarbejder",
        isManual: true,
        lane: 1,
        branchFromId: plukStepId,
        frequency: "hver 10. ordre",
        durationMin: 4,
        sortOrder: 0,
      },
    });
    await db.stepData.create({ data: { stepId: kvalitet.id, dataObjectId: lager.id } });
  }

  // ------------------------------------------------------------- procesksperter
  await db.subProcessExpert.createMany({
    data: [
      { subProcessId: ordremodtagelse.id, name: "Sofie Dahl", email: "sofie@nordvest.dk" },
      { subProcessId: kreditcheck.id, name: "Louise Hein", email: "louise@nordvest.dk" },
      { subProcessId: plukPak.id, name: "Kasper Ø. Nielsen", email: "kasper@nordvest.dk" },
    ],
  });

  // --------------------------------------------------------- interview & noter
  const interview = await db.interview.create({
    data: {
      subProcessId: ordremodtagelse.id,
      userId: emp1.id,
      status: "COMPLETED",
      completedAt: new Date(),
      messages: {
        create: [
          { role: "agent", content: "Fortæl mig, hvad der sker fra du åbner computeren om morgenen." },
          { role: "user", content: "Jeg starter i fællespostkassen. Der ligger typisk 15-20 mails, og en del af dem er ordrer." },
          { role: "agent", content: "Hvordan kan du se, om en mail er en ordre og ikke en forespørgsel?" },
          { role: "user", content: "Det kan jeg egentlig ikke. Jeg åbner dem alle sammen. De faste kunder skriver næsten ens hver gang, så dem genkender jeg." },
        ],
      },
      notes: {
        create: [
          { category: "PAIN", content: "Ordrer og forespørgsler kommer ind i samme postkasse uden at være adskilt.", importance: 3 },
          { category: "WORKAROUND", content: "Sofie holder et personligt Excel-ark over ordrer der mangler afklaring, fordi NAV ikke har feltet.", importance: 3 },
          { category: "KNOWLEDGE", content: "Genkendelse af faste kunders mailformat sidder udelukkende hos Sofie efter 11 år.", importance: 3 },
          { category: "RISK", content: "Ved sygdom står ordremodtagelsen reelt stille — ingen anden kender arket.", importance: 3 },
          { category: "OPPORTUNITY", content: "De fire EDI-kunder udgør 40% af ordrerne og kræver ingen manuel indtastning.", importance: 2 },
        ],
      },
    },
  });

  await db.validation.create({
    data: {
      subProcessId: ordremodtagelse.id,
      validatorId: owner1.id,
      validatorRole: "PROCESS_OWNER",
      verdict: "APPROVED",
      comment: "Passer med det jeg ser. Kreditcheck-trinnet hører hjemme i næste underproces.",
    },
  });

  // ------------------------------------------------------------ konsulent-log
  await db.consultantLogEntry.createMany({
    data: [
      {
        title: "Mail-til-ordre agent",
        technology: "LLM-udtræk + ERP-API",
        problemType: "Manuel indtastning fra ustruktureret mail",
        description:
          "Agent læser indgående ordremails, udtrækker linjer og matcher mod varekartotek. " +
          "Usikre linjer sendes til menneskelig godkendelse i stedet for at blive gættet.",
        outcome: "Hos en grossist: 80% af ordrer oprettet uden tastning, fejlrate faldet fra 4% til 1%.",
        tags: JSON.stringify(["ordre", "ERP", "dokumentudtræk"]),
      },
      {
        title: "Kreditbeslutnings-assistent",
        technology: "Regelmotor + LLM-begrundelse",
        problemType: "Beslutning baseret på tavs viden hos én person",
        description:
          "Gør den erfarne medarbejders vurdering eksplicit som regler, og lader en agent " +
          "foreslå beslutningen med begrundelse. Mennesket godkender.",
        outcome: "Hos en produktionsvirksomhed: beslutningstid fra 10 min til under 1 min.",
        tags: JSON.stringify(["kredit", "beslutning", "risiko"]),
      },
      {
        title: "Fragtoptimering",
        technology: "Optimeringsmotor + fragt-API'er",
        problemType: "Valg truffet på erfaring frem for data",
        description: "Sammenligner priser og leveringstider på tværs af fragtudbydere pr. kolli.",
        outcome: "Typisk 8-14% lavere fragtomkostning.",
        tags: JSON.stringify(["logistik", "fragt", "optimering"]),
      },
      {
        title: "Lagerbeholdning i realtid",
        technology: "Event-baseret integration",
        problemType: "Natlig synkronisering giver forældede tal",
        description: "Erstatter natlig batch med hændelsesbaseret opdatering mellem WMS og ERP.",
        outcome: "Fjerner opkald til lageret og reducerer overbookinger.",
        tags: JSON.stringify(["integration", "lager", "master data"]),
      },
    ],
  });

  // ------------------------------------------------------------------- roller
  await db.businessRole.createMany({
    data: [
      { name: "Ordrebehandler", description: "Modtager og opretter ordrer fra mail, telefon og EDI." },
      { name: "Bogholder", description: "Kreditvurdering, fakturering og rykkerprocedure." },
      { name: "Lagerkoordinator", description: "Planlægger pluk, pak og fragt." },
      { name: "Lagermedarbejder", description: "Plukker og pakker varer fysisk på lageret." },
      { name: "Salgschef", description: "Ejer Order to Cash. Sætter prioriteter for salg." },
      { name: "Logistikchef", description: "Ejer Purchase to Pay og Plan to Produce." },
    ].map((r) => ({ ...r, engagementId: engagement.id })),
  });

  // ---------------------------------------------------------- forbedringer & AIOS
  const imp1 = await db.improvement.create({
    data: {
      engagementId: engagement.id,
      processId: o2c.id,
      subProcessId: ordremodtagelse.id,
      title: "Ordrer tastes manuelt fra ustrukturerede mails",
      bottleneck: "Sofie taster ordrelinjer manuelt ud fra mails uden fast format.",
      lever: "DIFFERENT",
      isCrossProcess: false,
    },
  });

  const imp2 = await db.improvement.create({
    data: {
      engagementId: engagement.id,
      processId: p2p.id,
      title: "Leverandørfaktura matches manuelt mod ordre",
      bottleneck: "Ingen automatisk matching mellem indkøbsordre og modtaget faktura.",
      lever: "IMPROVE",
      isCrossProcess: true,
    },
  });

  const [proposal1, proposal2] = await Promise.all([
    db.aiosProposal.create({
      data: {
        improvementId: imp1.id,
        name: "Mail-til-ordre agent",
        layer: "PROCESS",
        description: "Læser indgående ordremails, udtrækker linjer og matcher mod varekartotek.",
        howItWorks:
          "Agenten overvåger fællespostkassen og læser hver ny mail, så snart den lander. Den finder " +
          "ordrelinjer i den fri tekst — varenummer eller -beskrivelse, antal, ønsket leveringsdato — " +
          "og slår dem op mod varekartoteket i NAV. Linjer den er sikker på, oprettes automatisk som " +
          "en kladdeordre. Linjer den er i tvivl om, samles i en kort liste Sofie godkender med ét klik, " +
          "i stedet for at skulle taste dem fra bunden.",
        example:
          "Klokken 08.14 lander en mail fra en fast kunde: \"Skal bruge 40 stk af de sorte paller, samme som sidst, " +
          "til levering fredag.\" Agenten genkender kunden, finder \"sidst\" ved at slå op i ordrehistorikken, " +
          "matcher varenummeret og opretter en kladdeordre i NAV med linje, antal og ønsket leveringsdato udfyldt. " +
          "Fordi \"samme som sidst\" er en tolkning, markeres linjen til godkendelse — Sofie ser den i sin liste " +
          "klokken 08.20, trykker godkend, og ordren er oprettet. Det tog hende 20 sekunder i stedet for 8 minutter.",
        roiEstimate:
          "Sofie bruger i dag omkring 8 minutter pr. ordre på indtastning, cirka 35 ordrer dagligt. Rammer agenten " +
          "80% automatisk oprettelse — realistisk ud fra de fire EDI-kunder plus de faste kunders gentagne mønstre " +
          "— frigør det cirka 3,5 time om dagen. Det svarer til at Sofies tid kan bruges på de sager der rent " +
          "faktisk kræver et menneske, uden at ansætte mere.",
        scoreStrategic: 5,
        scoreImpact: 4,
        scoreFeasibility: 3,
        sourceKind: "CONSULTANT_LOG",
        systemsUsed: JSON.stringify(["Microsoft Dynamics NAV", "Outlook"]),
        dataUsed: JSON.stringify(["Salgsordre", "Kunde", "Vare"]),
        rolesAffected: JSON.stringify(["Ordrebehandler"]),
        strategicGoal: "2) Vokse 30% i omsætning uden at øge administrationen.",
        requiresSystem: true,
        buildsInto: JSON.stringify(["INTERNAL_PROCESS"]),
        resourceReadiness: "READY",
        resourceNotes: "Sofie kan drive godkendelseslisten fra dag ét — det kræver ingen nye kompetencer, kun at IT sætter API-adgangen til NAV op.",
        systemFunctions: JSON.stringify([
          { block: "MODEL", description: "Claude, valgt for stærk tekstforståelse af fri, ustruktureret mailtekst." },
          { block: "ONTOLOGY", description: "Salgsordren og dens linjer — varenummer, antal, leveringsdato, kunde." },
          {
            block: "CONTEXT",
            description:
              "Input: den indkommende mail. Viden: varekartotek og kundens ordrehistorik i NAV. Hukommelse: hvilke mails der allerede er behandlet.",
          },
          { block: "SKILLS", description: "Udtrække ordrelinjer af fri tekst og matche dem til varenumre i kartoteket." },
          { block: "TOOLS", description: "Skriveadgang til NAV via API for at oprette kladdeordrer." },
          { block: "TRIGGER", description: "Ny mail lander i den fælles ordrepostkasse." },
          { block: "GOALS", description: "Mindst 80% af ordrelinjer oprettet uden manuel indtastning." },
          { block: "INTERFACE", description: "En kort godkendelsesliste Sofie klikker igennem for de usikre linjer." },
        ]),
        toBeSteps: JSON.stringify([
          { name: "Mail modtaget", actorRole: "", isAi: false, description: "Ordre lander i fællespostkassen." },
          { name: "Ordrelinjer udtrukket", actorRole: "Ordrebehandler", isAi: true, description: "Agenten matcher varer og opretter kladdeordre." },
          { name: "Usikre linjer godkendes", actorRole: "Ordrebehandler", isAi: false, description: "Ét klik pr. linje agenten er i tvivl om." },
          { name: "Ordre oprettet i NAV", actorRole: "", isAi: true, description: "" },
        ]),
      },
    }),
    db.aiosProposal.create({
      data: {
        improvementId: imp2.id,
        name: "Faktura-matching agent",
        layer: "ORCHESTRATION",
        description: "Matcher leverandørfakturaer mod indkøbsordrer på tværs af Order to Cash og Purchase to Pay.",
        howItWorks:
          "Når en leverandørfaktura modtages, henter agenten den tilhørende indkøbsordre og sammenligner " +
          "linjer, antal og pris. Stemmer det, bogføres fakturaen uden at nogen har rørt den. Er der " +
          "afvigelser — en anden pris, en manglende linje — sendes den videre til bogholderen med afvigelsen " +
          "fremhævet, i stedet for at hele fakturaen skal gennemgås fra bunden.",
        example:
          "En leverandør sender en faktura på 42.000 kr for en ordre på 40.000 kr. Agenten finder straks " +
          "afvigelsen — én linje er faktureret med 5% mere end aftalt — og sender kun den linje videre til " +
          "bogholderen med begge tal ved siden af hinanden. De resterende 14 linjer på fakturaen er allerede " +
          "bogført, fordi de matchede perfekt.",
        roiEstimate:
          "Estimatet er groft, fordi Purchase to Pay endnu ikke er kortlagt i detaljer — men lignende cases " +
          "hos sammenlignelige virksomheder viser 60-70% af fakturaer kan matches og bogføres uden en person, " +
          "når data er rene nok. Det bør revurderes så snart underprocessen er interviewet.",
        scoreStrategic: 4,
        scoreImpact: 4,
        scoreFeasibility: 4,
        sourceKind: "WEB_CASE",
        systemsUsed: JSON.stringify(["Microsoft Dynamics NAV"]),
        dataUsed: JSON.stringify(["Faktura", "Salgsordre"]),
        rolesAffected: JSON.stringify(["Bogholder"]),
        strategicGoal: "1) Halvere gennemløbstiden fra ordre til levering inden udgangen af 2027.",
        requiresSystem: true,
        buildsInto: JSON.stringify(["INTERNAL_PROCESS"]),
        resourceReadiness: "PARTIAL",
        resourceNotes: "Louise kan drive afvigelseslisten dagligt, men der mangler en teknisk ressource til at vedligeholde NAV-integrationen — bør allokeres fra IT eller en ekstern partner.",
        systemFunctions: JSON.stringify([
          { block: "ONTOLOGY", description: "Indkøbsordren og den tilhørende leverandørfaktura, linje for linje." },
          { block: "CONTEXT", description: "Input: den modtagne faktura. Viden: den bagvedliggende indkøbsordre i NAV." },
          { block: "SKILLS", description: "Sammenligne linjer, antal og pris mellem faktura og ordre." },
          { block: "TOOLS", description: "Bogføring direkte i NAV når alt matcher." },
          { block: "TRIGGER", description: "Leverandørfaktura modtaget." },
          { block: "INTERFACE", description: "Afvigelsen fremhævet til bogholderen — ikke hele fakturaen forfra." },
        ]),
        toBeSteps: JSON.stringify([
          { name: "Faktura modtaget", actorRole: "", isAi: false, description: "" },
          { name: "Matchet mod indkøbsordre", actorRole: "Bogholder", isAi: true, description: "Linjer, antal og pris sammenlignes." },
          { name: "Afvigelse gennemgås", actorRole: "Bogholder", isAi: false, description: "Kun ved uoverensstemmelse." },
          { name: "Bogført", actorRole: "", isAi: true, description: "" },
        ]),
      },
    }),
  ]);

  await db.aiosProcessLink.createMany({
    data: [
      { proposalId: proposal1.id, processId: o2c.id },
      { proposalId: proposal2.id, processId: o2c.id },
      { proposalId: proposal2.id, processId: p2p.id },
    ],
  });

  await db.consultant.createMany({
    data: [
      {
        name: "Jakob Breum Møller",
        bio: "Senior konsulent hos Cornerstones — FDE på dette forløb, kender scoping og roadmap bedst.",
        email: "jakob@cornerstones.dk",
        phone: "+45 20 12 34 56",
        sortOrder: 0,
      },
      {
        name: "Ida Werner",
        bio: "AIOS-arkitekt hos Cornerstones — bygger forslagene der kommer ud af kortlægningen.",
        email: "ida.werner@cornerstones.dk",
        phone: "+45 30 45 67 89",
        sortOrder: 1,
      },
    ],
  });

  console.log("Seed færdig:", org.name, "→", engagement.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

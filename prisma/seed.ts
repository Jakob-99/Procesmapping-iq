import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/*
  Demodata for interview-platformen: en organisation, et par interview-agenter,
  en håndfuld respondenter, og ét eksempel-interview der viser en gennemført
  samtale med beskeder og noter.
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
    data: { name: "Medarbejderinterviews 2026", organizationId: org.id },
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

  // ------------------------------------------------------------ respondenter
  const [sofie, kasper, louise] = await Promise.all(
    [
      { name: "Sofie Dahl", email: "sofie@nordvest.dk", title: "Ordrebehandler" },
      { name: "Kasper Ø. Nielsen", email: "kasper@nordvest.dk", title: "Lagerkoordinator" },
      { name: "Louise Hein", email: "louise@nordvest.dk", title: "Bogholder" },
    ].map((r) => db.respondent.create({ data: { ...r, engagementId: engagement.id } })),
  );

  // ------------------------------------------------------------- interview-agenter
  const onboarding = await db.interviewAgent.create({
    data: {
      engagementId: engagement.id,
      name: "Onboarding-feedback",
      purpose:
        "Afdæk hvordan de første 90 dage har været for en ny medarbejder — hvad fungerede, " +
        "hvad manglede, og hvad ville have gjort starten nemmere.",
      prequalification: "Personen skal have været ansat i mindst 60 dage.",
      investigate:
        "Spørg konkret ind til den første uge, den første måned, og hvornår personen følte sig " +
        "produktiv. Vær nysgerrig på huller i oplæring og materialer der manglede.",
      followUpLevel: 4,
      formalityLevel: 2,
      questionLengthLevel: 2,
    },
  });

  const trivsel = await db.interviewAgent.create({
    data: {
      engagementId: engagement.id,
      name: "Medarbejdertrivsel",
      purpose:
        "Forstå hvordan medarbejderen har det med arbejdsmængde, samarbejde med kolleger, og " +
        "balancen mellem arbejde og fritid.",
      investigate: "Hold en varm og uformel tone. Spørg til konkrete eksempler frem for generelle vurderinger.",
      followUpLevel: 3,
      formalityLevel: 1,
      questionLengthLevel: 2,
    },
  });

  const sipoc = await db.interviewAgent.create({
    data: {
      engagementId: engagement.id,
      name: "SIPOC-kortlægning",
      purpose:
        "Kortlæg en proces efter SIPOC-modellen: Suppliers (leverandører), Inputs (input), " +
        "Process (de overordnede procestrin), Outputs (output) og Customers (modtagere) — så " +
        "processens grænser og bidragydere er tydelige, før den kortlægges i detaljer i BPMN.",
      prequalification: "Personen skal selv udføre eller være tæt på den proces, der skal kortlægges.",
      investigate:
        "Følg SIPOC-rækkefølgen bagfra og frem: start med at få afklaret hvem der modtager processens " +
        "resultat (Customers) og hvad de modtager (Outputs) — det er lettest at starte konkret dér. " +
        "Gå derefter til de overordnede procestrin (Process, typisk 4-7 høj-niveau-trin, ikke hvert eneste " +
        "klik) og spørg til hvor processen reelt starter og slutter. Slut med at afdække hvad der skal " +
        "være til stede for at kunne gå i gang (Inputs) og hvem der leverer det (Suppliers) — både interne " +
        "afdelinger og eksterne leverandører tæller. Bed altid om et konkret eksempel frem for en generel " +
        "beskrivelse, og spørg ind til undtagelser (hvad sker der, hvis input mangler eller er forkert?).",
      followUpLevel: 4,
      formalityLevel: 3,
      questionLengthLevel: 2,
    },
  });

  const skillUndersoegelse = await db.interviewAgent.create({
    data: {
      engagementId: engagement.id,
      name: "Skill-undersøgelse",
      purpose:
        "Afdæk konkrete muligheder for at lade en AI-skill overtage eller lette dele af " +
        "medarbejderens arbejde — med fokus på afgrænsede, gentagne opgaver inden for ét " +
        "forretningsområde og én eller flere processer, ikke arbejdet som helhed.",
      prequalification:
        "Få afklaret hvilket forretningsområde og hvilken/hvilke proces(ser) respondenten " +
        "arbejder med — det kan være flere. Spørg respondenten hvilke af følgende der passer, " +
        "i stedet for at gætte:\n\n" +
        "Økonomi: Bogføring, Fakturering, Betalingsafstemning, Budgettering og forecast, " +
        "Lønadministration, Regnskabsafslutning og rapportering\n" +
        "HR: Rekruttering, Onboarding, Ferie og fravær, MUS-samtaler, Personaleadministration\n" +
        "Salg og CRM: Leadhåndtering, Tilbudsgivning, Ordrebehandling, Kundeopfølgning, " +
        "Vedligeholdelse af CRM-data\n" +
        "Indkøb og supply chain: Indkøbsbestilling, Leverandørstyring, Lagerstyring, Fragt og levering\n" +
        "Kundeservice: Sagsbehandling, Support-henvendelser, Vedligeholdelse af FAQ/vidensbase, Reklamationer\n" +
        "IT og drift: Brugeroprettelse og adgangsstyring, Support-tickets, Systemvedligeholdelse, Rapportgenerering\n" +
        "Marketing: Kampagnestyring, Content-produktion, Performance-rapportering",
      investigate:
        "Når du kender forretningsområdet og processen/processerne, så stil de spørgsmål der " +
        "præcist afdækker om der er en skill-mulighed i den valgte proces — du skal IKKE bygge " +
        "skill'en, kun finde og beskrive muligheden.\n\n" +
        "Spørg konkret ind til:\n" +
        "- Hvilke opgaver i processen udføres ofte/gentagne gange, og hvor meget tid bruges der " +
        "på dem (pr. gang og samlet pr. uge/måned)?\n" +
        "- Hvor meget af opgaven er regelbaseret og forudsigelig (samme trin hver gang) versus " +
        "kræver vurdering, kontekst eller undtagelseshåndtering?\n" +
        "- Hvilke systemer og data indgår, og hvor meget er manuel indtastning, copy-paste mellem " +
        "systemer, eller ventetid på svar fra andre?\n" +
        "- Hvad er de typiske fejl eller kvalitetsproblemer i opgaven i dag?\n\n" +
        "Spørg altid afslutningsvis ind til konsekvensen: 'Hvad ville det betyde for dig, hvis en " +
        "AI-skill kunne overtage denne opgave?' — bor i både det praktiske (tid frigjort, hvad tiden " +
        "ville blive brugt på i stedet) og det følelsesmæssige (tryghed, bekymring for eget ansvar " +
        "eller rolle, tillid til at en AI kan gøre det rigtigt). Tag bekymringer alvorligt, undgå at " +
        "sælge idéen.",
      followUpLevel: 4,
      formalityLevel: 3,
      questionLengthLevel: 2,
    },
  });
  void skillUndersoegelse;

  await db.quantQuestion.createMany({
    data: [
      {
        interviewAgentId: sipoc.id,
        prompt: "Hvor mange forskellige leverandører (interne eller eksterne) leverer input til processen?",
        type: "SCALE",
        sortOrder: 0,
      },
      {
        interviewAgentId: sipoc.id,
        prompt: "Hvor tydeligt er det for dig, hvor processen starter og slutter?",
        type: "SCALE",
        sortOrder: 1,
      },
    ],
  });

  // ------------------------------------------------------------- interview-runder
  const [onboardingRound, trivselRound] = await Promise.all(
    [
      { name: "Onboarding — september 2026" },
      { name: "Trivsel — Q3 2026" },
    ].map((r) => db.interviewRound.create({ data: { ...r, engagementId: engagement.id } })),
  );

  // ---------------------------------------------------------------- interviews
  const interview = await db.interview.create({
    data: {
      engagementId: engagement.id,
      interviewAgentId: onboarding.id,
      interviewRoundId: onboardingRound.id,
      respondentId: sofie.id,
      sentById: fde.id,
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  await db.interviewMessage.createMany({
    data: [
      { interviewId: interview.id, role: "agent", content: "Hej Sofie! Hvordan var din allerførste uge herinde?" },
      {
        interviewId: interview.id,
        role: "user",
        content: "Lidt kaotisk faktisk — jeg fik ikke adgang til Navision før dag 3, så jeg sad og kiggede på i starten.",
      },
      { interviewId: interview.id, role: "agent", content: "Hvad gjorde du de første dage, mens du ventede på adgang?" },
      {
        interviewId: interview.id,
        role: "user",
        content: "Sad med Kasper og kiggede over skulderen, hvilket faktisk var meget lærerigt — men det er tilfældigt at det gik godt.",
      },
      { interviewId: interview.id, role: "agent", content: "Hvornår følte du dig egentlig produktiv på egen hånd?" },
      { interviewId: interview.id, role: "user", content: "Nok efter tre uger, da jeg havde set nok ordrer til at kunne gennemskue mønstrene selv." },
    ],
  });

  await db.interviewNote.createMany({
    data: [
      {
        interviewId: interview.id,
        category: "PAIN",
        content: "Systemadgang (Navision) er først klar dag 3 — nye medarbejdere er produktivitetsløse de første dage.",
        importance: 3,
      },
      {
        interviewId: interview.id,
        category: "WORKAROUND",
        content: "Sidemandsoplæring hos en kollega dækker hullet i den formelle oplæring, men er tilfældigt og ikke planlagt.",
        importance: 2,
      },
    ],
  });

  await db.interview.create({
    data: {
      engagementId: engagement.id,
      interviewAgentId: trivsel.id,
      interviewRoundId: trivselRound.id,
      respondentId: kasper.id,
      sentById: fde.id,
      status: "OPEN",
    },
  });

  void louise;
  void owner1;

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

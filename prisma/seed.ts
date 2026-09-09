import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/*
  Demodata for interview-platformen: en organisation, et par interview-agenter,
  en håndfuld respondenter, og ét eksempel-interview der viser en gennemført
  samtale med beskeder og noter.
*/
async function main() {
  await db.organization.deleteMany();
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

  const [fde, owner1] = await Promise.all(
    [
      { email: "jakob@cornerstones.dk", name: "Jakob Breum Møller", role: "FDE", title: "Senior konsulent" },
      { email: "mette@nordvest.dk", name: "Mette Krogh", role: "PROCESS_OWNER", title: "HR-chef" },
    ].map((u) => db.user.create({ data: { ...u, organizationId: org.id } })),
  );

  const engagement = await db.engagement.create({
    data: { name: "Medarbejderinterviews 2026", organizationId: org.id },
  });

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
      goal:
        "Afdæk hvordan de første 90 dage har været for en ny medarbejder — hvad fungerede, " +
        "hvad manglede, og hvad ville have gjort starten nemmere.",
      instructions:
        "Spørg konkret ind til den første uge, den første måned, og hvornår personen følte sig " +
        "produktiv. Vær nysgerrig på huller i oplæring og materialer der manglede.",
    },
  });

  const trivsel = await db.interviewAgent.create({
    data: {
      engagementId: engagement.id,
      name: "Medarbejdertrivsel",
      goal:
        "Forstå hvordan medarbejderen har det med arbejdsmængde, samarbejde med kolleger, og " +
        "balancen mellem arbejde og fritid.",
      instructions:
        "Hold en varm og uformel tone. Spørg til konkrete eksempler frem for generelle vurderinger.",
    },
  });

  // ---------------------------------------------------------------- interviews
  const interview = await db.interview.create({
    data: {
      engagementId: engagement.id,
      interviewAgentId: onboarding.id,
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
      respondentId: kasper.id,
      sentById: fde.id,
      status: "OPEN",
    },
  });

  void louise;
  void owner1;

  // -------------------------------------------------------------------- HITL
  await db.consultant.createMany({
    data: [
      {
        name: "Jakob Breum Møller",
        bio: "Senior konsulent hos Cornerstones — bygger og tilpasser interview-agenterne på dette forløb.",
        email: "jakob@cornerstones.dk",
        phone: "+45 20 12 34 56",
        sortOrder: 0,
      },
    ],
  });

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

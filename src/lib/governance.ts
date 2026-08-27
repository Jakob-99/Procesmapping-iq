import { db } from "./db";
import { generateJson, hasApiKey } from "./claude";

/*
  Opdatering styring: agenten kan selv vurdere om en underproces' materiale
  trænger til et eftersyn (sparsomt, gammelt, eller interviewnoter der peger
  på ustabile workarounds/risici), og — hvis politikken tillader det — sende
  en påmindelse videre til den tildelte medarbejder. Der er ingen rigtig
  mailudbyder koblet på endnu (samme situation som ekspert-invitationerne i
  processes/[id]/[subId]/actions.ts), så "at sende" betyder her: logges og
  markeres i databasen, ikke et faktisk afsendt brev.
*/

const FINDING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["needsUpdate", "finding", "emailBody"],
  properties: {
    needsUpdate: { type: "boolean" },
    finding: { type: "string" },
    emailBody: { type: "string" },
  },
} as const;

export async function runUpdateCheck(subProcessId: string) {
  if (!hasApiKey()) {
    throw new Error("Sæt ANTHROPIC_API_KEY i .env for at aktivere opdatering styring.");
  }

  const sp = await db.subProcess.findUnique({
    where: { id: subProcessId },
    include: {
      process: true,
      assignee: true,
      updatePolicy: true,
      steps: { orderBy: { sortOrder: "asc" } },
      interviews: { include: { notes: true } },
    },
  });
  if (!sp) throw new Error("Underprocessen findes ikke.");
  if (!sp.updatePolicy) throw new Error("Ingen opdateringspolitik oprettet for denne underproces.");

  const notes = sp.interviews.flatMap((i) => i.notes);
  const context = [
    `Underproces: ${sp.name} (del af proces: ${sp.process.name})`,
    `Status: ${sp.status}`,
    `Sidst ændret: ${sp.updatedAt.toISOString()}`,
    sp.summary ? `Resume: ${sp.summary}` : "Intet resume endnu.",
    sp.steps.length ? `Antal kortlagte skridt: ${sp.steps.length}` : "Ingen skridt kortlagt endnu.",
    notes.length
      ? `Noter fra interview:\n${notes.map((n) => `- [${n.category}] ${n.content}`).join("\n")}`
      : "Ingen interviewnoter.",
  ].join("\n");

  const result = await generateJson<{ needsUpdate: boolean; finding: string; emailBody: string }>({
    system:
      "Du er Corner IQ's opdateringsagent. Du vurderer om en kortlagt underproces trænger til at blive gennemgået igen af den tildelte medarbejder — fx fordi materialet er sparsomt, gammelt, eller interviewnoterne peger på ustabile workarounds eller risici. Svar altid kort og på dansk.",
    prompt: `Vurder følgende underproces og afgør om den trænger til et eftersyn.\n\n${context}\n\nHvis needsUpdate er sand, skriv et kort udkast (3-5 sætninger, dansk, du-form) til en påmindelses-mail til den tildelte medarbejder om at bekræfte eller opdatere kortlægningen. Ellers lad emailBody være en tom streng.`,
    schema: FINDING_SCHEMA,
    effort: "low",
  });

  const now = new Date();
  const willEmail = result.needsUpdate && sp.updatePolicy.autoSendEmail && !!sp.assignee?.email;

  const run = await db.updateRun.create({
    data: {
      policyId: sp.updatePolicy.id,
      needsUpdate: result.needsUpdate,
      finding: result.finding,
      emailSent: willEmail,
      emailTo: willEmail ? sp.assignee!.email : null,
      emailBody: willEmail ? result.emailBody : null,
    },
  });

  await db.updatePolicy.update({
    where: { id: sp.updatePolicy.id },
    data: {
      lastCheckedAt: now,
      ...(willEmail ? { lastEmailAt: now } : {}),
    },
  });

  if (willEmail) {
    console.log(
      `[opdatering-styring] Til: ${sp.assignee!.email} — "Tid til at gennemgå ${sp.name} igen."\n${result.emailBody}`,
    );
  }

  return run;
}

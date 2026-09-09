/*
  Interview-agenten.

  Et interview er ikke en formular og ikke bare en chat. Folk fortæller
  frit, men går i stå på det strukturerede — hvor tit, hvor længe, hvilken
  mulighed. Derfor får agenten to måder at spørge på: den skriver som et
  menneske, og rækker et lille skema frem præcis når svaret er noget der
  skal tælles eller vælges.

  Hvad agenten konkret skal afdække er IKKE hårdkodet her — det kommer fra
  den valgte InterviewAgent-rækkes purpose/prequalification/investigate plus
  dens tre 1-5 stil-skalaer (se buildInterviewSystemPrompt), så samme motor
  kan bruges til ethvert interview-emne en konsulent opfinder.
*/

export type FieldType = "text" | "longtext" | "number" | "choice" | "multi" | "scale";

export type FormField = {
  id: string;
  label: string;
  type: FieldType;
  options: string[];
  placeholder: string;
};

export const NOTE_CATEGORIES = {
  PAIN: "Smertepunkt",
  WORKAROUND: "Workaround",
  RISK: "Risiko",
  KNOWLEDGE: "Tavs viden",
  OPPORTUNITY: "Mulighed",
} as const;

export type AgentTurn = {
  say: string;
  form: { title: string; fields: FormField[] } | null;
  keynote: { category: string; content: string } | null;
  done: boolean;
};

export const AGENT_TURN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["say", "form", "keynote", "done"],
  properties: {
    say: {
      type: "string",
      description: "Det agenten siger. Dansk, kort, én ting ad gangen.",
    },
    form: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["title", "fields"],
      description:
        "Et lille skema, kun når svaret er struktureret. Ellers null.",
      properties: {
        title: { type: "string" },
        fields: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "label", "type", "options", "placeholder"],
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              type: {
                type: "string",
                enum: ["text", "longtext", "number", "choice", "multi", "scale"],
              },
              options: {
                type: "array",
                items: { type: "string" },
                description: "Kun til choice og multi. Ellers tom liste.",
              },
              placeholder: { type: "string" },
            },
          },
        },
      },
    },
    keynote: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["category", "content"],
      description:
        "Noter kun det der er værd at huske bagefter. Ellers null.",
      properties: {
        category: {
          type: "string",
          enum: ["PAIN", "WORKAROUND", "RISK", "KNOWLEDGE", "OPPORTUNITY"],
        },
        content: { type: "string" },
      },
    },
    done: {
      type: "boolean",
      description: "Sandt når interviewet er nået til vejs ende.",
    },
  },
} as const;

export type QuantQuestionInput = {
  id: string;
  prompt: string;
  type: "CHOICE" | "SCALE";
  options: string[];
};

const FOLLOW_UP_LABELS = [
  "Meget lidt opfølgende — spørg videre til nyt, uden at bore i svar.",
  "Lidt opfølgende — bor kun sjældent i et svar.",
  "Middel opfølgende — følg op når noget virker vigtigt.",
  "Ret opfølgende — grav aktivt i svar, bed ofte om eksempler og uddybning.",
  "Meget opfølgende — bor vedholdende i hvert svar, aldrig tilfreds med det overfladiske.",
];

const FORMALITY_LABELS = [
  "Meget uformel — snak som en kollega, brug hverdagssprog.",
  "Uformel — afslappet og venlig tone.",
  "Neutral tone — hverken formel eller uformel.",
  "Formel — professionel og struktureret tone.",
  "Meget formel — stram, korrekt forretningstone.",
];

const QUESTION_LENGTH_LABELS = [
  "Meget korte spørgsmål — én kort sætning, intet ekstra.",
  "Korte spørgsmål — kort og direkte.",
  "Middellange spørgsmål — en kort sætning kontekst, så spørgsmålet.",
  "Lange spørgsmål — uddyb konteksten før du spørger.",
  "Meget lange, uddybende spørgsmål — giv god kontekst og flere vinkler før spørgsmålet.",
];

function levelLabel(labels: string[], level: number): string {
  return labels[Math.min(Math.max(level, 1), 5) - 1];
}

export function buildInterviewSystemPrompt(
  agent: {
    name: string;
    purpose: string;
    prequalification?: string | null;
    investigate?: string | null;
    followUpLevel: number;
    formalityLevel: number;
    questionLengthLevel: number;
  },
  quantQuestions: QuantQuestionInput[] = [],
): string {
  const quantBlock =
    quantQuestions.length === 0
      ? ""
      : `\nFaste spørgsmål der skal stilles ordret, ét ad gangen, et sted i løbet af interviewet (naturligt indpasset, ikke nødvendigvis først):\n${quantQuestions
          .map(
            (q) =>
              `- "${q.prompt}" — brug et skema med PRÆCIS ét felt: id="quant:${q.id}", type="${
                q.type === "CHOICE" ? "choice" : "scale"
              }"${q.type === "CHOICE" ? `, options=${JSON.stringify(q.options)}` : ", options=[]"}. Spørg den én gang pr. interview, aldrig igen efter den er besvaret.\n`,
          )
          .join("")}`;

  return `Du gennemfører et interview med en respondent. Interviewets navn er "${agent.name}".

Formålet med interviewet er:
${agent.purpose}

${agent.prequalification ? `Prækvalificering — dette skal være opfyldt for at respondenten er relevant:\n${agent.prequalification}\n` : ""}${agent.investigate ? `Hvad du konkret skal undersøge:\n${agent.investigate}\n` : ""}${quantBlock}
Din stil, styret af tre indstillinger:
- ${levelLabel(FOLLOW_UP_LABELS, agent.followUpLevel)}
- ${levelLabel(FORMALITY_LABELS, agent.formalityLevel)}
- ${levelLabel(QUESTION_LENGTH_LABELS, agent.questionLengthLevel)}

Sådan spørger du i øvrigt:
- Én ting ad gangen. Aldrig to spørgsmål i samme tur.
- Start bredt, og bor derefter ned i det formålet beder dig afdække.
- Spørg til det faktiske og konkrete, ikke det ideelle. Bed om eksempler.
- Skriv på dansk, i du-form, som en nysgerrig samtalepartner.

Hvornår du bruger et skema i stedet for at skrive:
- Når svaret er et tal, en varighed, en frekvens eller et valg fra en liste.
- Højst 4 felter ad gangen. Er spørgsmålet åbent, så skriv i stedet — brug ikke skema.
- Skriv altid en kort sætning i "say", også når du sender et skema.

Keynote sætter du kun, når respondenten lige har afsløret noget der er værd at
huske bagefter: et smertepunkt, en workaround, en risiko, tavs viden eller en
mulighed. Ellers null.

Sæt done til sandt, når du har fået dækket det formålet beder om, og
samtalen naturligt kan afsluttes.`;
}

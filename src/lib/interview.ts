/*
  Interview-agenten.

  Et interview er ikke en formular og ikke bare en chat. Folk fortæller
  frit, men går i stå på det strukturerede — hvor tit, hvor længe, hvilken
  mulighed. Derfor får agenten to måder at spørge på: den skriver som et
  menneske, og rækker et lille skema frem præcis når svaret er noget der
  skal tælles eller vælges.

  Hvad agenten konkret skal afdække er IKKE hårdkodet her — det kommer fra
  den valgte InterviewAgent-rækkes goal/instructions (se
  buildInterviewSystemPrompt), så samme motor kan bruges til ethvert
  interview-emne en konsulent opfinder.
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

export function buildInterviewSystemPrompt(agent: {
  name: string;
  goal: string;
  instructions?: string | null;
}): string {
  return `Du gennemfører et interview med en respondent. Interviewets navn er "${agent.name}".

Formålet med interviewet er:
${agent.goal}

${agent.instructions ? `Yderligere retningslinjer fra den der har bygget interviewet:\n${agent.instructions}\n` : ""}
Sådan spørger du:
- Én ting ad gangen. Aldrig to spørgsmål i samme tur.
- Start bredt, og bor derefter ned i det formålet beder dig afdække.
- Spørg til det faktiske og konkrete, ikke det ideelle. Bed om eksempler.
- Undgå fagsprog og indledende høflighedsfraser.
- Skriv på dansk, i du-form, som en nysgerrig og imødekommende samtalepartner.

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

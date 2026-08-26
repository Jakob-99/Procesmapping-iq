/*
  Interview-agenten.

  Et interview er ikke en formular og ikke bare en chat. Folk fortæller
  frit om deres arbejde, men går i stå på det strukturerede — hvor tit,
  hvor længe, hvilket system. Derfor får agenten to måder at spørge på:
  den skriver som et menneske, og rækker et lille skema frem præcis når
  svaret er noget der skal tælles eller vælges.
*/

export type FieldType = "text" | "longtext" | "number" | "choice" | "multi" | "scale";

export type FormField = {
  id: string;
  label: string;
  type: FieldType;
  options: string[];
  placeholder: string;
};

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

export const INTERVIEW_SYSTEM_PROMPT = `Du interviewer en medarbejder om hvordan de rent faktisk udfører deres arbejde.
Interviewet varer omkring 30 minutter og skal ende med en proces der kan tegnes i BPMN 2.0.

Din opgave er at få fire ting frem for hvert skridt i arbejdet:
1. PROCESSEN — hvad sker der, i hvilken rækkefølge, hvem gør det, hvad udløser næste skridt,
   og hvor der træffes beslutninger (hvad er betingelsen, og hvad sker der i hver gren).
2. AKTØRER — hvem andre end medarbejderen selv er involveret i skridtet, fx en kollega
   der sender noget videre eller en leder der skal godkende noget.
3. DATA — hvilke oplysninger skridtet bruger og producerer, og hvor de kommer fra.
4. SYSTEMER — hvilke systemer der røres, og om der læses eller skrives.

Sådan spørger du:
- Én ting ad gangen. Aldrig to spørgsmål i samme tur.
- Start bredt ("fortæl hvad du gør fra du møder ind"), og bor derefter ned.
- Spørg til det faktiske, ikke det ideelle. "Hvad gør du, når det ikke passer?"
  afdækker mere end "hvordan er processen".
- Når det giver mening for skridtet, spørg konkret hvilke oplysninger
  medarbejderen bruger for at kunne gøre det (input), og hvad der kommer ud af
  det bagefter — hvad sender de videre, og til hvem eller hvilket system (output).
- Når det giver mening, spørg om der findes alternative veje gennem opgaven —
  undtagelser, hastesager eller andre måder skridtet nogle gange løses på —
  ikke kun de beslutningspunkter der allerede er nævnt.
- Regneark, mails, sedler og telefonopkald tæller som systemer. Grav efter dem —
  folk nævner dem ikke selv, fordi de ikke føles officielle. Nævner medarbejderen
  et system, en rolle eller et dataobjekt der ikke står i de kendte lister, så
  noter det som nyt — spørg ikke om det skal oprettes, bare skriv det ned som en
  del af skridtet.
- Spørg hvem der ellers er involveret, ikke kun hvad der sker — en kollega,
  en leder, en kunde eller en ekstern part tæller, selvom de ikke rører et system.
- Undgå fagsprog. Sig aldrig "BPMN", "e2e" eller "dataobjekt" til medarbejderen.
- Skriv på dansk, i du-form, som en nysgerrig kollega. Ingen indledende høflighedsfraser.

Hvornår du bruger et skema i stedet for at skrive:
- Når svaret er et tal, en varighed, en frekvens eller et valg fra en liste.
- Når du vil bekræfte en rækkefølge eller lade dem sætte kryds ved flere systemer.
- Højst 4 felter ad gangen. Er spørgsmålet åbent, så skriv i stedet — brug ikke skema.
- Skriv altid en kort sætning i "say", også når du sender et skema.

Keynote sætter du kun, når medarbejderen lige har afsløret noget der er værd at
huske bagefter: et smertepunkt, en workaround, en risiko, tavs viden eller en mulighed.
Ellers null.

Sæt done til sandt, når processen hænger sammen fra start til slut og du har
data og systemer på hvert skridt.`;

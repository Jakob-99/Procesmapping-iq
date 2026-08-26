import type { AgentTurn } from "./interview";

/*
  Midlertidig stand-in for den rigtige agent, så interviewflowet kan bygges og
  testes uden at kalde Anthropic-API'et. Scriptet følger samme faser som
  INTERVIEW_SYSTEM_PROMPT (proces → aktører → systemer → data → volumen →
  smertepunkt), men spørger fast i stedet for at tilpasse sig svaret.
  Erstattes af det rigtige API-kald når ANTHROPIC_API_KEY sættes — se
  hasApiKey() i claude.ts.
*/

type MockContext = {
  systemNames: string[];
  roleNames: string[];
  dataNames: string[];
  agentTurnIndex: number;
};

function step(ctx: MockContext): Omit<AgentTurn, "done"> {
  const { systemNames, roleNames, dataNames, agentTurnIndex } = ctx;

  switch (agentTurnIndex) {
    case 0:
      return {
        say: "Fortæl med dine egne ord, hvad du gør fra du møder ind til den her opgave er færdig.",
        form: null,
        keynote: null,
      };
    case 1:
      return {
        say: "Hvad sker der lige efter det — hvad er det første, du gør bagefter?",
        form: null,
        keynote: null,
      };
    case 2:
      return {
        say: "Er der et sted i forløbet, hvor du skal træffe en beslutning eller vurdere noget, før du kan fortsætte?",
        form: null,
        keynote: null,
      };
    case 3:
      return {
        say: "Er der situationer, hvor du gør noget andet end det, du lige har beskrevet — en anden vej gennem opgaven, fx en undtagelse eller en hastesag?",
        form: null,
        keynote: null,
      };
    case 4:
      return {
        say: "Er der andre personer eller roller involveret undervejs, ud over dig selv — nogen du sender videre til eller får noget fra? Mangler der en rolle på listen, kan du selv tilføje den.",
        form: {
          title: "Andre involverede",
          fields: [
            {
              id: "actors",
              label: "Hvem er involveret?",
              type: "multi",
              options: roleNames.length ? roleNames : ["Ingen andre", "Kollega", "Leder", "Ekstern part"],
              placeholder: "",
            },
          ],
        },
        keynote: null,
      };
    case 5:
      return {
        say: "Hvilke systemer eller ark rører du undervejs — og læser du bare, eller skriver du også i dem? Mangler der noget på listen, kan du selv tilføje det.",
        form: {
          title: "Systemer i brug",
          fields: [
            {
              id: "systems",
              label: "Hvilke bruger du?",
              type: "multi",
              options: systemNames.length ? systemNames : ["Excel", "Mail", "Andet system"],
              placeholder: "",
            },
          ],
        },
        keynote: null,
      };
    case 6:
      return {
        say: "Hvilke oplysninger bruger du for at kunne gøre det her, og hvad sidder du med bagefter? Mangler der noget på listen, kan du selv tilføje det.",
        form: {
          title: "Data ind og ud",
          fields: [
            {
              id: "dataIn",
              label: "Hvad bruger du (input)?",
              type: "multi",
              options: dataNames.length ? dataNames : ["Ordre", "Kunde", "Faktura"],
              placeholder: "",
            },
            {
              id: "dataOut",
              label: "Hvad producerer du (output)?",
              type: "multi",
              options: dataNames.length ? dataNames : ["Ordre", "Kunde", "Faktura"],
              placeholder: "",
            },
          ],
        },
        keynote: null,
      };
    case 7:
      return {
        say: "Cirka hvor mange gange sker det her om ugen, og hvor lang tid tager det typisk?",
        form: {
          title: "Volumen",
          fields: [
            { id: "frequency", label: "Gange om ugen", type: "number", options: [], placeholder: "fx 15" },
            { id: "duration", label: "Minutter pr. gang", type: "number", options: [], placeholder: "fx 10" },
          ],
        },
        keynote: null,
      };
    case 8:
      return {
        say: "Er der noget i det her, der er besværligt eller som du har fundet en genvej til?",
        form: null,
        keynote: {
          category: "WORKAROUND",
          content: "(mock) Medarbejderen har beskrevet en manuel omvej — bør bekræftes i et rigtigt interview.",
        },
      };
    default:
      return {
        say: "Tak — det giver mig et godt billede af forløbet. Det var det, jeg havde brug for at spørge om.",
        form: null,
        keynote: null,
      };
  }
}

export function generateMockTurn(ctx: MockContext): AgentTurn {
  const turn = step(ctx);
  return { ...turn, done: ctx.agentTurnIndex >= 9 };
}

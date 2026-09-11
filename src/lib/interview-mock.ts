import type { AgentTurn } from "./interview";

/*
  Midlertidig stand-in for den rigtige agent, så interviewflowet kan bygges og
  testes uden at kalde Anthropic-API'et. Generisk — kender intet til et
  bestemt interviews emne, kun til selve spørgeteknikken (bredt → konkret →
  struktureret → afrunding). Erstattes af det rigtige API-kald når
  ANTHROPIC_API_KEY sættes — se hasApiKey() i claude.ts.
*/

type MockContext = {
  agentTurnIndex: number;
};

function step(ctx: MockContext): Omit<AgentTurn, "done"> {
  switch (ctx.agentTurnIndex) {
    case 0:
      return {
        say: "Hej! Fortæl med dine egne ord, hvordan det har været — start hvor du vil.",
        form: null,
        keynote: null,
        showImage: null,
      };
    case 1:
      return {
        say: "Kan du give et konkret eksempel på det?",
        form: null,
        keynote: null,
        showImage: null,
      };
    case 2:
      return {
        say: "Hvad har været sværest eller mest overraskende indtil nu?",
        form: null,
        keynote: {
          category: "PAIN",
          content: "(mock) Respondenten har nævnt noget udfordrende — bør bekræftes i et rigtigt interview.",
        },
        showImage: null,
      };
    case 3:
      return {
        say: "På en skala fra 1-5, hvor tilfreds er du samlet set?",
        form: {
          title: "Samlet vurdering",
          fields: [
            { id: "score", label: "Score", type: "scale", options: ["1", "2", "3", "4", "5"], placeholder: "" },
          ],
        },
        keynote: null,
        showImage: null,
      };
    default:
      return {
        say: "Tak — det giver mig et godt billede. Det var det, jeg havde brug for at spørge om.",
        form: null,
        keynote: null,
        showImage: null,
      };
  }
}

export function generateMockTurn(ctx: MockContext): AgentTurn {
  const turn = step(ctx);
  return { ...turn, done: ctx.agentTurnIndex >= 4 };
}

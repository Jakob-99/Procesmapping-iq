# Corner IQ

Virksomhedens hjerne. Kortlægger hvad en virksomhed faktisk gør — processer, data
og systemer — og bygger AI-forslag oven på den viden.

## Kør lokalt

```bash
npm run dev
```

Åbn http://localhost:3000

Node ligger i `C:\Program Files\nodejs`. Er `npm` ikke på PATH i en ny terminal,
så åbn en frisk PowerShell (installationen tilføjede den) eller kør:

```bash
$env:Path = "C:\Program Files\nodejs;" + $env:Path
```

## Aktivér agenten

Hjernen og de kommende agent-funktioner kræver en Claude API-nøgle. Sæt den i `.env`:

```
ANTHROPIC_API_KEY="sk-ant-..."
```

Uden nøgle kører resten af appen fint — kun `/brain` siger fra.

## Database

SQLite i `prisma/dev.db` (nemt til MVP, skiftes til Postgres senere).

```bash
npm run db:push    # synkronisér skema
npm run db:seed    # nulstil og læg demodata ind
npm run db:studio  # kig i data
```

## Stack

Next.js 15 · TypeScript · Tailwind v4 · Prisma/SQLite · Claude API (`claude-opus-5`)

## Hvor tingene er

| Sti | Hvad |
|---|---|
| `prisma/schema.prisma` | Datamodellen — procesgrafen hele systemet hviler på |
| `src/lib/brain.ts` | Serialiserer grafen til hjernens kontekst |
| `src/lib/claude.ts` | Claude-kald: streaming og JSON-svar |
| `src/lib/domain.ts` | Fælles vokabular: faser, roller, håndtag, pick-score |
| `src/app/globals.css` | Designsproget — farver og typografi ét sted |

## Status

Bygget: fundament, datamodel, overblik, procesmodel med underprocesser,
BPMN 2.0-tegning genereret fra data, keynotes fra interviews, agent-interview
med interaktive skemaer + forhåndsvisning, landskab, scoping, hjernen.

Mangler: gemning af interviewresultater tilbage i procesgrafen, valideringsflow,
flaskehalsanalyse, pick-matrix, roadmap, partnermatch, test cases, træning.
De sider findes som beskrivelser af flowet.

## To detaljer værd at kende

**BPMN-tegningen gemmes ikke — den tegnes.** `src/lib/bpmn.ts` bygger diagrammet
ud fra de kortlagte skridt ved hver visning. Retter nogen et skridt, følger
tegningen med. Der findes aldrig en tegning der er blevet gammel.

**Interviewet er chat og skema på én gang.** Agenten skriver som et menneske,
men rækker et lille skema frem, når svaret er et tal, en frekvens eller et valg —
de spørgsmål folk går i stå på i fri tekst. Se `src/lib/interview.ts`.

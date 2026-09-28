# Corner IQ

Procesmapping. Virksomhedens procesmodel (kerne- og støtteprocesser →
underprocesser), hvor hver underproces tegnes som et svimlane-diagram i
samme notation som Cornerstones' procesmodel — og ændres ved at skrive til
en proces-agent i chatten under diagrammet.

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

## Aktivér proces-agenten

Chatten bruger Claude. Sæt en API-nøgle i `.env`:

```
ANTHROPIC_API_KEY="sk-ant-..."
```

Uden nøgle bruges den lokalt installerede Claude Code CLI (`claude`), hvis
den findes og er logget ind. Uden nogen af delene virker resten af appen, men
chatten svarer med en fejl.

## Database

SQLite i `prisma/dev.db` (nemt til MVP, skiftes til Postgres senere).

```bash
npm run db:push    # synkronisér skema
npm run db:seed    # nulstil og læg demodata ind (sletter kundedata)
npm run db:studio  # kig i data
```

## Stack

Next.js 15 · TypeScript · Tailwind v4 · Prisma/SQLite · Claude API (`claude-opus-5`)

## Hvor tingene er

| Sti | Hvad |
|---|---|
| `prisma/schema.prisma` | Datamodellen — processer, underprocesser, skridt, pile, svimlaner, roller, systemer, data |
| `src/app/(customer)/page.tsx` | Forsiden: dækningsgrad og antal systemer, roller og data |
| `src/app/(customer)/processes` | Procesmodel, underprocesser, diagram-arbejdsflade |
| `src/app/(customer)/landscape`, `roles`, `data` | Systemer (inkl. AI-parathed), roller, dataobjekter |
| `src/components/SwimlaneDiagram.tsx` | Tegningen: svimlaner, aktiviteter, beslutninger, timere, data, pile |
| `src/lib/process-agent.ts` | Proces-agenten bag chatten |
| `src/app/admin` | Konsulentpanelet: kunder, konsulenter, audit-log |

## To detaljer værd at kende

**Diagrammet er data, ikke en tegning.** Skridt, pile og svimlaner ligger som
rækker i databasen, og tegningen bygges fra dem hver gang. Rækkerne i
diagrammet udledes af pilene, så skridt der sker samtidig i forskellige
svimlaner står på samme række.

**Agenten returnerer hele processen.** Chatten sender den nuværende proces og
samtalen til agenten, som svarer med en besked og — hvis noget skal ændres —
den komplette nye udgave. Eksisterende skridt beholder deres id, så felter
som frekvens og smertepunkt overlever. Roller, systemer og data matches på
navn og oprettes, hvis de mangler.

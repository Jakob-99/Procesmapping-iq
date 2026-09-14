# Corner IQ

AI-interview-platform. Man bygger en genbrugelig interview-agent (formål,
prækvalificering, hvad der skal undersøges), sender den til respondenter, og
agenten gennemfører selv samtalen — chat og faste kvant-spørgsmål på én gang —
og trækker noter (smertepunkter, risici, muligheder) ud undervejs.

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

Interview-agenten kræver en Claude API-nøgle. Sæt den i `.env`:

```
ANTHROPIC_API_KEY="sk-ant-..."
```

Uden nøgle kører resten af appen fint — kun selve interview-samtalen siger fra.

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
| `prisma/schema.prisma` | Datamodellen — respondenter, interview-agenter, runder, interviews |
| `src/lib/interview.ts` | Selve interview-motoren: agentens system-prompt, chat + kvant-skema |
| `src/lib/claude.ts` | Claude-kald: streaming og JSON-svar |
| `src/app/(customer)/agents` | Opret/redigér interview-agenter, forhåndsvisning |
| `src/app/(customer)/respondents` | Respondent-listen |
| `src/app/(customer)/interviews` | Runder, udsendelse, transskriptioner |
| `src/app/(respond)/respond` | Respondentens eget flow (join/login/select/session) |
| `src/app/globals.css` | Designsproget — farver og typografi ét sted |

## Status

Pivoteret 2026-09-09 fra et procesmapping-værktøj til en ren interview-platform
(à la conveo.ai) — al proces-/BPMN-/system-/rollemapping er fjernet. Bygget:
interview-agenter med prompt + tonestyring + billeder + kvant-spørgsmål,
respondenter, runde-baseret afsendelse (mail via Resend), selvbetjenings-
join-link, transskriptions- og noteuddrag, multi-tenant login,
konsulent-admin-panel (kunder/konsulenter/audit), MCP-adgang til
interviewdata til analyse (`src/app/api/mcp/route.ts`).

## To detaljer værd at kende

**Interviewet er chat og skema på én gang.** Agenten skriver som et menneske,
men rækker et lille skema frem, når svaret er et tal, en frekvens eller et valg —
de spørgsmål folk går i stå på i fri tekst. Se `src/lib/interview.ts`.

**Indsigter er scoped til runden, ikke agenten.** Samme interview-agent kan
sendes ud flere gange over tid (fx "Trivsel Q1", "Trivsel Q2") uden at
tidligere og nye svar blandes sammen.

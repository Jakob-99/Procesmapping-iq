---
name: process-analysis
description: Forklar, analysér og vurdér forretningsprocesser fra Corner IQ's procesmodel via Corner IQ MCP-connectoren (get_process_model, get_subprocess, list_systems, list_roles_and_data, list_findings, add_finding) — procesforklaring, SIPOC, vurdering af hvor der er potentiale for AI-skills/agenter, PICK-chart (impact × gennemførlighed) og roadmap. Brug den når en Cornerstones-konsulent beder om at få en proces forklaret, en SIPOC, en AI- eller automatiseringsvurdering, en prioritering eller en roadmap — også når de blot spørger "hvad sker der i processen", "hvor er potentialet", "hvad skal vi bygge først" eller "lav en PICK-chart".
---

# Procesanalyse fra Corner IQ

Tre ting konsulenten skal kunne få ud af procesmodellen:

1. **Forklaring** — hvad sker der i processen, i almindeligt forretningssprog.
2. **SIPOC** — leverandører, input, proces, output, kunder.
3. **AI-potentiale** — hvilke aktiviteter der er værd at lade en AI-skill/agent
   overtage, placeret i en **PICK-chart** og omsat til en **roadmap**.

Værdien er at alt er sporbart til modellen: et konkret skridt, et system,
et analysepunkt eller et nævnt tidsforbrug. Aldrig et generisk gæt.

## Adgang

Kræver Corner IQ's MCP-connector (nøgle fra kundens Kontrolpanel →
"MCP-server", se [src/app/api/mcp/route.ts](../../../src/app/api/mcp/route.ts)).
Værktøjerne:

| Værktøj | Giver |
|---|---|
| `get_process_model` | Alle processer → underprocesser med status, antal skridt, analysepunkter og nævnt tid (`hoursPerMonth`). Start altid her. |
| `get_subprocess` | Ét diagram: svimlaner, skridt i rækkefølge (aktør, systemer, data ind/ud, frekvens, varighed, smertepunkt, beslutningskriterier), pile, analysepunkter inkl. tidsforbrug. |
| `list_systems` | Systemlandskabet: integrationer (API/MCP/RPA/manuel), åbent API, agent-adgang, stamdatakvalitet, AI-parathed, hvor systemet bruges. |
| `list_roles_and_data` | Roller og dataobjekter med ejersystem. |
| `list_findings` | Analysepunkter på tværs — `kind: "TIME"` giver alt nævnt tidsforbrug. |
| `add_finding` | Skriver et analysepunkt tilbage (kun efter konsulentens ja, se F). |

Mangler værktøjerne, så bed konsulenten tilføje/genstarte connectoren — gæt
aldrig på indholdet.

## 0. Afgræns

Kald `get_process_model` og afklar omfanget: hele modellen, ét procesområde
eller én underproces. Er det uklart, så spørg. Underprocesser med
`stepCount: 0` er ikke tegnet endnu — de kan hverken forklares eller
vurderes; nævn dem som huller i stedet for at gætte på indholdet.

## A. Forklar processen

Hent `get_subprocess` for hver underproces i omfanget og skriv på dansk:

1. **Formål og udløser** — hvad starter forløbet (starthændelse/timer), og
   hvad er resultatet (sluthændelser).
2. **Hvem er med** — rollerne og systemerne i svimlanerne, og evt. eksterne
   parter (ekstra pools).
3. **Forløbet** — skridtene i rækkefølge, fulgt langs pilene. Ved en
   beslutning: sig spørgsmålet og hvad der sker ved hvert udfald (pilenes
   etiketter). Nævn overdragelser mellem roller — det er dér ventetid og fejl
   typisk opstår.
4. **Systemer og data** — hvilke systemer bruges hvor, og hvilke dokumenter
   der skabes og bruges videre.
5. **Hvor det gør ondt** — problemer, ønsker og nævnt tidsforbrug fra
   analysepunkterne.
6. **Åbne spørgsmål** — det diagrammet ikke svarer på.

Ingen id'er, ingen BPMN-jargon. For et helt procesområde: ét kort afsnit pr.
underproces og til sidst hvordan de hænger sammen end-to-end.

## B. SIPOC

Byg den af diagramdata, én tabel pr. underproces:

| Kategori | Hent fra |
|---|---|
| Leverandører | Aktører/eksterne pools/systemer der leverer det første input |
| Input | Starthændelsen + data med retning ind på de første skridt |
| Proces | 5–7 overordnede trin, sammenfattet fra skridtene i rækkefølge |
| Output | Sluthændelserne + data med retning ud fra de sidste skridt |
| Kunder | Den der modtager outputtet — sidste svimlane, besked-pile til eksterne pools |

Er en kategori tyndt belyst, så skriv det ("Ikke tegnet — bør valideres")
i stedet for at opfinde et plausibelt svar.

## C. Vurdér AI-potentiale

Den fulde bedømmelsesnøgle står i
[references/ai-potentiale.md](references/ai-potentiale.md) — læs den før du
scorer. Kort:

1. **Hent alt** — `get_subprocess` for hver underproces i omfanget,
   `list_systems` og `list_roles_and_data` én gang.
2. **Find kandidater.** En kandidat er én aktivitet, eller en kæde af
   nabo-aktiviteter hos samme aktør, som én AI-skill/agent kunne overtage.
   Navngiv den som det skillen gør ("Afstem bestillinger mod kalenderen").
3. **Fire kriterier** afgør potentialet:
   - **Vidensarbejde** (hvidt-flip-arbejde) — læse, skrive, taste, tjekke,
     matche, beregne, opsummere, kommunikere, regelbaserede beslutninger.
     Fysisk arbejde er ikke en kandidat. *Dette er en port: nej = ude.*
   - **Tidsforbrug** — der bruges meget tid på det (TIME-analysepunkter,
     skridtets varighed × frekvens).
   - **Data er tilgængelige** — input ligger digitalt i et system der kan
     læses, ikke i hoveder, på papir eller i løse mails.
   - **Et system kan udføre handlingen** — systemerne i skridtet har
     API/MCP/agent-adgang, så en agent både kan hente data og gøre det
     skridtet kræver.
4. **Score** hver kandidat på **Impact** (1–5, primært tid, justeret for
   smerte) og **Gennemførlighed** (1–5, data + system + hvor regelbunden
   opgaven er). Skriv én linjes begrundelse med evidens og en **sikkerhed**
   (høj/middel/lav) — lav når tallene er skønnet.

## D. PICK-chart

- **x-akse: Gennemførlighed** (1 svær → 5 let). **y-akse: Impact** (1 lav → 5 høj).
- Skillelinje ved 3 (≥ 3 = høj). Fire felter:

| | Lav gennemførlighed (< 3) | Høj gennemførlighed (≥ 3) |
|---|---|---|
| **Høj impact (≥ 3)** | **Challenge** — værd at kæmpe for, kræver forudsætninger | **Implement** — byg nu |
| **Lav impact (< 3)** | **Kill** — parkér | **Possible** — nemme gevinster, tag dem hvis de er billige |

- Hver kandidat er et nummereret punkt; boblestørrelse = timer/md (ukendt tid
  = lille hul cirkel). Punkter på samme koordinat skubbes let fra hinanden,
  så numrene kan læses. Nummeret svarer til kandidattabellen.

## E. Roadmap

Omsæt PICK-chartet til bølger:

- **Bølge 1 (0–3 mdr): Implement**, sorteret efter impact og så
  gennemførlighed. Højst 3–4 ad gangen.
- **Bølge 2 (3–6 mdr):** de Challenge-kandidater hvis blokering kan fjernes
  i bølge 1, plus Possible-kandidater der deler system eller data med noget i
  bølge 1 (integrationen bygges én gang og genbruges).
- **Bølge 3 (6–12 mdr):** resten af Challenge.
- **Parkeret:** Kill, med grunden.
- **Forudsætninger** som eget spor: det der trækker gennemførligheden ned —
  "Afklar API-adgang til X", "Ryd op i kundestamdata i Y", "Validér
  underprocessen Z med procesejeren". Knyt hver forudsætning til de
  kandidater den låser op for.

## F. Aflevering

- **A og B**: i chatten, medmindre konsulenten vil dele det.
- **C–E**: ét Artifact "AI-potentiale — <omfang>" (indlæs `artifact-design`
  og `cornerstones-brand` først) med:
  1. Sammenfatning — tre punkter + samlet tid i Implement-feltet (t/md).
  2. PICK-chartet (inline SVG).
  3. Kandidattabel: #, kandidat, underproces/skridt, t/md, impact,
     gennemførlighed, felt, begrundelse, sikkerhed.
  4. Roadmap med bølger og forudsætninger.
  5. Huller der skal valideres (ikke-tegnede underprocesser, ukendt tid,
     systemer uden afklaret integration).
- **Skriv tilbage kun efter ja.** Tilbyd at gemme kandidaterne i Implement og
  Challenge som IDEA-analysepunkter med `add_finding` (koblet til skridtet),
  fx: "AI-kandidat: Afstem bestillinger mod kalenderen — impact 4/5,
  gennemførlighed 4/5 (Implement). ~22 t/md, data i Kanpla via API." Tilbyd
  også at gemme tidsforbrug der kun står i fritekst (fx i et PROBLEM-punkt)
  som TIME-punkter. Det er kundens data og vises for dem — spørg først.

## Vær ærlig

- Opfind aldrig tal. Er tiden ukendt, så sig det, scor impact på de
  kvalitative tegn (hyppighed, volumen, smerte), højst 3, og sæt sikkerhed lav.
- En vurdering bygget på en underproces der ikke er valideret (status
  "Udkast", "Til validering" eller "Skal opdateres") er foreløbig — sig det.
- Hellere få, velbegrundede kandidater end en lang liste af alt der kunne
  automatiseres.

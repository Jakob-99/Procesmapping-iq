---
name: sipoc-analysis
description: Build or update a SIPOC analysis (Suppliers, Inputs, Process, Outputs, Customers) from a Corner IQ interview round, using the Corner IQ MCP connector's tools (list_rounds, get_round_transcripts, get_interview_transcript). Use this whenever a Cornerstones consultant asks for a SIPOC, a process map, or "hvad siger interviewene om processen" for a specific interview round/undersøgelse — even if they don't say "SIPOC" explicitly but describe the five categories (leverandører, input, proces, output, kunder).
---

# SIPOC-analyse fra Corner IQ

En SIPOC (Suppliers, Inputs, Process, Outputs, Customers) bygget på det
respondenterne faktisk sagde i en interview-runde — ikke en generisk
proces-skabelon konsulenten selv fylder ud. Værdien er at hver kategori er
sporbar til en konkret samtale.

## 1. Find runden

Kald `list_rounds` for at se engagementets runder (navn, oprettelsesdato,
antal interviews). Bekræft med konsulenten hvilken runde der er relevant,
hvis det ikke allerede er klart af konteksten — en runde kan ligge under en
proces der ikke er den konsulenten mener.

## 2. Hent evidensen

For den valgte runde, kald `get_round_transcripts` — de rå samtaler for
ALLE interviews i runden, respondent for respondent, i ét kald. Al evidens
kommer direkte fra disse transskriptioner, ingen forudgenereret analyse at
læne sig op ad.

Skal du kun bruge ét bestemt interview (fx til at følge op på et enkelt
citat), brug `get_interview_transcript(interviewId)` i stedet for at
trække hele rundens transskriptioner igen.

## 3. Afgør: én proces eller flere?

En runde er en samling af afsendte interviews — ikke nødvendigvis én
proces. Før du bygger tabellen, vurdér om interviewene beskriver samme
forløb fra forskellige roller (så skal de lægges sammen i ÉN SIPOC) eller
faktisk forskellige processer (så skal hvert forløb have sin egen SIPOC).

Tegn på at det er SAMME proces: respondenterne refererer til hinandens
trin eller til hinanden ved navn/rolle, trinene kæder sammen i en logisk
rækkefølge (den enes output er den andens input), og det er tydeligt
samme output/kunde i sidste ende.

Tegn på FORSKELLIGE processer: respondenterne beskriver uafhængige forløb
med hver sin start og slutning, ingen krydsreferencer, og forskellige
outputs/kunder der ikke hænger sammen.

Byg én SIPOC-tabel pr. reelt forskelligt forløb — giv hver sin egen
overskrift der navngiver processen. Er du i tvivl, så sig det til
konsulenten i stedet for at gætte.

## 4. Byg de fem kategorier (pr. proces)

| Kategori | Hvad du leder efter i transskriptionerne |
|---|---|
| Leverandører (Suppliers) | Hvem/hvad leverer input til processen — interne afdelinger, eksterne parter, systemer der fodrer data ind |
| Input | Hvad processen modtager for at kunne starte — dokumenter, data, bestillinger, godkendelser |
| Proces | De faktiske trin respondenterne beskriver, i den rækkefølge de nævner dem — ikke en idealiseret proces |
| Output | Hvad processen producerer — leverancer, beslutninger, dokumenter, overdragelser til næste led |
| Kunder (Customers) | Hvem modtager outputtet — kan være interne (næste afdeling) eller eksterne |

For hver linje i tabellen: notér hvilken respondent/interview den kommer
fra (fx "(Kasper Ø. Nielsen)"). Det er det der gør analysen til andet end
et gæt.

## 5. Vær ærlig om huller

Interviews er ikke designet til at afdække alle fem kategorier ligeligt —
det er almindeligt at "Leverandører" eller "Kunder" er tyndt belyst.
Skriv det direkte i den kategori ("Kun nævnt indirekte af én respondent —
bør valideres") i stedet for at opfinde et plausibelt svar. En SIPOC med
huller er mere brugbar for konsulenten end en der ser komplet ud, men er
delvist gættet.

## 6. Præsentér

Standardformat: en Danish tabel pr. proces med de fem kolonner
(Leverandører | Input | Proces | Output | Kunder), radbrudt hvor en
kategori har flere punkter. Flere processer i samme runde = flere tabeller
under hver sin overskrift, ikke én sammenblandet tabel. Tilbyd at
publicere som Artifact-tabel(ler) når konsulenten skal dele det videre
eller iterere visuelt — ikke som standard for et hurtigt tjek i chatten.

## Adgang

Kræver at Corner IQ's MCP-connector er tilføjet i Claude (Bearer-nøgle fra
kundens eget Kontrolpanel → "MCP API-nøgler", se
[src/app/api/mcp/route.ts](../../../src/app/api/mcp/route.ts)). Hvis
værktøjerne `list_rounds`/`get_round_transcripts`/`get_interview_transcript`
ikke er tilgængelige, bed konsulenten tilføje connectoren først i stedet
for at gætte på indholdet.

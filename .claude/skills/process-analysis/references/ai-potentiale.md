# Bedømmelsesnøgle: AI-potentiale

Brug nøglen ens hver gang, så to vurderinger af samme proces lander samme
sted, og så konsulenten kan forklare kunden hvorfor en kandidat ligger hvor
den ligger. Feltnavnene henviser til MCP-værktøjernes output.

## 1. Port: er det vidensarbejde?

**Ja** — opgaven består af informationshåndtering:
læse/finde, taste/overføre mellem systemer, tjekke/afstemme/matche,
beregne, klassificere/sortere, opsummere/skrive, kommunikere (mails,
påmindelser, statusbeskeder), planlægge, og beslutninger der følger regler
(`decisionCriteria` er kendt).

**Nej** — fysisk arbejde (pakke, levere, lave mad, reparere, rengøre),
menneskelig kontakt hvor kontakten er selve værdien, og beslutninger der
kræver ansvar/myndighed. Sidstnævnte kan *assisteres* (agenten forbereder,
mennesket beslutter) — så er det en kandidat, men impact trækkes ned (se 2).

Aktiviteter der fejler porten nævnes kort under "Ikke kandidater" med
grunden — de skal ikke i PICK-chartet.

## 2. Impact (1–5)

**Grundscore fra tid** — timer pr. måned for kandidatens skridt:

| t/md | Grundscore |
|---|---|
| under 4 | 1 |
| 4–10 | 2 |
| 10–25 | 3 |
| 25–60 | 4 |
| over 60 | 5 |

Timerne findes, i denne rækkefølge:
1. TIME-analysepunkter koblet til kandidatens skridt (`findings` med
   `hoursPerMonth` og `stepId`). Summér på tværs af skridtene i kæden.
2. TIME-punkter for hele underprocessen (intet skridt), hvis kandidaten er
   hovedparten af forløbet — sig at det er en fordeling.
3. Skridtets `durationMin` × `frequency` (fx 15 min × dagligt ≈ 5 t/md; brug
   ca. 21 arbejdsdage og 4,33 uger pr. måned).
4. Står tallet kun i fritekst (et PROBLEM-punkt, `painPoint`, en note), så
   regn det om og sig hvor det kommer fra.
5. Intet tal: skøn ud fra hyppighed/volumen/smerte, **højst 3**, sikkerhed lav.

**Justering** (resultatet holdes mellem 1 og 5):
- **+1** hvis der er et PROBLEM-punkt om fejl, forsinkelser, flaskehalse,
  dobbeltarbejde eller manuelle genindtastninger på skridtene, eller et
  WISH-punkt der beder om netop dette.
- **−1** hvis agenten kun kan assistere, og et menneske stadig skal gøre
  hovedparten (se porten).

## 3. Gennemførlighed (1–5)

Tre delscorer, hver 1–5:

**Data** — kan agenten få fat i det input skridtet bruger?
- 5: dataobjekterne ejes af et system med API/MCP (`list_roles_and_data` →
  `ownerSystem`, og det system har `hasOpenApi` eller API/MCP i
  `integrations`), stamdata "God".
- 3: data ligger i et system uden åbent API men kan eksporteres (fil, Excel,
  rapport), eller stamdata "Delvis".
- 1–2: data er på papir, i hovedet på folk, i telefonsamtaler eller i
  ustrukturerede mails; eller stamdata "Dårlig".

**System** — kan et system udføre det skridtet kræver (skrive, sende,
oprette, bestille)?
- 5: systemerne på skridtet har API eller MCP i `integrations` /
  `canAgentConnect: true`, og AI-parathed "Klar til AI".
- 3: kun RPA, eller "Delvist klar".
- 1–2: "Manuelt", ingen afklaret integration, eller "Ikke klar".
- Kun læsning/skrivning af tekst til et menneske (fx udkast til en mail) kræver
  ingen systemhandling — scor da efter hvor outputtet skal hen.

**Opgaven** — hvor veldefineret er den?
- 5: faste regler (`decisionCriteria` kendt), ens input hver gang,
  underprocessen er "Valideret".
- 3: nogle undtagelser, der skal skønnes indimellem; diagrammet er et udkast.
- 1–2: meget skøn og variation, eller forløbet er uklart/ikke tegnet færdigt.

**Samlet gennemførlighed** = gennemsnittet af de tre, afrundet — men **højst
den laveste delscore + 1**. En enkelt blokering (fx intet API) trækker hele
kandidaten ned, selvom resten ser godt ud. Den laveste delscore er typisk
den forudsætning der skal på roadmappen.

## 4. Sikkerhed

- **Høj**: tid fra TIME-punkter med `hoursPerMonth`, systemernes integration
  er afklaret, underprocessen er valideret.
- **Middel**: tid regnet om fra fritekst eller varighed × frekvens, eller et
  af systemerne er ikke afklaret.
- **Lav**: tid skønnet, eller underprocessen er et tidligt udkast.

## 5. Eksempel

> **#3 Afstem ugens bestillinger mod kalenderen** (Frokostordning →
> "Tæl antal og ret bestillingen", Kontorassistent)
> - Vidensarbejde: ja — tælle, sammenligne, rette et antal.
> - Tid: TIME-punkt "Bruger ca. 1,5 time hver onsdag" → 6,5 t/md → grundscore 2;
>   PROBLEM "Fejl opdages først dagen efter" → **impact 3**.
> - Data 4 (Outlook-kalender via API), System 5 (Kanpla har API), Opgave 4
>   (fast regel: antal = tilmeldte − fravær) → gns. 4,3 → **gennemførlighed 4**.
> - Felt: **Implement**. Sikkerhed: høj.

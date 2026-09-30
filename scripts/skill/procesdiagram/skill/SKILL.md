---
name: "procesdiagram"
description: "Interview en medarbejder om en proces og tegn den som svimlanediagram i Cornerstones' BPMN-notation, vis den som en side, ret løbende og lav den til en Visio-fil (.vsdx) bygget af Cornerstones' stencil."
---

# Procesdiagram — fra interview til Visio

En proces kortlægges i fire trin: du **interviewer** den, der kender processen, du **tegner** den som svimlanediagram, du **viser** den som en side, der rettes til de er tilfredse, og du laver den til en **Visio-fil**. Siden og Visio-filen tegnes med **samme kode som Corner IQ**, så de ser ud som diagrammet i systemet og Visio-eksporten derfra.

Er processen allerede beskrevet (workshopnoter, et dokument, et eksisterende diagram, en lang besked i chatten), så spring åbningsspørgsmålet over og gå til at sortere svaret (trin 1b).

Alt tegnes ud fra én fil: **`model.json`** (formatet står i [references/model.md](references/model.md)). Du retter aldrig i HTML'en eller Visio-filen — du retter modellen og tegner igen. Al notation (hvordan figurer, pile, navne og placering ser ud og navngives) står kun i model.md; interviewet handler om indholdet.

To scripts ligger i `scripts/` i denne skills mappe (der hvor denne SKILL.md ligger — kør dem med den fulde sti, uanset hvilken mappe du arbejder i). De kræver kun Node 18+ og intet andet:

| Script | Gør |
|---|---|
| `node <skill>/scripts/render.mjs model.json diagram.html` | Tegner siden (én selvstændig HTML-fil med zoom). |
| `node <skill>/scripts/visio.mjs model.json "<Titel>.vsdx"` | Laver Visio-filen. |

Begge tjekker modellen først og skriver `Fejl:` (intet tegnet) eller `Advarsel:` (tegnet, men se efter). Ret fejlene i modellen og kør igen. Findes `node` ikke, så sig det til konsulenten i stedet for at tegne på anden vis — diagrammet skal komme fra scriptet for at se rigtigt ud.

## 1. Interview

Målet er data, der er komplette nok til at bygge diagrammet uden at skulle spørge igen bagefter. Formålet for den interviewede er et procesdiagram til den interne procesmodel, ikke en vurdering af personen. Bekræft kort proces og område (fx HR, Finans, IT), hvis det ikke allerede er sagt. Krydser processen flere roller, kan ét interview med procesejeren række, hvis vedkommende kan tale for de andre; ellers er flere korte interviews nødvendige.

### 1a. Åbningsspørgsmålet — ét stort spørgsmål

Stil ét samlet spørgsmål, og lad den interviewede svare frit og i ét stræk. Ingen delspørgsmål oven i, intet skema. Svaret kommer ofte som tale-til-tekst, i blandet rækkefølge og med fyldord — tag det som det er. Brug omtrent denne ordlyd:

> Fortæl mig hele processen fra start til slut med dine egne ord. Hvad sætter den i gang, hvem er involveret, hvad sker der trin for trin — og hvilke systemer bruger I undervejs? Og hvornår er den færdig? Sig det hele, som det falder dig ind. Jeg spørger ind bagefter.

### 1b. Sortér svaret

Saml svaret i en kort opsummering, genfortæl processen som du har forstået den, og læg det op imod tjeklisten. Notér, hvad der er dækket, og hvad der mangler eller er uklart. Folk nævner sjældent systemer, input/output og varianter af sig selv.

**Tjekliste — det skal være afklaret, før diagrammet kan tegnes:**

1. **Udløser (start).** Hvad sætter processen i gang — en anmodning, en dato, en anden proces der slutter? Sker den på et fast tidspunkt (fx "hver onsdag kl. 9")?
2. **Resultat (slut).** Hvornår er processen færdig, og hvordan kan man se det? Kan den slutte på flere måder (fx godkendt/afvist)?
3. **Deltagere.** Roller og eksterne parter, se "Pools og baner" nedenfor.
4. **Black box.** For hver anden part uden for organisationen: skal deres egne skridt med, eller er det nok at vide, hvad de modtager og sender retur? Er detaljerne ukendte eller irrelevante, modelléres parten som et separat pool med én bane og ét samlet trin.
5. **Trin for trin.** For hvert trin: én handling (udsagnsord + genstand, fx "send velkomstmail", ikke "kommunikation"), hvem udfører det, hvilket it-system, evt. input/output, fast tid eller interval, og hvor det går hen bagefter. Hvis svaret indeholder "og så", er det sandsynligvis to trin.
6. **Beslutninger og udfald.** Alle udfald, ikke kun den gode vej, se "Alle udfald skal med".
7. **Varianter.** Er der situationer, hvor man gør noget andet i stedet — ferie, sygdom, en særlig type kunde, helligdage, gæster? En variant af samme opgave er en **beslutning inde i det samme flow**, ikke en selvstændig proces ved siden af. (Eksempel: ferie registreres i stedet for timer, så "Ferie" / "Arbejdsdag" er to udfald af en beslutning i den daglige tidsregistrering.)
8. **Parallelle spor.** Sker noget samtidig med noget andet — ikke i streng rækkefølge?
9. **Regler.** Er der regler, der skal overholdes (fx "mindst 30 min. pr. projekt")? De skrives kort i aktiviteten.
10. **Systemer.** Konkrete produktnavne og, hvis relevant, om systemet har integration (API, MCP) eller kun kan bruges manuelt.

### 1c. Opfølgende spørgsmål

Spørg kun ind til de punkter, der mangler eller er uklare. Spring alt over, der allerede er besvaret — også hvis det er sagt i andre ord.

- Højst tre-fire spørgsmål ad gangen, samlet i én nummereret besked, stillet som en almindelig samtale.
- Prioritér det, der ændrer diagrammets form (udfald, varianter, hvem gør hvad), over detaljer i ordlyd.
- Undgå ja/nej-spørgsmål om beslutningspunkter — spørg "hvad afgør, om I gør A eller B her?"
- Spørg "hvem gør det næste?" i stedet for at antage, at samme rolle fortsætter.
- Spørg altid ind til det dårlige udfald: "Hvad sker der, hvis det ikke bliver godkendt / ikke er i orden / ikke kommer?"
- Er en anden organisation involveret, så spørg direkte: "Er der nogen uden for [organisationen], der er involveret?"
- Er den interviewede usikker, så notér det som usikkert frem for at gætte.
- Gentag runden, til tjeklisten er dækket. Ofte er én runde nok.
- Ved tale-til-tekst kan navne på systemer og roller være stavet forkert. Brug den stavemåde, der bruges konsekvent, eller bekræft den i gennemlæsningen.

### 1d. Valider

Læs forløbet tilbage til den interviewede i rækkefølge, pool for pool og bane for bane, og få det bekræftet eller rettet. Stil de sidste uafklarede punkter (rollenavn, procesnavn) i samme besked. Tjek samtidig: har hver bane mindst ét trin (en tom bane fjernes), har hver beslutning mindst to veje, der hver fører til et trin eller en slut-hændelse, og er der ét sammenhængende forløb med én start.

Opfind aldrig skridt, aktører, systemer eller dokumenter. Mangler noget, så spørg — eller tegn med det du ved og nævn hullet i chatten, ikke i diagrammet. Delprocesser bruges ikke: er et trin stort, beskrives det som ét trin eller brydes op i flere almindelige trin.

### Pools og baner

- **Roller i organisationen** (hos Cornerstones, eller hos kunden hvis processen kortlægges for en klient) — hver rolle bliver sin egen bane inden for ét fælles pool med processens navn som titel.
- **Andre parter** — en anden organisation, en kunde, en leverandør eller en partner, der selv udfører noget — får deres eget pool, ikke en bane i det fælles pool. En portal eller et system, en af jeres egne roller bruger (fx en jobbank), er et system i aktiviteten, ikke en pool.
- Bed om et konkret rollenavn eller stillingsbetegnelse for hver bane, ikke afdelingsnavne. Pools og baner navngives kun med det rigtige navn — aldrig "internt" eller "eksternt". En rolle, der kun modtager noget og ikke selv gør noget, får ingen bane. Er der kun én rolle, der udfører noget, er der kun én bane.

### Alle udfald skal med

Et trin, hvor nogen godkender, tjekker, vurderer eller venter på svar, kan ende på mere end én måde. Tegn det aldrig kun med den gode vej.

- Efter en godkendelse, et tjek eller en vurdering kommer altid en beslutning med alle udfald.
- Find ud af, hvor hver vej fører hen: **tilbage** til et tidligere trin, der rettes og køres igen (en pil tilbage), **en anden vej** med egne trin (fx rykker for manglende registrering), eller **en slut-hændelse** med eget navn, hvis processen stopper (fx "Stillingen oprettes ikke").
- Ved du ikke, hvad der sker, så notér det som usikkert i stedet for at udelade vejen.
- Sker noget først efter processens slut (fx kolleger retter selv bagefter) og hører det ikke til processen, så tegn det ikke.

### Ét sammenhængende forløb

Et diagram er **én proces med ét sammenhængende flow** og én start. Det, der sker senere, kobles på med en mellemhændelse frem for en ny start. Venter processen på et tidspunkt undervejs ("en gang om ugen", "senest kl. 11 dagen før"), bruges en tidshændelse (`TIMER`) i flowet. Der er kun én slut-hændelse, medmindre processen kan ende på forskellige måder. Fortæller den interviewede om noget, der "også sker", så spørg hvor i forløbet det sker, og hvad der kommer før og efter.

Starter processen på et fast tidspunkt (fx hver onsdag kl. 9), bruges en start med ur (`TIMER_START`) med tidspunktet som navn (fx "Hver onsdag kl. 9"). En almindelig `START` er til alt andet, der sætter processen i gang (en anmodning, en ordre, en anden proces der slutter).

### Data (input/output)

Input og output er information, der ikke er en fast del af aktiviteten, som skal bearbejdes, og som er variabel fra forløb til forløb (fx de feriedatoer en medarbejder ønsker, en ordre fra en kunde, et udtræk med denne måneds tal).

Test: *Findes det allerede, før aktiviteten starter, og er det det samme hver gang?* Ja → det er en fast del af aktiviteten (mailskabelon, tjekliste, standardformular) og tegnes ikke. Nej → det er input eller output og kommer i `data`. Notér det som en kort titel (2–4 ord) og om det er input til eller output fra trinnet. Spørg specifikt: "Er der noget, der kommer ind i det her trin, som er forskelligt fra gang til gang — eller noget I skaber her, som går videre?"

### Systemer

Kun it-systemer noteres, med konkrete produktnavne (ikke "systemet" eller "vores platform"). Værktøjer som en tjekliste eller en skabelon er en fast del af aktiviteten og noteres ikke. Notér også, hvad systemet kan: API, MCP, eller "Manuel" kun hvis systemet ikke har nogen integration (ikke hvordan det bruges i dag). Ved du det ikke, så skriv "Ikke afklaret".

### Overleveringen — tabel og opsummering

Når interviewet er færdigt, saml svarene i én linje per trin:

| # | Pool | Bane (rolle) | Type | Trin (handling) | System | Input | Output | Udfald og veje | Tid | Note |
|---|---|---|---|---|---|---|---|---|---|---|

Type er en af: start, aktivitet, beslutning, tidshændelse, slut. Giv også en kort opsummering af processen i almindeligt sprog, så den interviewede kan genkende sin egen proces, før du tegner. Uafklarede punkter står i chatten, aldrig i tabellen eller diagrammet.

Har du i stedet et diagram fra Corner IQ (MCP-connectoren er koblet på), kan det hentes med `get_subprocess` og oversættes direkte til modellen (svimlaner → `lanes`, skridt → `steps`, pile → `flows`).

## 2. Modelér

Omsat tabellen til `model.json`: pool → `title`/`pools`, bane → `lanes`, hver linje → et skridt i `steps` i den rækkefølge, det sker, udfald og veje → `flows`. Skriv filen i en arbejdsmappe: i Cowork den mappe, konsulenten har givet adgang til (så model, side og Visio-fil ligger samlet hos dem); i Claude Code scratchpad-mappen, medmindre de vil have den et bestemt sted. Alle regler for navngivning, figurer og placering — Cornerstones' notation — står i [references/model.md](references/model.md). Det vigtigste:

- **Én pool pr. organisation**, **én svimlane pr. rolle/aktør**. Eksterne parter i egen pool; pile dertil er `MESSAGE`.
- **Rækkefølgen i `steps` er forløbet** oppefra og ned. Skriv skridtene i den rækkefølge de sker; grene fra samme gateway lige efter hinanden.
- **Aktiviteter** (`TASK`) hedder et udsagnsord først: "Godkend opslaget", ikke "Godkendelse". Systemer i `systems`, dokumenter i `data` med `dir: "in"`/`"out"`.
- **Gateways** navngives som et spørgsmål ("Er opslaget godkendt?"); de udgående pile får svaret som `label` ("Ja" / "Opslaget er ikke godkendt").
- **Start og slut** navngives som en tilstand: "Behov for ny medarbejder", "Stillingen er publiceret".

## 3. Vis og ret

1. Kør `render.mjs` og vis `diagram.html`:
   - **Kan du publicere et artifact** (Artifact-værktøjet i Claude Code og Cowork): publicér filen. Brug **samme filsti** hver gang, så siden opdateres på samme link.
   - **claude.ai:** lav et HTML-artifact med hele filens indhold, uændret.
   - **Ellers:** gem `diagram.html` i arbejdsmappen og vis/åbn den der — det er en almindelig side, der kan åbnes i enhver browser.
2. Fortæl kort hvad der er tegnet, og hvad du er i tvivl om.
3. Konsulenten retter ("flyt godkendelsen til økonomi", "tilføj en rykker efter 14 dage"): ret `model.json`, kør `render.mjs` igen, vis igen. Sig i én linje hvad der er ændret.

Står noget skævt, er det næsten altid rækkefølgen i `steps` eller en manglende/forkert pil — se "Sådan placeres skridtene" i model.md.

## 4. Visio-filen

Når konsulenten er tilfreds ("lav den til Visio", "giv mig filen"):

1. Kør `visio.mjs` med procesnavnet som filnavn.
2. Giv filen til konsulenten: i Cowork ligger den i arbejdsmappen; i Claude Code send filen; i claude.ai læg den i outputs og link til den.
3. Nævn kort at Visio kan åbne en hentet fil i beskyttet visning — så skal man trykke "Aktivér redigering" for at rette i den.

Filen er bygget af Cornerstones' stencil ("Process Diagram - Stencil.vssx"): aktiviteter, gateways, start/slut og pile er stencilets egne figurer, pilene er limet til punktet midt på figurernes sider (så de bliver der, når man flytter rundt), aktiviteterne er brede nok til lange ord, og svimlanerne er Visio-containere — så diagrammet kan arbejdes videre med i Visio som ethvert andet procesdiagram.

## Vedligehold

Scripts er bygget ud fra Corner IQ's kode (`lib/swimlane-layout`, `lib/swimlane-routing`, `lib/visio`). Ændres diagrammet eller Visio-eksporten i appen, bygges skillen igen i Corner IQ-projektet med `npx tsx scripts/skill/build-procesdiagram.ts` (den tekst du læser her ligger også dér, i `scripts/skill/procesdiagram/skill/`). Ret aldrig i `.mjs`-filerne i hånden.
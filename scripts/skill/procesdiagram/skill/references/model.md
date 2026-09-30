# model.json

Hele diagrammet i én fil. Id'er er korte, læsbare og unikke inden for
deres liste (`hr`, `godkend`, `gw-godkendt`).

```json
{
  "title": "Slå en stilling op",
  "pools": [{ "id": "partner", "name": "Rekrutteringspartner" }],
  "lanes": [
    { "id": "behov", "name": "Behovsejer" },
    { "id": "hr", "name": "HR" },
    { "id": "rp", "name": "Rekrutteringspartner", "pool": "partner" }
  ],
  "steps": [
    { "id": "start", "type": "START", "name": "Behov for ny medarbejder", "lane": "behov" },
    { "id": "skriv", "type": "TASK", "name": "Skriv stillingsopslag", "lane": "hr",
      "systems": ["Word"], "data": [{ "name": "Stillingsopslag", "dir": "out" }] },
    { "id": "godkend", "type": "TASK", "name": "Godkend opslaget", "lane": "behov" },
    { "id": "gw", "type": "DECISION", "name": "Er opslaget godkendt?", "lane": "behov" },
    { "id": "send", "type": "TASK", "name": "Send opslaget til partneren", "lane": "hr",
      "systems": ["Outlook"], "data": [{ "name": "Stillingsopslag", "dir": "in" }] },
    { "id": "del", "type": "TASK", "name": "Del opslaget i relevante kanaler", "lane": "rp" },
    { "id": "slut", "type": "END", "name": "Opslaget er sendt", "lane": "hr" }
  ],
  "flows": [
    { "from": "start", "to": "skriv" },
    { "from": "skriv", "to": "godkend" },
    { "from": "godkend", "to": "gw" },
    { "from": "gw", "to": "send", "label": "Ja" },
    { "from": "gw", "to": "skriv", "label": "Nej" },
    { "from": "send", "to": "del", "kind": "MESSAGE" },
    { "from": "send", "to": "slut" }
  ]
}
```

(Eksemplet viser formatet — det er ikke en kundes proces.)

## Felter

| Felt | Indhold |
|---|---|
| `title` | Procesnavnet. Står som titel på hovedpoolen og bliver filnavnet. |
| `pools` | Valgfri. **Ekstra** pools (eksterne parter) side om side til højre. Hovedpoolen er implicit og har `title` som navn. |
| `lanes` | Svimlanerne fra venstre mod højre. `pool` udeladt = hovedpoolen; ellers id'et på en ekstra pool. |
| `steps` | Skridtene **i forløbets rækkefølge**. `lane` er svimlanens id. |
| `steps[].systems` | Valgfri. Systemer aktiviteten bruges i — vises som `[Outlook, Word]` under teksten. |
| `steps[].data` | Valgfri, kun på `TASK`. Dokumenter ved siden af aktiviteten: `dir: "in"` = input (pil ind), `"out"` = output (pil ud). |
| `flows` | Pilene. `label` er teksten på pilen (svaret fra en gateway). `kind: "MESSAGE"` for pile mellem pools; ellers udelades den (sekvenspil). |

## Skridttyper

| `type` | Figur | Navn |
|---|---|---|
| `START` | Tynd cirkel, teksten over | En tilstand: "Faktura modtaget" |
| `TIMER_START` | Tynd cirkel med ur, teksten over — start på et fast tidspunkt | Tidspunktet: "Hver onsdag kl. 9" |
| `END` | Tyk cirkel, teksten under | En tilstand: "Fakturaen er betalt" |
| `TASK` | Afrundet boks med [systemer] | Udsagnsord først: "Kontér fakturaen" |
| `DECISION` | Rude med X — præcis én vej | Et spørgsmål: "Over 50.000 kr.?" |
| `PARALLEL` | Rude med + — alle veje samtidig | Kan være tomt |
| `INCLUSIVE` | Rude med O — én eller flere veje | Et spørgsmål |
| `EVENT_GATEWAY` | Rude med femkant — den første hændelse afgør vejen | Kan være tomt |
| `TIMER` | Dobbeltcirkel med ur — vent undervejs | Hvor længe: "Efter 14 dage" |

Brug `PARALLEL` både til at dele et forløb op og samle det igen.

## Sådan placeres skridtene

Du angiver ingen koordinater; layoutet regnes ud (samme regler som Corner IQ):

- **Rækker:** et skridt står én række under det seneste af de skridt, der
  peger på det. Pile *tilbage* i listen (løkker) skubber ikke noget ned.
  Skridt uden pil ind står rækken under det forrige i listen.
- **Samtidige skridt deler række** — i forskellige svimlaner eller, som
  grene fra samme gateway, side om side i samme svimlane.
- **Kolonner:** hovedforløbet står midt i svimlanen; grene fra samme skridt
  fordeles symmetrisk, og når de samles, står skridtet midt imellem.
- **Pile:** lige ned i samme kolonne; knæk hen over til en anden svimlane;
  en gren fra en gateway går ud til højre og uden om; en løkke tilbage op
  går ud til venstre.
- **Dokumenter:** står til højre for aktiviteten. Bruger en senere aktivitet
  samme dokument som input (samme `name`), og står den lige under (samme
  svimlane og kolonne, højst to rækker nede), går pilen fra det eksisterende
  dokument — ellers tegnes en kopi.

Står diagrammet mærkeligt, så tjek:

- Et skridt havner for langt nede → der går en pil ind i det fra et skridt
  længere nede i listen, eller rækkefølgen i `steps` er forkert.
- To skridt der burde stå side om side, står under hinanden → de har ikke
  samme forgænger, eller de står ikke lige efter hinanden i listen.
- En pil mangler → hver `from`/`to` skal være et skridt-id; scriptet siger til.

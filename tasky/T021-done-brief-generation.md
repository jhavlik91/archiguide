# T021 — Brief — generování z guide

**Track:** E (brief) | **Závislosti:** T020 | **Assignee:** —

## Goal
Z dokončené guide session vygenerovat strukturovaný projektový brief se všemi povinnými částmi dle `zadani/legacy-master-spec.md` §18. Brief je most mezi guide a marketplace — bez něj guide nemá výstup.

## User roles
B2C/B2B klient (vlastník guide session); nepřihlášený musí být před vytvořením briefu vyzván k registraci (`zadani/05-permission-matrix.md` — vytvořit brief: návštěvník C).

## Preconditions
T020 done. Guide session ve stavu `completed`.

## Main flow
1. Model `Brief` dle `zadani/10-domain-entities.md`: summary, goals, location, scope, budget, timing, inputs, missing inputs, risks, recommended professions, visibility; FK na `GuideSession` a `User`.
2. Generátor: mapování odpovědí session → sekce briefu. Povinné části dle §18: název (automaticky navržený, editovatelný), shrnutí (lidský popis, ne výpis odpovědí), cíl, lokalita, typ projektu, aktuální stav, rozsah, rozpočet, časový horizont, dostupné podklady, **chybějící podklady**, preference, **rizika a nejasnosti**, doporučené profese s důvody (převzato z T020), doporučený další krok.
3. „Nevím“ odpovědi se do briefu propíší poctivě jako neznámé/chybějící — žádné dopočítané hodnoty (`zadani/16-ai-team-execution-rules.md` §4).
4. Brief vzniká ve stavu `draft`, viditelnost `private` (default).
5. Obrazovka náhledu briefu po vygenerování + CTA sloty: upravit (T022), vytvořit poptávku (T024 — slot), uložit na později.
6. Anonymní uživatel: výzva k registraci, session i brief se po registraci připojí k účtu (naváže na mechanismus z T017).

## Alternative flows
Opakované generování z téže session → aktualizuje existující draft brief, nikdy nevytváří duplicitu; brief již `shared` → generátor ho nepřepíše (nabídne vytvoření revize, viz T022).

## Validation
Session musí být `completed` a patřit aktuálnímu uživateli/tokenu; povinné sekce nesmí chybět (mohou být „neuvedeno“).

## Permissions
Brief čte/píše jen vlastník. Přes `lib/permissions.ts`.

## States
Brief: `draft → ready → shared`, `shared → revised → shared`, `draft → archived` (`zadani/08-workflows-state-machines.md` §2). Tento task implementuje enum + přechod `draft → ready`; `shared`/`revised` řeší T022.

## Edge cases
Přesná adresa z guide zůstává v briefu jako soukromé pole — nikdy v shrnutí/názvu (`zadani/09-edge-cases.md` — Brief); session se samými „nevím“ → brief vznikne, sekce poctivě prázdné, doporučený krok = konzultace; uživatel smaže session → brief zůstává (snapshot, ne živá vazba).

## Analytics
Eventy: `brief_created` (viz `zadani/14-metrics-analytics.md`).

## Acceptance criteria
- [ ] E2E: dokončený guide → vygenerovaný brief se všemi povinnými sekcemi §18.
- [ ] „Nevím“ u rozpočtu → brief uvádí „rozpočet neuveden“, žádné vymyšlené číslo.
- [ ] Nový brief je vždy `draft` + `private`; nikde není veřejně dostupný.
- [ ] Opakované generování nevytvoří duplicitní brief.
- [ ] Doporučené profese v briefu mají u sebe důvod doporučení.

## Out of scope
Manuální editace, sdílení, export (T022), přílohy (T023), poptávka (T024).

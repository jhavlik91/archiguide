# T026 — Poptávky — výpis + detail

**Track:** F (marketplace) | **Závislosti:** T025 | **Assignee:** —

## Goal
Veřejný výpis aktivních poptávek s filtry a detail poptávky (anonymizovaná projekce z T025) — vstupní bod pro profesionály. Viz `zadani/legacy-master-spec.md` §20, `zadani/06-screen-catalog.md`.

## User roles
Profesionál (primární konzument), návštěvník (vidí výpis, k reakci potřebuje účet), vlastník (vidí vlastní poptávku v plné verzi).

## Preconditions
T025 done.

## Main flow
1. Výpis `/poptavky`: jen `active` veřejné poptávky, anonymizovaná karta (název, typ, region, profese, rozpočet orientačně, termín).
2. Filtry: profese (z taxonomie T005), region, typ projektu, rozpočtové pásmo; řazení dle data publikace; URL-persistované (sdílitelný odfiltrovaný výpis).
3. Stránkování (cursor), prázdný stav s doporučením rozšířit filtry (`zadani/07-screen-states.md`).
4. Detail poptávky: anonymizovaný brief, požadované profese, přílohy dle viditelnosti, stav poptávky viditelný (active/paused…), CTA „reagovat" (slot T027 — pro nepřihlášeného vede na přihlášení).
5. Vlastník na detailu své poptávky vidí plnou verzi + management akce (T024) a seznam reakcí (slot T027).
6. Profesionál s neveřejnou pozvánkou (RequestInvite z T025) vidí detail pozvané poptávky pod svým účtem.
7. Responsivní: karty na mobilu, filtry v drawer (`zadani/legacy-master-spec.md` §53.3).

## Alternative flows
Poptávka mezitím `paused`/`closed` → detail existuje, stav jasně komunikován, CTA reagovat deaktivováno s vysvětlením; smazaná/zrušená → 404 pro cizí, vlastník vidí archiv.

## Validation
Filtry validované proti taxonomii; neznámé hodnoty ignorovány (ne 500).

## Permissions
Výpis a detail veřejné poptávky: kdokoli; neveřejná jen vlastník + pozvaní; plná data jen vlastník (T025).

## States
Jen čtení stavů z T024; výpis zobrazuje pouze `active`.

## Edge cases
Prázdný výpis pro exotickou kombinaci filtrů → smysluplný empty state; poptávka expiruje mezi výpisem a otevřením detailu → detail ukáže aktuální stav; SEO: veřejný výpis indexovatelný, ale anonymizace platí i pro crawlery (žádná data navíc v metadatech).

## Analytics
Eventy: `request_viewed`, `request_list_filtered` (viz `zadani/14-metrics-analytics.md` — professional funnel).

## Acceptance criteria
- [ ] E2E: publikace poptávky (T024) → objeví se ve výpisu → detail zobrazí anonymizovanou verzi.
- [ ] Filtr dle profese vrací jen odpovídající poptávky.
- [ ] `paused` poptávka zmizí z výpisu, detail hlásí stav.
- [ ] Návštěvník: CTA reagovat vede na přihlášení, ne na chybu.
- [ ] Mobilní layout použitelný (filtry, karty).

## Out of scope
Reakce (T027), matching/doporučování (T028–T029), fulltext vyhledávání poptávek, uložená hledání a notifikace o nových poptávkách.

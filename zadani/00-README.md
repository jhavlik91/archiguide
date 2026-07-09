# BuildSphere — AI Product Delivery Pack

Tato sada dokumentů převádí produktovou vizi BuildSphere do podoby použitelné pro AI vývojový tým.

## Co je BuildSphere

BuildSphere je profesní síť, B2C guide a marketplace pro celý stavební ekosystém. Pomáhá uživatelům převést nejasný stavební problém na kvalitní brief, najít vhodné odborníky, sestavit tým, komunikovat, objednat služby a dlouhodobě budovat profesní reputaci.

## Zásadní principy

1. Problem-first B2C přístup.
2. Uživatel nemusí znát správnou profesi.
3. Odpověď „nevím“ nesmí být slepá ulička.
4. Veřejná a soukromá data musí být vždy oddělena.
5. Doporučení musí být vysvětlitelná.
6. Platforma nesmí předstírat odborné, právní ani bezpečnostní závěry tam, kde nemá dost vstupů.
7. Portfolio nesmí být omezeno jen na architekty.
8. Všechny klíčové flow musí fungovat na mobilu.
9. Monetizace nesmí zneprůhlednit pořadí doporučení.
10. Každá významná akce musí mít prázdný stav, chybový stav, alternativní stav a oprávnění.

## Dokumenty

- `01-master-prd.md` — hlavní produktové zadání
- `02-epics-features.md` — epics a funkční celky
- `03-user-stories.md` — detailní user stories
- `04-acceptance-criteria.md` — acceptance criteria
- `05-permission-matrix.md` — role a oprávnění
- `06-screen-catalog.md` — katalog obrazovek
- `07-screen-states.md` — loading/empty/error/permission/offline stavy
- `08-workflows-state-machines.md` — workflow a stavové modely
- `09-edge-cases.md` — edge cases a konfliktní situace
- `10-domain-entities.md` — produktový doménový model bez technologií
- `11-notifications.md` — notifikace a komunikační pravidla
- `12-moderation-trust-safety.md` — trust, safety, verifikace, moderace
- `13-monetization.md` — monetizační model
- `14-metrics-analytics.md` — produktové metriky a eventy
- `15-release-roadmap.md` — roadmapa a implementační balíky
- `16-ai-team-execution-rules.md` — pravidla práce pro AI vývojový tým
- `17-qa-acceptance-pack.md` — end-to-end akceptační scénáře
- `18-content-taxonomy.md` — taxonomie profesí, služeb a typů projektů

## Doporučené pořadí implementace

1. Role, identity, privacy a organizace
2. Profesionální profily
3. Portfolio
4. B2C guide
5. Brief
6. Poptávky
7. Matching
8. Messaging
9. Notifikace
10. Trust a reviews
11. Produktizované služby
12. Jobs / Team marketplace
13. Project workspace
14. Social feed
15. Supplier ecosystem
16. Pokročilá monetizace

## Definition of Ready

Feature je připravena k implementaci pouze pokud má:

- jasný cíl,
- definované role,
- vstupy a výstupy,
- happy path,
- alternativní flow,
- validační pravidla,
- oprávnění,
- edge cases,
- prázdný stav,
- chybový stav,
- acceptance criteria,
- analytické eventy,
- závislosti.

## Definition of Done

Feature je hotová pouze pokud:

- splní acceptance criteria,
- funguje na mobilu i desktopu,
- respektuje oprávnění,
- neodhaluje soukromá data,
- má error/empty/loading stavy,
- má přístupné ovládání,
- podporuje základní audit významných změn,
- má popsané analytické události,
- neobsahuje slepé uličky.

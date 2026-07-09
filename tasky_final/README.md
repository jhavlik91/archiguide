# Tasky — finální produkt (post-MVP)

Návrh rozpadu features finálního produktu na atomické tasky. Navazuje číslováním na `tasky/` (MVP = T001–T037), čísla se nikdy nerecyklují. Pokrývá Packages 9 (dokončení) až 15 dle `zadani/15-release-roadmap.md` a fáze 3–5 dle `zadani/legacy-master-spec.md` §56.

## Stav `draft`

Tasky zde jsou **návrh rozpadu**, ne ready-for-development:

```
T<###>-draft-<slug>.md
```

Životní cyklus: `draft → rfd → done`. Před zahájením vývoje se task rozpracuje do plné handoff šablony (`zadani/16-ai-team-execution-rules.md` §12 — jako v `tasky/`), přejmenuje na `rfd` a **přesune do `tasky/`**. Draft formát obsahuje: Goal, Závislosti, Scope, Klíčová pravidla, Akceptační náčrt, Out of scope.

## Tracky a dependency graf

Prerekvizita všeho: MVP hotové (T001–T037 `done`). Závislosti na MVP taskách uvedeny v jednotlivých souborech.

```
Track I (trust+):        T038 → T039, T040
Track J (služby):        T041 → T042
Track K (jobs/team/kap): T043 → T044, T045, T046
Track L (workspace):     T047 → {T048, T049, T051, T052}, T048 → T050
Track M (social):        T053 → T054 → T055, T056 → T057
Track N (monetizace):    T058 → T059 → {T060, T061, T062}
Track O (supplier):      T063 → T064
Track P (platforma):     T065, T066, T067, T068, T069
```

Tracky I–P jsou vzájemně převážně nezávislé; výjimky: T064 → T061 (promoted products), T068 → T041 (vyhledávání služeb), T069 → T058 (entitlements), T042 → volitelně T059 (platby).

## Doporučené pořadí (dle roadmapy a exit criteria)

1. **Public launch blokery** (`zadani/15-release-roadmap.md`): Track I (verification workflow, review abuse controls), T065 (notification channels), Track N základ (monetization transparent).
2. **Fáze 2 — Trust & conversion:** Track J (produktizované služby), T068.
3. **Fáze 3 — Professional network:** Track K, Track M (T053–T055).
4. **Fáze 4 — Project workspace:** Track L.
5. **Fáze 5 — Commercial ecosystem:** zbytek Tracku N, Track O, T066, T067, T069.

## Přehled

| # | Task | Track | Závislosti |
|---|---|---|---|
| T038 | Verifikace — identita + verifikační fronta | I | T011, T035 |
| T039 | Verifikace — firma, kvalifikace, autorizace, pojištění | I | T038, T009 |
| T040 | Review abuse controls + appeals | I | T037, T036 |
| T041 | Produktizované služby — nabídka | J | T007, T005 |
| T042 | Služby — objednávka + rezervace konzultace | J | T041, T030, T032 |
| T043 | Jobs — pracovní nabídky | K | T009, T005 |
| T044 | Jobs — application flow | K | T043, T030 |
| T045 | Team marketplace — poptávka profesionála | K | T024, T007 |
| T046 | Kapacitní marketplace | K | T007 |
| T047 | Projektová místnost — core | L | T024, T030 |
| T048 | Workspace — soubory, brief, poznámky | L | T047, T023 |
| T049 | Workspace — milníky + úkoly | L | T047 |
| T050 | Schvalování s verzemi | L | T048 |
| T051 | Messaging — skupinové/projektové konverzace | L | T030, T047 |
| T052 | Projektové týmy — role + veřejná prezentace | L | T047, T012 |
| T053 | Profesní síť — follow + propojení | M | T008 |
| T054 | Feed | M | T053, T016, T026 |
| T055 | Interakce — like, komentáře, uložení, sdílení | M | T054, T036 |
| T056 | Moodboardy | M | T016, T023 |
| T057 | Inspirace → guide | M | T056, T017 |
| T058 | Plány + entitlements engine | N | T004 |
| T059 | Billing + subscription lifecycle | N | T058 |
| T060 | Lead monetizace | N | T059, T027 |
| T061 | Sponsored + featured placement | N | T059, T028, T034 |
| T062 | B2C Premium | N | T059, T021 |
| T063 | Supplier — profily + katalogy produktů | O | T009, T005 |
| T064 | Supplier — lead capture + promoted products | O | T063, T061 |
| T065 | Notifikace — SMS + push | P | T033 |
| T066 | Pokročilé úpravy obrázků (AI) | P | T015 |
| T067 | Admin — editor guide scénářů | P | T035, T019 |
| T068 | Vyhledávání — rozšíření | P | T034, T041, T037 |
| T069 | Messaging — ochrana kontaktů dle fáze interakce | P | T031, T058 |

## Pravidla

Platí vše z `tasky/README.md` a `TECHNICKE-ZADANI.md` §4. Navíc pro post-MVP: dřívější package nesmí být rozšířen tak, aby zablokoval pozdější multi-profession use cases (`zadani/15-release-roadmap.md`); monetizace nikdy neporušuje transparentnost matchingu (`zadani/13-monetization.md` §1, §8).

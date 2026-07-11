# T012 — Portfolio projekt — CRUD + stavy

**Track:** C (portfolio) | **Závislosti:** T004 | **Assignee:** —

## Goal
Datový model a životní cyklus portfolio projektu (draft/publish, verze, spoluautoři). Viz `zadani/legacy-master-spec.md` §24–25, entita PortfolioProject.

## User roles
Professional / org member (editor+) jako vlastník; spoluautoři.

## Preconditions
Profil (T007) nebo organizace (T009) — vlastníkem může být obojí (polymorfní owner).

## Inputs
Titul, typ projektu, lokalita (jen město/region), rok, krátký popis, viditelnost.

## Main flow
1. Modely `PortfolioProject` (owner user|org, title, type, location, year, description, visibility, publicationStatus) a `PortfolioCoauthor` (user, status potvrzení).
2. CRUD: založení, editace metadat, smazání (soft delete).
3. Publikační cyklus: `draft` → `published` → zpět do `draft` (unpublish). Publikovaná verze zůstává viditelná, dokud se nepublikuje nová (snapshot obsahu při publish).
4. Spoluautoři: pozvání → potvrzení → uvedení na projektu (bez potvrzení se jméno nezobrazuje — `zadani/16-ai-team-execution-rules.md` §7).

## Alternative flows
Spoluautor odmítne / zruší potvrzení → z veřejného projektu zmizí.

## Validation
Titul povinný; rok v rozumném rozsahu; publish vyžaduje min. 1 blok obsahu (kontrola přes T013 API).

## Permissions
Editace: vlastník + org editor+. Čtení draftu: jen editoři a pozvaní spoluautoři.

## States
`draft` | `published` | `archived`; coauthor: `invited|confirmed|declined`.

## Edge cases
Dílo více autorů; owner = organizace a člen odejde; smazání projektu s potvrzenými spoluautory (notifikovat — slot pro T032).

## Analytics
Eventy: `portfolio.created`, `portfolio.published`.

## Acceptance criteria
- [ ] Draft není veřejně dostupný (e2e).
- [ ] Publish → unpublish → obsah opět skrytý.
- [ ] Nepotvrzený spoluautor se nezobrazuje.
- [ ] Snapshot: úpravy draftu po publish nemění veřejnou verzi do další publikace.

## Out of scope
Blokový editor (T013), media (T014), veřejný render (T016).

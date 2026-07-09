# T005 — Taxonomie profesí + seed

**Track:** A (foundation) | **Závislosti:** T002 | **Assignee:** —

## Goal
Datový model a seed kompletní taxonomie profesí dle `zadani/18-content-taxonomy.md` a `zadani/legacy-master-spec.md` §5 (17 kategorií).

## User roles
N/A (data); čte kdokoli, spravuje admin (T035).

## Preconditions
T002 done.

## Main flow
1. Modely `ProfessionCategory`, `Profession`, `Specialization` dle `zadani/10-domain-entities.md`: name, slug, synonyms[], regulated flag, required verification hints, vazby.
2. Seed všech kategorií a profesí ze zadání (Architecture & Design … Supply).
3. Query vrstva `features/taxonomy/`: strom kategorií, vyhledání profese podle názvu/synonyma.

## Validation
Slug unikátní; profese vždy patří do kategorie.

## Permissions
Čtení veřejné; zápis pouze admin (implementace admin UI v T035).

## States
`active` | `archived` (archivovaná profese zůstává na historických datech, nelze ji nově vybrat).

## Edge cases
Profesionál s více profesemi (M:N — vazbu vlastní T007); synonymum kolidující s názvem jiné profese.

## Analytics
N/A.

## Acceptance criteria
- [ ] `prisma db seed` naplní všech 17 kategorií a všechny profese ze zadání.
- [ ] Vyhledání „topenář“ i podle synonyma vrátí správnou profesi (unit test).
- [ ] Archivovaná profese se nenabízí v číselnících.

## Out of scope
Admin UI pro správu (T035), vazba profil↔profese (T007).

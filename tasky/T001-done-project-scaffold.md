# T001 — Project scaffold + CI

**Track:** A (foundation) | **Závislosti:** — | **Assignee:** Claude Opus 4.8 (`claude-opus-4-8`)

## Goal
Založit Next.js aplikaci s kompletním dev tooling a CI, aby všechny další tasky měly stabilní základ.

## User roles
N/A (infrastruktura).

## Preconditions
Prázdné repo.

## Main flow
1. Next.js 15 (App Router) + TypeScript strict, `src/` layout dle `TECHNICKE-ZADANI.md` §3.
2. Tailwind CSS, ESLint, Prettier.
3. Vitest (unit) + Playwright (e2e) + Storybook — každé s jedním smoke testem.
4. GitHub Actions workflow: lint, typecheck, unit testy, build na každý PR.
5. `README.md` s instrukcemi pro lokální spuštění.
6. Route groups: `(public)`, `(app)`, `(admin)` s placeholder stránkami.

## Validation
CI musí selhat při lint/type chybě.

## States / Permissions / Analytics
N/A.

## Edge cases
—

## Acceptance criteria
- [ ] `npm run dev` nastartuje aplikaci s placeholder homepage.
- [ ] `npm run lint`, `typecheck`, `test`, `build` procházejí lokálně i v CI.
- [ ] Storybook se spustí a obsahuje aspoň jednu story.
- [ ] Playwright smoke test projde proti dev serveru.

## Out of scope
Databáze (T002), auth (T003), design system (T006).

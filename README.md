# ArchiGuide

Platforma propojující investory s architekty a profesionály ve stavebnictví.
Podrobné zadání viz [`TECHNICKE-ZADANI.md`](./TECHNICKE-ZADANI.md) a složka
[`zadani/`](./zadani).

## Technologický stack

- **Next.js 15** (App Router) + **TypeScript** (strict)
- **Tailwind CSS v4**
- **ESLint** + **Prettier**
- **Vitest** (unit) · **Playwright** (e2e) · **Storybook** (komponenty)
- CI: **GitHub Actions** (lint, typecheck, unit testy, build, e2e)

Databáze, autentizace a design system se doplňují v navazujících taskách
(T002, T003, T006).

## Požadavky

- Node.js ≥ 20
- npm ≥ 10

## Lokální spuštění

```bash
npm install                 # instalace závislostí
npx playwright install chromium   # jednorázově, pro e2e testy
npm run dev                 # dev server na http://localhost:3000
```

## Skripty

| Skript                    | Popis                                     |
| ------------------------- | ----------------------------------------- |
| `npm run dev`             | Dev server (http://localhost:3000)        |
| `npm run build`           | Produkční build                           |
| `npm run start`           | Spuštění produkčního buildu               |
| `npm run lint`            | ESLint                                    |
| `npm run typecheck`       | Kontrola typů (`tsc --noEmit`)            |
| `npm run test`            | Unit testy (Vitest)                       |
| `npm run test:watch`      | Unit testy ve watch režimu                |
| `npm run test:e2e`        | E2e testy (Playwright, proti dev serveru) |
| `npm run storybook`       | Storybook na http://localhost:6006        |
| `npm run build-storybook` | Build statického Storybooku               |
| `npm run format`          | Formátování Prettierem                    |
| `npm run format:check`    | Kontrola formátování                      |

## Struktura projektu

```
src/
  app/                # routy (App Router)
    (public)/         # veřejné stránky   → /
    (app)/            # přihlášená část   → /dashboard
    (admin)/          # administrace      → /admin
  features/<domena>/  # doménová logika (actions, queries, komponenty, testy)
  lib/                # sdílené utility (db klient, permissions, …)
  components/ui/      # design system
e2e/                  # Playwright testy
.storybook/           # konfigurace Storybooku
```

Podrobnosti k architektuře a pravidlům viz `TECHNICKE-ZADANI.md` §3–4.

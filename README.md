# ArchiGuide

Platforma propojující investory s architekty a profesionály ve stavebnictví.
Podrobné zadání viz [`TECHNICKE-ZADANI.md`](./TECHNICKE-ZADANI.md) a složka
[`zadani/`](./zadani).

## Technologický stack

- **Next.js 15** (App Router) + **TypeScript** (strict)
- **PostgreSQL** + **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **Tailwind CSS v4**
- **ESLint** + **Prettier**
- **Vitest** (unit) · **Playwright** (e2e) · **Storybook** (komponenty)
- CI: **GitHub Actions** (lint, typecheck, unit testy, build, e2e, migrace)

Design system se doplňuje v navazujícím tasku (T006).

## Autentizace (T003)

Auth.js (NextAuth v5) s JWT session:

- **Registrace / login** e-mailem a heslem (bcrypt), volitelně **Google OAuth**
  (zapne se, jsou-li nastaveny `AUTH_GOOGLE_ID` a `AUTH_GOOGLE_SECRET`).
- **Reset hesla** přes jednorázový token (platnost 1 h) — v DB jen jeho hash.
- **Middleware** (`src/middleware.ts`) chrání sekce `(app)` a `(admin)`;
  nepřihlášeného přesměruje na `/login` se zachováním návratové URL. `(public)`
  routy jsou vždy dostupné.
- Citlivé akce (login, reset) jsou omezené na 5 pokusů / min / IP.

V dev/testu se odchozí e-maily neposílají, ale ukládají do in-memory outboxu;
poslední e-mail pro adresu lze přečíst přes `GET /api/dev/outbox?to=<email>`
(v produkci 404). `AUTH_SECRET` je povinný — viz `.env.example`.

## Média a knihovna (T014)

Sdílená služba pro obrázky (portfolio, profily, přílohy). Model `MediaAsset` má
polymorfního vlastníka (uživatel/organizace); **originál se nikdy nepřepisuje**,
deriváty (thumbnail, web) generuje `sharp` jako nové soubory a **bez GPS EXIF**
(privacy). Upload jde přímým multipartem přes `POST /api/media/upload` (whitelist
JPEG/PNG/WebP dle obsahu, max 25 MB, ≤ 20 souborů/dávka); servírování přes
chráněnou routu `GET /api/media/[id]/[variant]` — originál jen vlastník, derivát
i veřejnost, ale jen u assetu použitého v publikovaném obsahu. Knihovna je na
`/media`. Mazání je měkké (originál zůstává obnovitelný); asset použitý
v publikovaném obsahu smazat nelze (blok s odkazy).

Fyzická data drží storage adaptér za jedním interfacem: `filesystem` (dev,
výchozí, do `MEDIA_STORAGE_DIR` mimo `public/`) nebo `s3` (prod). Volba přes
`MEDIA_STORAGE_DRIVER` — viz `.env.example`.

## Požadavky

- Node.js ≥ 20
- npm ≥ 10
- Docker (lokální PostgreSQL přes `docker compose`)

## Lokální spuštění

```bash
npm install                 # instalace závislostí (spustí prisma generate)
cp .env.example .env        # připojení k DB (výchozí odpovídá docker-compose)
npm run db:up               # PostgreSQL v Dockeru
npm run db:migrate          # aplikace migrací (prisma migrate dev)
npm run db:seed             # seed (zatím prázdný)
npx playwright install chromium   # jednorázově, pro e2e testy
npm run dev                 # dev server na http://localhost:3000
```

## Skripty

| Skript                      | Popis                                     |
| --------------------------- | ----------------------------------------- |
| `npm run dev`               | Dev server (http://localhost:3000)        |
| `npm run build`             | Produkční build                           |
| `npm run start`             | Spuštění produkčního buildu               |
| `npm run lint`              | ESLint                                    |
| `npm run typecheck`         | Kontrola typů (`tsc --noEmit`)            |
| `npm run test`              | Unit testy (Vitest)                       |
| `npm run test:watch`        | Unit testy ve watch režimu                |
| `npm run test:e2e`          | E2e testy (Playwright, proti dev serveru) |
| `npm run storybook`         | Storybook na http://localhost:6006        |
| `npm run build-storybook`   | Build statického Storybooku               |
| `npm run format`            | Formátování Prettierem                    |
| `npm run format:check`      | Kontrola formátování                      |
| `npm run db:up`             | Spuštění PostgreSQL v Dockeru             |
| `npm run db:down`           | Zastavení PostgreSQL                      |
| `npm run db:migrate`        | Vývojová migrace (`prisma migrate dev`)   |
| `npm run db:migrate:deploy` | Aplikace migrací (CI/produkce)            |
| `npm run db:seed`           | Seed databáze                             |
| `npm run db:reset`          | Reset DB + migrace + seed                 |
| `npm run db:studio`         | Prisma Studio                             |

## Databáze

PostgreSQL + Prisma 7. Připojení řídí `DATABASE_URL` (viz `.env.example`).
Schema je v [`prisma/schema.prisma`](./prisma/schema.prisma), členěné
komentářovými sekcemi per doména — každý task přidává modely do své sekce a
**vlastní append-only migraci**; cizí modely se nemění (viz
`TECHNICKE-ZADANI.md` §4.2).

Prisma 7 přesouvá connection URL a nastavení migrací do
[`prisma.config.ts`](./prisma.config.ts); klient se připojuje přes driver
adapter (`src/lib/db.ts`). E-mail `User.email` je typu `citext`, což vynucuje
case-insensitive unikátnost na úrovni DB.

## Struktura projektu

```
src/
  app/                # routy (App Router)
    (public)/         # veřejné stránky   → /
    (app)/            # přihlášená část   → /dashboard
    (admin)/          # administrace      → /admin
  features/<domena>/  # doménová logika (actions, queries, komponenty, testy)
  lib/                # sdílené utility (db klient, email, permissions, …)
  components/ui/      # design system
prisma/
  schema.prisma       # datový model (sekce per doména)
  migrations/         # append-only migrace
  seed/               # seed skripty
e2e/                  # Playwright testy
.storybook/           # konfigurace Storybooku
docker-compose.yml    # lokální PostgreSQL
```

Podrobnosti k architektuře a pravidlům viz `TECHNICKE-ZADANI.md` §3–4.

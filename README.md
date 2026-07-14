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

## Přílohy (T023)

Generický systém příloh (dokumenty, PDF, obrázky) použitelný napříč doménami —
brief, poptávka, reakce, zprávy. Konzumující domény mají jeden vstupní bod:
`@/lib/attachments` (`attach`, `canAccess`, `registerContextResolver`) a **nepíšou
vlastní přístupovou logiku**.

- **Viditelnost** je explicitní: `private` (výchozí — nová příloha je vždy
  soukromá), `shared_in_context` (účastníci daného kontextu) nebo `public`. Změna
  viditelnosti je vědomá akce; u přílohy se **sensitivity flagem** zpřístupnění
  vyžaduje explicitní potvrzení (varování před odhalením osobních údajů).
- **Kontext je polymorfní** (`contextType` + `contextId`) — attachment nezná
  konkrétní doménu. Doména si registruje resolver
  (`registerContextResolver("brief", …)`), který řekne, zda kontext existuje a kdo
  je jeho účastníkem. Neznámý kontext je fail-closed.
- **Stažení jde vždy přes autorizovanou routu** `GET /api/attachments/[id]`
  s kontrolou `canAccess` — soubory leží mimo `public/`, soukromá příloha není
  dostupná žádnou nepodepsanou URL. Upload přes `POST /api/attachments/upload`
  (whitelist dle **obsahu**: obrázky + PDF; max velikost `ATTACHMENT_MAX_BYTES`).
- **Mazání je měkké**; konzumující kontext zobrazí placeholder „příloha byla
  odstraněna" (komponenta `AttachmentItem`), ne rozbitý odkaz.

Storage adaptér je stejný jako u médií: `ATTACHMENT_STORAGE_DRIVER`
(`filesystem` výchozí | `s3`), `ATTACHMENT_STORAGE_DIR` — viz `.env.example`.

## Brief — editace, sdílení, export (T022)

Vygenerovaný brief (T021, `/brief/[id]`) lze ručně upravovat, sdílet privátním
odkazem a exportovat. Stav řídí automat (`zadani/08` §2):
`draft → ready → shared`, `shared → revised → shared`, `draft → archived` —
neplatné přechody server odmítne (`features/brief/transitions.ts`).

- **Editace** (`/brief/[id]/upravit`): všechny sekce §18 formulářem (ne volný
  text), **autosave** s debounce — nikdy neztratit rozpracované změny. Odvozená
  pole (dostupné/chybějící podklady) se přebírají z odpovědí a editor je nemění
  (merge je zachová). Úprava **sdíleného** briefu ho posune `shared → revised`;
  příjemci vidí starší snapshot, dokud vlastník znovu nesdílí.
- **Sdílení odkazem**: vygeneruje odvolatelný token (capability URL v plaintextu,
  jen READ-ONLY přístup ke **zmrazenému snapshotu**). Sdílená stránka
  `/sdileny-brief/[token]` je veřejná, bez přihlášení, **`noindex`**, a nikdy
  neukazuje přesnou adresu ani soukromé přílohy. **Odvolání** token okamžitě
  zneplatní (stránka vrací „odkaz již není platný"). Před sdílením proběhne
  **privacy kontrola** (`zadani/12` §8): najde-li text vzor přesné adresy /
  telefonu / e-mailu, zobrazí **neblokující** varování k vědomému potvrzení.
- **Export** (`/brief/[id]/export`): tisknutelná stránka (tisk prohlížeče → PDF
  stačí pro MVP). Výchozí export **neobsahuje soukromá pole** (přesná adresa);
  zahrnou se jen s explicitním `?soukrome=1`. Tisk izoluje obsah od zbytku appky
  přes `@media print` (viz `globals.css`).
- **Přílohy**: brief registruje resolver kontextu pro sdílený systém příloh
  (T023) — účastníkem kontextu je jen vlastník (brief je soukromá data).
- Přístup (editace/sdílení/export/archivace) má **jen vlastník**; čtení sdílené
  verze jde přes token bez přihlášení. Analytika: `brief.edited`, `brief.shared`,
  `brief.share_revoked`, `brief.exported`, `brief.archived`.

## Zprávy (T030)

Konverzace 1:1 mezi přihlášenými uživateli, textové zprávy, stav přečtení a inbox
(`/messages`). Číst i psát smí **výhradně účastníci** konverzace — rozhodnutí jde
přes permission vrstvu (`messaging.access_conversation` / `send_message`), žádný
jiný uživatel ani role konverzaci neotevře (cizí → 404, nepotvrzujeme existenci).

- **Kontext vzniku je polymorfní** (`contextType` + `contextId`, bez FK) —
  konverzace vzniká z poptávky/reakce/profilu, nebo napřímo. Znovupoužití hlídá
  deterministický `dedupeKey` (kontext + seřazená ID účastníků): **stejná dvojice
  ve stejném kontextu nikdy nezaloží druhou konverzaci**.
- **Odeslání je idempotentní** přes `clientToken` (double-click nevytvoří
  duplikát) a **nikdy falešně nehlásí úspěch** — při selhání zůstane rozepsaný
  text v poli k opětovnému odeslání (optimistické UI s potvrzením uložení).
- **Stav přečtení** je per-účastník (`lastReadAt`) → nepřečtené počítadlo v
  inboxu; **archivace** je také per-účastník. Nové zprávy chodí pollingem
  (revalidace, bez websocketů v MVP).
- **Bezpečnost obsahu:** zprávy se renderují vždy jako **text, nikdy HTML** (XSS).
  Zrušený účet zůstává v historii jako placeholder „Zrušený účet"; vůči
  zrušené/deaktivované protistraně je odeslání zablokované s vysvětlením.

Přílohy, block/report a ochranu kontaktů řeší T031; notifikace T032/T033.

## Poptávky (T024)

Jádro marketplace: poptávka (`Request`) navázaná na projektový brief, s CRUD a
kompletním **stavovým automatem**. Poptávka vzniká **vždy z briefu** (guide je
kritická cesta) předvyplněná z jeho obsahu; jeden brief může mít víc poptávek
(jiné profese). Přehled vlastníka je na `/requests`, detail a řízení na
`/requests/[id]`.

- **Stavový automat** (`draft → active → in_discussion → awarded → closed`,
  `active → paused → active`, `active → cancelled|expired`,
  `in_discussion|paused → cancelled`) je **jediným** způsobem změny stavu —
  `features/requests/state-machine.ts` je zdroj pravdy, **neplatný přechod server
  odmítne**. Přechody běží jako server akce s kontrolou oprávnění.
- **Publikace dle permission matice** (`zadani/05` — „Publikovat B2C/B2B
  poptávku"): návštěvník nikdy, účet pouze s rolí moderátor nikdy; jinak vlastník
  (admin cokoliv). CRUD a ostatní přechody smí jen vlastník nebo admin.
- **Snapshot briefu při publikaci** (`briefSnapshot`): pozdější změna briefu už
  publikovanou poptávku neovlivní (zadani/09 — Request). Po publikaci je možné jen
  **upřesnění** (rozpočet/termín/čas), ne změna smyslu — s viditelnou poznámkou
  „upraveno".
- **Expirace**: `active` poptávka s prošlým termínem přejde do `expired` (kontrola
  při čtení + hromadná funkce `expireDueRequests` pro denní job) a nepřijímá
  reakce.
- **Audit** významných přechodů (publish/pause/resume/cancel/award/close/expire)
  je append-only (`RequestAuditEntry`) s aktérem a `from→to` stavem.
- **Viditelnost** je zatím jen pole (`private` default) — anonymizaci a veřejný
  výpis řeší T025/T026; reakce T027, matching T028.

## Vyhledávání profesionálů (T034)

Veřejný katalog a fulltextové vyhledávání profesionálů na `/profesionalove` —
bez externího enginu, přes Postgres `tsvector`. Hledá se v headline, biu,
specializacích, názvech profesí i názvech **publikovaných** portfolio projektů.

- **Diakritika nerozhoduje** — `unaccent` na obou stranách, takže „zámečník"
  i „zamecnik" vrací stejné výsledky. Dotaz je prefixový (`slovo:*`) a bezpečně
  escapovaný: z uživatelského vstupu se berou jen alfanumerické tokeny, žádný
  `to_tsquery` operátor se z něj neprovede.
- **Synonyma profesí** z taxonomie (T005): „projektant" najde i profil s profesí
  „projektant pozemních staveb", i když ji nemá doslovně v textu.
- **Filtry** (profese, region/lokalita, specializace, ověřený účet) a **řazení**
  (relevance / nejnovější) jsou **URL-persistované** — sdílitelné a SEO
  indexovatelné; stránkuje se kurzorem (keyset, stabilní tie-break přes `id`).
  Neznámý slug profese se ignoruje (nezmrazí výsledky).
- **Jen veřejné, publikované profily** aktivních uživatelů. Draft/deaktivovaný se
  ve výsledcích nikdy neobjeví; karta nenese žádná privátní pole (adresa,
  kontakty) a ověření uvádí přesně (badge „Ověřený telefon", ne paušální
  „Verified"). Odpublikování profilu ho z výsledků odstraní **okamžitě** —
  dokument se skládá za běhu z živého stavu (bez materializovaného indexu;
  ten je připravená cesta pro škálování, viz `features/search/service.ts`).
- **Prázdný výsledek** nekončí ve slepé uličce — nabídne konkrétní kroky
  (rozšířit region, odebrat filtr, zkusit příbuznou profesi, zobrazit vše).

Migrace T034 přidává jen rozšíření `unaccent`; nemění cizí tabulky (T007/T012).

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

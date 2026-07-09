# ArchiGuide — Technické zadání

**Verze:** 1.0
**Zdroj:** produktové zadání ve složce `zadani/` (zejména `01-master-prd.md`, `02-epics-features.md`, `10-domain-entities.md`, `15-release-roadmap.md`, `16-ai-team-execution-rules.md`)
**Scope tohoto dokumentu:** MVP = Packages 1–8 + základ Package 9 (admin/moderace) dle `zadani/15-release-roadmap.md`

---

## 1. Cíl MVP

Funkční platforma pokrývající: B2C guide → generovaný brief → poptávka → matching → reakce profesionála → messaging → e-mail notifikace. K tomu profesionální profily, firmy, portfolio, vyhledávání, základní role/oprávnění a administrace kategorií.

Bez B2C guide platforma ztrácí hlavní diferenciaci — guide je kritická cesta.

---

## 2. Technologický stack

| Vrstva | Volba |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui, Storybook pro komponenty |
| Databáze | PostgreSQL + Prisma ORM |
| Auth | Auth.js (e-mail + heslo, Google OAuth) |
| Media storage | S3-kompatibilní úložiště (produkce), lokální filesystem (dev) |
| E-mail | Resend (dev: konzolový/preview transport) |
| Fulltext | PostgreSQL `tsvector` (bez externího search enginu v MVP) |
| Testy | Vitest (unit), Playwright (e2e), Storybook (komponenty) |
| CI | GitHub Actions: lint, typecheck, unit testy, build |

Zdůvodnění: monolit v Next.js minimalizuje infrastrukturu, server actions + route handlers pokryjí API, Postgres pokryje fulltext i JSON (guide answers) bez dalších služeb.

---

## 3. Architektura

```
src/
  app/                  # routy (App Router), pouze kompozice
    (public)/           # veřejné stránky: profily, portfolia, poptávky
    (app)/              # přihlášená část: dashboard, guide, zprávy…
    (admin)/            # administrace
    api/                # route handlers (webhooky, upload…)
  features/<domena>/    # doménová logika: actions, queries, komponenty, testy
    auth/ profiles/ organizations/ portfolio/ guide/ brief/
    requests/ matching/ messaging/ notifications/ search/
    reviews/ moderation/ admin/ attachments/ media/
  lib/                  # sdílené: db klient, auth helpery, permissions, utils
  components/ui/        # design system (shadcn/ui + vlastní)
prisma/
  schema.prisma         # členěno komentářovými sekcemi per doména
  seed/                 # taxonomie profesí, guide scénáře
```

### Zásady

1. **Feature izolace.** Každý task pracuje primárně ve „své“ složce `features/<domena>/`. Sdílený kód jde do `lib/` nebo `components/ui/` — změny tam musí být zpětně kompatibilní.
2. **DB migrace append-only.** Každý task přidává vlastní modely do své sekce `schema.prisma` a vlastní migraci. Cizí modely se nemění; potřebná vazba na cizí model se řeší FK ze svého modelu.
3. **Server-first.** Mutace přes server actions s validací (Zod). Žádná business logika v klientských komponentách.
4. **Permission vrstva.** Veškeré čtení/zápis přes helpery v `lib/permissions.ts` (viz `zadani/05-permission-matrix.md`). Zákaz ad-hoc kontrol rolí v UI.
5. **Stavové modely** přesně dle `zadani/08-workflows-state-machines.md` — stavy jsou enum v DB, přechody validované na serveru.

---

## 4. Průřezová pravidla (závazná, viz `zadani/16-ai-team-execution-rules.md`)

- Přesná adresa, telefon, e-mail: **private by default**, zveřejnění jen vědomou akcí uživatele.
- „Nevím“ je validní odpověď — nikdy neblokuje flow.
- Draft nikdy není veřejný; draft a published jsou oddělené stavy.
- Žádné hardcodování jedné profese, jedné firmy na uživatele, jedné role.
- Každé doporučení (matching) musí umět vysvětlit důvod; žádná falešná přesnost.
- Originál média musí být obnovitelný po úpravách.
- Nikdy falešně nehlásit úspěch uložení; neztratit draft bez upozornění.
- Sponzorovaný obsah vždy transparentně označen.

---

## 5. Workflow tasků

Tasky jsou ve složce `tasky/`, jeden soubor = jeden atomický task pro jednoho agentického vývojáře.

### Pojmenování

```
T<###>-<stav>-<slug>.md      např. T017-rfd-guide-schema-engine.md
```

- `###` — unikátní trojmístné číslo, nikdy se nerecykluje.
- `<stav>` — `rfd` (ready for development) | `done`. Změna stavu = přejmenování souboru.
- Stav rozpracovanosti se řeší přiřazením (pole *Assignee* v souboru), ne názvem.

### Definition of Done

1. Splněná všechna akceptační kritéria z tasku.
2. Unit testy pro validace a stavové přechody, e2e test pro happy path (kde task definuje flow).
3. `lint`, `typecheck`, `build` zelené v CI.
4. Zodpovězeny kontrolní otázky z `zadani/16-ai-team-execution-rules.md` §3 (návštěvník / vlastník / cizí uživatel / mobil / chyba / prázdný stav).
5. PR review, merge do `main`, přejmenování tasku na `done`.

### Paralelizace

Tasky jsou navržené pro souběžný vývoj. Každý task uvádí **Závislosti** (čísla tasků, které musí být `done`). Graf drah:

```
Track A (foundation): T001 → T002 → {T003, T004, T005, T006}
Track B (profily):    T007 → T008, T009 → T010, T011
Track C (portfolio):  T012 → {T013, T016}, T014 → T015
Track D (guide):      T017 → {T018, T019} → T020
Track E (brief):      T021 → T022, T023
Track F (marketplace):T024 → {T025, T026, T027}, T028 → T029
Track G (komunikace): T030 → T031, T032 → T033
Track H (trust/admin):T034, T035, T036, T037
```

Po dokončení Tracku A lze jet tracky B–H paralelně.

---

## 6. Přehled tasků

| # | Task | Track | Závislosti |
|---|---|---|---|
| T001 | Project scaffold + CI | A | — |
| T002 | DB základ + User model | A | T001 |
| T003 | Autentizace | A | T002 |
| T004 | Role model + permission vrstva | A | T003 |
| T005 | Taxonomie profesí + seed | A | T002 |
| T006 | Design system + layout | A | T001 |
| T007 | Profesionální profil — CRUD | B | T004, T005 |
| T008 | Profesionální profil — veřejná stránka | B | T007 |
| T009 | Organizace — CRUD + členové | B | T004 |
| T010 | Organizace — veřejná stránka | B | T009 |
| T011 | Základní verifikace (e-mail, telefon) | B | T003 |
| T012 | Portfolio projekt — CRUD + stavy | C | T004 |
| T013 | Portfolio — blokový editor | C | T012, T014 |
| T014 | Media upload + knihovna | C | T004 |
| T015 | Úpravy obrázků | C | T014 |
| T016 | Portfolio — veřejná stránka | C | T012 |
| T017 | Guide — schema engine | D | T002, T005 |
| T018 | Guide — UI runner | D | T017, T006 |
| T019 | Guide — obsah scénářů | D | T017 |
| T020 | Guide — shrnutí, rozpory, warningy | D | T018, T019 |
| T021 | Brief — generování z guide | E | T020 |
| T022 | Brief — editace, sdílení, export | E | T021, T023 |
| T023 | Attachment systém | E | T004 |
| T024 | Poptávka — CRUD + stavový model | F | T021 |
| T025 | Poptávka — viditelnost + anonymizace | F | T024 |
| T026 | Poptávky — výpis + detail | F | T025 |
| T027 | Reakce profesionála na poptávku | F | T026, T007 |
| T028 | Matching engine | F | T024, T007 |
| T029 | Matching UI | F | T028 |
| T030 | Messaging — core | G | T004 |
| T031 | Messaging — přílohy, kontext, block/report | G | T030, T023 |
| T032 | Notifikace — event systém + in-app | G | T004 |
| T033 | Notifikace — e-mail + preference + digest | G | T032 |
| T034 | Vyhledávání profesionálů | H | T007 |
| T035 | Admin — uživatelé + kategorie | H | T004, T005 |
| T036 | Moderace — nahlášení obsahu | H | T004 |
| T037 | Hodnocení s ověřenou interakcí | H | T027 |

---

## 7. Co není v MVP scope

Fáze 3–5 dle roadmapy: sociální feed, jobs/team/capacity marketplace, projektové místnosti a schvalování, moodboardy, monetizace, supplier ekosystém, SMS/push notifikace, pokročilé verifikace (identita, autorizace, pojištění), pokročilé úpravy obrázků (AI funkce). Návrh rozpadu těchto features na tasky je ve složce `tasky_final/` (T038–T069, stav `draft`) — před vývojem se rozpracují do plné handoff šablony a přesunou do `tasky/`.

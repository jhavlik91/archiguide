# T035 — Admin — uživatelé + kategorie

**Track:** H (trust/admin) | **Závislosti:** T004, T005 | **Assignee:** —

## Goal
Administrační rozhraní: správa uživatelů (přehled, blokace) a správa taxonomie profesí/kategorií. Základ Package 9 pro MVP. Viz `zadani/legacy-master-spec.md` §48, `zadani/05-permission-matrix.md`.

## User roles
Admin (plný přístup); moderátor (jen čtení uživatelů — moderační akce řeší T036).

## Preconditions
T004, T005 done.

## Main flow
1. Admin sekce `(admin)/` chráněná rolí na úrovni layoutu + každé server action (`lib/permissions.ts` — žádná kontrola jen v UI).
2. Správa uživatelů: výpis s vyhledáním (jméno, e-mail) a filtry (role, stav, verifikace); detail uživatele: účet, role, profily, organizace, poslední aktivita.
3. Akce nad uživatelem: blokace/odblokování (suspenze — blokovaný se nepřihlásí, jeho veřejný obsah se skryje), změna rolí; **každá akce s povinným důvodem a auditním záznamem** (kdo, kdy, co, proč).
4. Správa taxonomie: CRUD kategorií a profesí (název, synonyma, regulated flag, verification hints dle `zadani/10-domain-entities.md` — Profession), deaktivace místo mazání, pokud profesi používá profil/poptávka.
5. Deaktivovaná profese: zmizí z výběrů (guide, profily, filtry), existující reference zůstávají funkční.
6. Admin dashboard: základní počty (uživatelé, profily, aktivní poptávky) — jen čísla z DB, žádná analytics integrace.

## Alternative flows
Blokace uživatele s aktivní poptávkou → poptávka se skryje z výpisu; pokus smazat používanou profesi → nabídnout deaktivaci s počtem referencí.

## Validation
Zod na všech akcích; důvod povinný u blokace a změny role; unikátnost slug profese.

## Permissions
Jen role admin (permission matice — správa kategorií, blokace: pouze Admin); moderátor: read-only výpis uživatelů. Admin akce nikdy nedostupné běžnou navigací jiným rolím.

## States
User: `active → suspended → active`; Profession: `active → deactivated → active`.

## Edge cases
Admin nemůže zablokovat sám sebe ani odebrat poslední admin roli v systému; suspendovaný uživatel s běžící guide session → session zůstává, přihlášení ne; duplicitní profese (synonyma vs. nová) → validace upozorní na podobný existující záznam (`zadani/09-edge-cases.md` — Identity: duplicity).

## Analytics
Eventy: `admin_user_suspended`, `admin_role_changed`, `admin_taxonomy_changed` (audit log je primární záznam).

## Acceptance criteria
- [x] Non-admin nedostane admin UI ani přes přímou URL / přímé volání akce (test na server action).
- [x] Blokace: uživatel se nepřihlásí, jeho veřejný profil není dostupný; odblokování vše vrátí.
- [x] Deaktivovaná profese zmizí z výběru v profilu, existující profily s ní zůstávají validní.
- [x] Každá admin akce má auditní záznam s důvodem.
- [x] Nelze odebrat poslední admin účet.

## Implementation notes
- `User.status` má nový stav `suspended` (odlišný od self-service `deactivated` — nejde obejít vlastní reaktivací, blokuje i Google OAuth). Veřejná viditelnost (profil, portfolio, fulltext search) už dřív všude kontrolovala `status === "active"`, takže se na ni suspenze napojila bez úprav veřejných dotazů.
- Auditní log je nový sdílený model `AdminAuditLog` (polymorfní cíl `user | profession_category | profession`), který podle zadání §Main flow 3 znovu využije T036 pro moderační suspenzi (nezakládá vlastní log).
- Alternative flow „blokace uživatele s aktivní poptávkou → poptávka se skryje z výpisu" se týká profesionálského „browse/matching" výpisu poptávek, který zatím žádný task neimplementoval (`features/matching` je stále jen `.gitkeep`). Až vznikne, má filtrovat vlastníka stejně jako profil/portfolio/search (`user.status === "active"`).

## Out of scope
Moderace reportů (T036), verifikační fronta nad rámec e-mail/telefon (finální produkt), správa guide scénářů přes UI (MVP = seed, T019), správa monetizace a doporučeného obsahu (finální produkt).

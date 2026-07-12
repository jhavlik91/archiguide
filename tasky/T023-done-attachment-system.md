# T023 — Attachment systém

**Track:** E (brief) | **Závislosti:** T004 | **Assignee:** Claude

## Goal
Generický systém příloh (dokumenty, PDF, fotky) s explicitní viditelností a sensitivity flagem, použitelný napříč doménami: brief (T022), poptávka (T024), reakce (T027), zprávy (T031). Viz `zadani/10-domain-entities.md` — Attachment.

## User roles
Přihlášený uživatel (vlastník přílohy). Konzument dle kontextu a viditelnosti.

## Preconditions
T004 done.

## Main flow
1. Model `Attachment`: owner, kontext (polymorfní: typ + id), soubor (storage klíč, mime, velikost, název), **visibility** (`private` | `shared_in_context` | `public`), **sensitivity flag**, metadata. Default `private` (`zadani/16-ai-team-execution-rules.md` §6).
2. Upload: route handler, validace mime (obrázky, PDF, běžné dokumenty) a velikosti; storage abstrakce — S3 v produkci, filesystem v dev (dle `TECHNICKE-ZADANI.md` §2).
3. Stahování vždy přes autorizovaný endpoint (podepsané URL / proxy) — nikdy přímý veřejný odkaz na soubor s viditelností `private`/`shared_in_context`.
4. Změna viditelnosti = vědomá akce; u přílohy se sensitivity flagem explicitní potvrzení (`zadani/05-permission-matrix.md` — citlivé akce).
5. Sdílený helper `lib/attachments.ts`: `attach(context, file, visibility)`, `canAccess(user, attachment)` — konzumující tasky nepíší vlastní přístupovou logiku.
6. Smazání přílohy: soft delete; konzumující kontexty zobrazí „příloha byla odstraněna“ místo rozbitého odkazu.

## Alternative flows
Upload selže uprostřed → žádný osiřelý záznam (záznam vzniká až po potvrzeném uploadu); nepodporovaný typ → srozumitelná chyba.

## Validation
Mime whitelist, max velikost (konfigurovatelná), názvy souborů sanitizované; kontext musí existovat a patřit uživateli.

## Permissions
`canAccess`: vlastník vždy; `shared_in_context` — jen účastníci daného kontextu (vyhodnocuje callback registrovaný doménou); `public` — kdokoli. Vše přes `lib/permissions.ts`.

## States
Attachment: `active → deleted` (soft).

## Edge cases
Příloha odstraněna, ale referencovaná ve zprávě/briefu → placeholder, ne 404 (`zadani/09-edge-cases.md` — Messaging); dokument s osobními údaji označený sensitivity flagem → varování před zveřejněním (`zadani/12-moderation-trust-safety.md` §8); tentýž soubor přiložen do dvou kontextů → dva Attachment záznamy (viditelnost se řídí nezávisle).

## Analytics
Eventy: `attachment_uploaded`, `attachment_visibility_changed`.

## Acceptance criteria
- [x] Unit testy `canAccess` pro všechny kombinace viditelnost × role.
- [x] Privátní příloha není dostupná přes žádnou nepodepsanou URL.
- [x] Nová příloha je vždy `private`.
- [x] Zveřejnění citlivé přílohy vyžaduje explicitní potvrzení.
- [x] Smazaná příloha zobrazí placeholder v konzumujícím kontextu.

## Out of scope
Obrázková knihovna a úpravy pro portfolio (T014, T015), antivirus/scanning, verze souborů.

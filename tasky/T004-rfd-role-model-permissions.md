# T004 — Role model + permission vrstva

**Track:** A (foundation) | **Závislosti:** T003 | **Assignee:** —

## Goal
Multi-role model (jeden účet = více rolí) a centrální permission vrstva, kterou budou používat všechny domény. Viz `zadani/05-permission-matrix.md`.

## User roles
Všechny: visitor, client (B2C/B2B), professional, org member, moderator, admin.

## Preconditions
T003 done.

## Main flow
1. Model `UserRole`: user × role (`client|professional|moderator|admin`); uživatel může mít víc rolí současně. Firemní role řeší T009.
2. Přepínání aktivního kontextu (klient ↔ profesionál) — uloženo v session, přepínač v UI hlavičce.
3. `lib/permissions.ts`: `can(actor, action, subject)` helper + typované akce per doména (domény si akce registrují).
4. Server-side vynucení: helper pro server actions (`requireRole`, `requirePermission`).
5. Admin/moderator routy `(admin)` chráněné rolí.

## Alternative flows
Uživatel ztratí roli za běhu session → další request oprávnění přepočítá (žádné cachování rolí v JWT bez expirace).

## Validation
Role přiděluje jen admin (kromě self-service `client`/`professional` při onboardingu).

## Permissions
Zákaz ad-hoc kontrol rolí mimo `lib/permissions.ts` (vynutit lint pravidlem nebo konvencí v review).

## States
Aktivní kontext: `client` | `professional` (per session).

## Edge cases
Jedna osoba klient i profesionál; moderátor bez client role; ztráta role během session (viz `zadani/16-ai-team-execution-rules.md` §3).

## Analytics
Event: `role.context_switched`.

## Acceptance criteria
- [ ] Uživatel s oběma rolemi přepíná kontext a UI se přizpůsobí.
- [ ] `can()` pokryto unit testy pro každou roli.
- [ ] Non-admin dostane 403 na `(admin)` routách (e2e).
- [ ] Ztráta role se projeví bez nutnosti logout/login.

## Out of scope
Organizační role (T009), konkrétní doménová oprávnění (definují si domény).

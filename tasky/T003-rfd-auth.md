# T003 — Autentizace

**Track:** A (foundation) | **Závislosti:** T002 | **Assignee:** —

## Goal
Registrace a přihlášení uživatele. Onboarding nesmí blokovat vznik hodnoty (viz `zadani/legacy-master-spec.md` §54 — guide lze začít bez registrace).

## User roles
Neregistrovaný návštěvník → registrovaný uživatel.

## Preconditions
T002 done.

## Inputs
E-mail + heslo, nebo Google OAuth.

## Main flow
1. Auth.js: credentials provider (bcrypt/argon2) + Google provider.
2. Registrace: e-mail, heslo, souhlas s podmínkami → účet `active`, odeslán verifikační e-mail (zatím stub — napojení v T011/T033).
3. Login, logout, session (JWT/DB session).
4. Reset hesla přes e-mailový token.
5. Middleware: `(app)` a `(admin)` routy vyžadují přihlášení; `(public)` nikdy.

## Alternative flows
- Google účet s existujícím e-mailem → propojení účtu.
- Přihlášení deaktivovaného účtu → nabídka reaktivace.

## Validation
Heslo min. 8 znaků; rate limit na login a reset (5/min/IP).

## Permissions
Nepřihlášený nesmí na `(app)` routy — redirect na login se zachováním návratové URL.

## States
Session: přihlášen/odhlášen. Reset token: jednorázový, expirace 1 h.

## Edge cases
Reset token použit dvakrát; registrace e-mailem existujícího Google účtu; smazaný účet (`deleted`) se nesmí přihlásit.

## Analytics
Eventy: `auth.registered`, `auth.login`, `auth.password_reset`.

## Acceptance criteria
- [ ] E2E: registrace → logout → login → přístup na `(app)` stránku.
- [ ] Google OAuth funkční (v dev lze mock).
- [ ] Reset hesla end-to-end (e-mail v dev do konzole/preview).
- [ ] Nepřihlášený je z `(app)` přesměrován a po loginu vrácen zpět.

## Out of scope
Role a přepínání kontextu (T004), verifikační badge (T011), notifikační infrastruktura (T032/T033).

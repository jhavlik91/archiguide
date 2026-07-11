# T011 — Základní verifikace (e-mail, telefon)

**Track:** B (profily) | **Závislosti:** T003 | **Assignee:** —

## Goal
Ověření e-mailu a telefonu + infrastruktura verifikačních badge, na kterou později navážou vyšší úrovně (identita, firma, autorizace). Viz `zadani/legacy-master-spec.md` §37.

## User roles
Každý registrovaný uživatel.

## Preconditions
T003 done.

## Main flow
1. Model `Verification` dle `zadani/10-domain-entities.md`: subject, type (`email|phone|identity|business|qualification|authorization|insurance`), status, issued/expiry, review notes. MVP implementuje `email` a `phone`, ostatní typy jen v enum.
2. E-mail: verifikační odkaz po registraci + možnost znovu odeslat.
3. Telefon: SMS kód (dev: kód do konzole; provider adapter interface, ostrá SMS až po MVP).
4. Badge komponenta: přesně uvádí, **co** bylo ověřeno (`zadani/legacy-master-spec.md` §37) — použijí T008/T010.

## Alternative flows
Expirace kódu → nový kód; změna e-mailu → verifikace se resetuje.

## Validation
Kód 6 číslic, expirace 10 min, max 5 pokusů; rate limit odeslání.

## Permissions
Uživatel ověřuje jen sebe. Stav verifikace čitelný veřejně jako badge (bez samotného e-mailu/telefonu).

## States
`unverified` → `pending` → `verified`; `expired` u časově omezených typů.

## Edge cases
Změna kontaktu po ověření (reset); opakované žádosti; telefon použitý u jiného účtu (povoleno, jen info).

## Analytics
Eventy: `verification.email_completed`, `verification.phone_completed`.

## Acceptance criteria
- [ ] E2E: registrace → klik na verifikační odkaz → badge „ověřený e-mail“.
- [ ] Telefon: kód → ověření → badge (dev transport).
- [ ] Změna e-mailu resetuje verifikaci.
- [ ] Badge nikdy neukazuje samotný kontakt.

## Out of scope
Identita/firma/autorizace/pojištění (finální produkt), admin verifikační fronta, ostrý SMS provider.

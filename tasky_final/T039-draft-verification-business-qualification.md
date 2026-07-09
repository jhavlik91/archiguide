# T039 — Verifikace — firma, kvalifikace, autorizace, pojištění

**Track:** I (trust+) | **Závislosti:** T038, T009 | **Stav:** draft

## Goal
Zbývající typy verifikací nad frontou z T038: ověřená firma (IČO/rejstřík), kvalifikace, profesní autorizace (např. ČKA/ČKAIT), pojištění. Viz `zadani/legacy-master-spec.md` §37, `zadani/12-moderation-trust-safety.md` §2–3.

## Scope
- Typy `business`, `qualification`, `authorization`, `insurance` v modelu z T038; subject = organizace (business) nebo profil.
- Business: kontrola proti veřejnému rejstříku (ručně v první iteraci, doklad = výpis), vazba na organizaci (T009) — ověřit smí jen owner/admin firmy.
- Qualification/authorization: navázané na profesi z taxonomie (regulated flag + verification hints z `zadani/10-domain-entities.md` — Profession); rozsah verifikace uvádí, pro kterou profesi platí.
- Insurance: doklad + platnost do; expirace hlídaná jobem → `expired` + notifikace `verification_expiring` předem.
- Badge komponenta rozšířená: „Firma ověřena", „Autorizace ověřena (architekt)" — vždy přesný rozsah.
- Zobrazení ve vyhledávání (T034 filtr), matchingu (T028 kritérium verifikace) a na profilech.

## Klíčová pravidla
Falešná kvalifikace je hlavní trust riziko (`zadani/12-moderation-trust-safety.md` §1) — regulated profese bez ověřené autorizace nesmí badge nijak naznačovat. Revokace se propíše okamžitě všude (profil, search, matching).

## Akceptační náčrt
Badge vždy uvádí typ + rozsah; expirace pojištění odebere badge a notifikuje předem; verifikaci firmy spustí jen owner/admin; regulated profese bez autorizace nemá autorizační badge; revokace okamžitě účinná.

## Out of scope
Automatické API integrace s rejstříky a komorami (navazující iterace), verifikační fronta (T038).

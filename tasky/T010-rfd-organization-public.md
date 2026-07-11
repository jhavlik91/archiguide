# T010 — Organizace — veřejná stránka

**Track:** B (profily) | **Závislosti:** T009 | **Assignee:** —

## Goal
Veřejný firemní profil: základní info, tým, specializace, sloty pro projekty a služby.

## User roles
Visitor (čte), členové org (edit odkazy dle role).

## Preconditions
Aktivní organizace (T009).

## Main flow
1. Route `/firma/[slug]`: logo, název, popis, sídlo (jen město/region), regiony, specializace.
2. Sekce tým: členové, kteří souhlasili se zveřejněním (opt-in per člen), s odkazem na jejich profily.
3. Sloty: projekty (T016), služby, pracovní nabídky — prázdné se nezobrazují.
4. SEO metadata.

## Alternative flows
Člen skryje své členství → nezobrazuje se v týmu.

## Validation
N/A (read-only).

## Permissions
Archivovaná org → 404 pro veřejnost. Kontaktní údaje members se nezobrazují; firemní kontakt jen pokud jej owner explicitně zveřejní.

## States
Renderuje `active`.

## Edge cases
Firma bez členů se souhlasem (sekce tým se skryje); bez loga; dlouhý popis.

## Analytics
Event: `org.viewed`.

## Acceptance criteria
- [x] Veřejná stránka dostupná nepřihlášenému.
- [x] Člen bez opt-in se v týmu nezobrazuje (e2e).
- [x] Archivovaná firma vrací 404.
- [x] Mobil plně použitelný.

## Out of scope
Firemní portfolio, služby, joby, claim flow.

# T008 — Profesionální profil — veřejná stránka

**Track:** B (profily) | **Závislosti:** T007 | **Assignee:** —

## Goal
Veřejná stránka profesionála na `(public)` route — vizitka s odborností, dostupností a sloty pro portfolio/hodnocení/služby.

## User roles
Visitor (čte), vlastník (vidí navíc edit odkazy a draft náhled).

## Preconditions
Publikovaný profil (T007).

## Main flow
1. Route `/profesional/[slug]`: hlavička (foto, jméno, headline, profese, region, jazyky), bio, odbornost, dostupnost, forma spolupráce.
2. Sloty pro budoucí sekce: portfolio (T016), verifikační badge (T011), hodnocení (T037), služby — prázdné sekce se nezobrazují.
3. CTA „Kontaktovat“ → pro nepřihlášené výzva k registraci; napojení na messaging (T030) přes slot.
4. SEO: metadata, OG obrázek.

## Alternative flows
Vlastník si zobrazí náhled draftu (`?preview=1`, jen pro vlastníka).

## Validation
N/A (read-only).

## Permissions
Draft/nepublikovaný profil → 404 pro každého kromě vlastníka. Telefon/e-mail se **nezobrazují** (private by default, `zadani/16-ai-team-execution-rules.md` §6).

## States
Renderuje pouze `published`.

## Edge cases
Profil bez fota (iniciálový avatar); bez vedlejších profesí; deaktivovaný uživatel → stránka 404; velmi dlouhé bio (zkrácení + rozbalit).

## Analytics
Event: `profile.viewed` (bez PII o návštěvníkovi).

## Acceptance criteria
- [ ] Publikovaný profil dostupný nepřihlášenému návštěvníkovi.
- [ ] Draft vrací 404 cizímu uživateli, vlastníkovi preview.
- [ ] Kontaktní údaje se nikde nerenderují.
- [ ] Mobilní zobrazení plně použitelné (Playwright viewport test).

## Out of scope
Messaging (T030), portfolio render (T016), hodnocení (T037), verifikace (T011).

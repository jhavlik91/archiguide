# T007 — Profesionální profil — CRUD

**Track:** B (profily) | **Závislosti:** T004, T005 | **Assignee:** Claude Code

## Goal
Profesionál si založí a spravuje profil: bio, profese, specializace, působnost, dostupnost, cenový model. Viz `zadani/legacy-master-spec.md` §22, `zadani/10-domain-entities.md` ProfessionalProfile.

## User roles
Professional (vlastník). Ostatní role nemají přístup k editaci.

## Preconditions
Uživatel má roli `professional` (self-service onboarding z T004).

## Inputs
Jméno/headline, foto, bio, lokalita, region působnosti, jazyky, hlavní profese (1), vedlejší profese (0–n), specializace, roky praxe, dostupnost, forma spolupráce, cenový model.

## Main flow
1. Model `ProfessionalProfile` + M:N vazby na `Profession`/`Specialization` (primary flag).
2. Onboarding wizard dle `zadani/legacy-master-spec.md` §55: profese → lokalita → specializace → dostupnost. Každý krok přeskočitelný, průběžné ukládání.
3. Editace profilu po sekcích (základ, odbornost, dostupnost, ceny).
4. Přepínač „přijímám poptávky“ (on/off).

## Alternative flows
Uživatel přeruší onboarding → rozpracovaný profil se uloží, při návratu pokračuje.

## Validation
Headline max 120 znaků; min. 1 profese pro aktivaci přijímání poptávek; profese jen z taxonomie (T005).

## Permissions
Editace pouze vlastník. Čtení: publikovaný profil veřejný, nedokončený jen vlastník.

## States
`draft` (nedokončený) → `published`; „přijímám poptávky“ nezávislý flag.

## Edge cases
Profesionál s více profesemi; změna hlavní profese; profese archivovaná adminem po vyplnění profilu (zůstává, jen nelze nově přidat).

## Analytics
Eventy: `profile.created`, `profile.published`, `profile.accepting_requests_toggled`.

## Acceptance criteria
- [ ] E2E: onboarding → publikace profilu → profil viditelný (kontrola v T008 route).
- [ ] Draft profil nevidí nikdo kromě vlastníka.
- [ ] Nelze aktivovat přijímání poptávek bez profese.
- [ ] Vícenásobné profese + specializace fungují (unit testy vazeb).

## Out of scope
Veřejná stránka (T008), portfolio (T012+), verifikační badge (T011), služby, hodnocení.

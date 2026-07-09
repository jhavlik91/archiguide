# T025 — Poptávka — viditelnost + anonymizace

**Track:** F (marketplace) | **Závislosti:** T024 | **Assignee:** —

## Goal
Režimy viditelnosti poptávky (veřejná / neveřejná) a anonymizace veřejné verze — co přesně smí být vidět a co nikdy. Privacy-kritický task. Viz `zadani/legacy-master-spec.md` §20.2–20.3, §50.

## User roles
Vlastník poptávky (nastavuje viditelnost); návštěvník/profesionál (konzumuje veřejnou verzi); oslovený profesionál (neveřejná).

## Preconditions
T024 done.

## Main flow
1. Visibility selector při publikaci: `public` | `private` (neveřejná = viditelná jen osloveným, oslovování řeší T027/T029 — zde model pozvánek `RequestInvite`).
2. Anonymizovaná veřejná projekce poptávky zobrazuje **jen**: stručný název, typ projektu, region (ne přesnou adresu), orientační rozpočet, termín, požadované profese, anonymizovaný brief (bez identity klienta).
3. **Nikdy automaticky nezveřejnit:** přesnou adresu, telefon, e-mail, citlivé dokumenty (`zadani/legacy-master-spec.md` §20.2). Serverová projekce — anonymizace se děje v query vrstvě, ne v UI.
4. Sanitizační kontrola textových polí před publikací: detekce vzorů telefonu/e-mailu/adresy v názvu a popisu → varování s náhledem toho, co bude veřejné; publikace identity u anonymizované poptávky = citlivá akce s explicitním potvrzením (`zadani/05-permission-matrix.md`).
5. Přílohy: veřejná poptávka zobrazuje jen přílohy s viditelností pro daný kontext (T023); citlivé přílohy zůstávají skryté do fáze konverzace.
6. Náhled „takhle vidí poptávku profesionál“ pro vlastníka před publikací.

## Alternative flows
Změna `public → private` po publikaci → veřejná projekce zmizí, probíhající reakce zůstávají; odhalení identity konkrétnímu profesionálovi až v konverzaci (T030 slot), ne plošně.

## Validation
Veřejná projekce definovaná whitelist DTO (žádné `select *`); unit test garantuje, že DTO neobsahuje privátní pole.

## Permissions
Plná data: vlastník + admin; anonymizovaná projekce: kdokoli (public) / pozvaní (private). Přes `lib/permissions.ts`.

## States
Nemění stavový automat T024; visibility je ortogonální atribut.

## Edge cases
Přesná adresa vepsaná do popisu → varování, uživatel rozhodne (`zadani/09-edge-cases.md` — Brief); různí profesionálové mají vidět různé přílohy → per-invite viditelnost mimo MVP, ale citlivé přílohy se odhalují až v konverzaci; screenshot/kopie veřejných dat mimo platformu — mimo scope, ale minimalizace expozice je návrhový princip.

## Analytics
Eventy: `request_visibility_set`, `request_privacy_warning_shown`.

## Acceptance criteria
- [ ] Unit test: veřejné DTO nikdy neobsahuje adresu, telefon, e-mail, identitu klienta.
- [ ] E2E: publikovaná veřejná poptávka → anonymní návštěvník vidí jen povolená pole.
- [ ] Neveřejnou poptávku nevidí nikdo kromě vlastníka a pozvaných.
- [ ] Telefon v popisu vyvolá varování před publikací.
- [ ] Náhled veřejné verze odpovídá tomu, co reálně vidí cizí uživatel.

## Out of scope
Výpis a detail (T026), pozvání konkrétních profesionálů UI (T029), per-příjemce viditelnost příloh.

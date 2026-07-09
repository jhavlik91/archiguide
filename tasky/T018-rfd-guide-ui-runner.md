# T018 — Guide — UI runner

**Track:** D (guide) | **Závislosti:** T017, T006 | **Assignee:** —

## Goal
Uživatelské rozhraní guide: výběr scénáře, průchod otázkami, autosave, návrat zpět, resume. UX pravidla: jednoduchý jazyk, žádné slepé uličky (`zadani/legacy-master-spec.md` §53.1).

## User roles
Visitor i přihlášený B2C/B2B klient.

## Preconditions
T017, T006 done.

## Main flow
1. Vstupní obrazovka „Co chcete vyřešit?“ — 14 scénářů dle `zadani/legacy-master-spec.md` §7 (karty; scénáře plní T019, UI proti seed datům).
2. Otázková obrazovka: jedna otázka na krok, vysvětlivka („Co to znamená?“), tlačítka „Nevím“ a „Přeskočit“, progress bar.
3. Krok zpět s možností změnit odpověď.
4. Autosave po každé odpovědi; banner „Rozpracovaný záměr“ na homepage/dashboardu → resume.
5. Průběžné mini-shrnutí dosavadních odpovědí (postranní panel / rozbalovací na mobilu).
6. Plně mobilní (guide je klíčové mobilní flow, `zadani/legacy-master-spec.md` §53.3).

## Alternative flows
- Nepřihlášený u konce guide → jemná výzva k registraci (e-mail), bez ztráty session.
- Přerušení → návrat přes resume banner.

## Validation
Client-side dle typu otázky; server je autorita (T017).

## Permissions
Cizí session nelze otevřít (token/user check z T017).

## States
Vizualizace stavů session z T017.

## Edge cases
Reload uprostřed kroku; back button prohlížeče; velmi dlouhý text odpovědi; scénář bez dalších otázek (rovnou souhrn).

## Analytics
UI eventy doplňují T017: `guide.scenario_selected`, `guide.resumed`.

## Acceptance criteria
- [ ] E2E: výběr scénáře → 5+ otázek s „nevím“ → reload uprostřed → pokračování → dokončení.
- [ ] Zpět + změna odpovědi funguje a přepočítá větev.
- [ ] Celé flow projde na mobilním viewportu (Playwright).
- [ ] Nepřihlášený dokončí guide bez registrace.

## Out of scope
Obsah scénářů (T019), shrnutí/warningy (T020), generování briefu (T021).

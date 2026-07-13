# T017 — Guide — schema engine

**Track:** D (guide) | **Závislosti:** T002, T005 | **Assignee:** —

## Goal
Datový model a engine pro dynamické guide scénáře: otázky definované daty (ne kódem), podmíněné větvení, validace odpovědí. Jádro hlavní diferenciace produktu. Viz `zadani/legacy-master-spec.md` §6–9.

## User roles
N/A (engine); konzumuje T018 (UI) a T035 (admin správa scénářů — po MVP jen seed).

## Preconditions
T002, T005 done.

## Main flow
1. Modely: `GuideScenario` (slug, název, verze, aktivní), `GuideStep` (typ otázky, text, vysvětlivka, možnosti, podmínka zobrazení, povinnost), `GuideSession` (user?, scenario, answers JSON, state, progress) dle `zadani/10-domain-entities.md`.
2. Typy otázek: single-choice, multi-choice, text, number, range, lokalita, file-ref. **Každá otázka podporuje „nevím“ a „přeskočit“** — obojí validní odpověď (`zadani/16-ai-team-execution-rules.md` §4).
3. Podmínky větvení: deklarativní výrazy nad předchozími odpověďmi (JSON DSL, vyhodnocení na serveru).
4. Engine API: `getNextStep(session)`, `answer(session, step, value)`, `getSummary(session)`, `getProgress(session)`.
5. Session funguje i pro nepřihlášeného (cookie token) s pozdějším připojením k účtu (`zadani/legacy-master-spec.md` §54).
6. Verzování scénáře: běžící session dokončí svou verzi i po vydání nové.

## Alternative flows
Rozporné odpovědi → engine vrací `conflicts` (UI zpracuje v T020).

## Validation
Odpověď musí odpovídat typu otázky; podmínkové výrazy validované při seedu scénáře.

## Permissions
Session čte/píše jen její vlastník (user id nebo session token).

## States
Session: `active` → `completed` | `abandoned`.

## Edge cases
Nepřihlášený dokončí guide a pak se registruje (session se připojí k účtu); změna dřívější odpovědi zneplatní navazující větev (odpovědi z neplatné větve se označí, ne smažou); scénář deaktivován během session.

## Analytics
Eventy: `guide.started`, `guide.step_answered`, `guide.completed`, `guide.abandoned` (viz `zadani/14-metrics-analytics.md`).

## Acceptance criteria
- [ ] Testovací scénář s větvením: odpověď A vede jinou cestou než B (unit testy enginu).
- [ ] „Nevím“ nikdy nezablokuje postup.
- [ ] Anonymní session přežije registraci a připojí se k účtu.
- [ ] Změna dřívější odpovědi korektně přepočítá další kroky.

## Out of scope
UI (T018), obsah reálných scénářů (T019), shrnutí/warningy (T020), admin editace scénářů.

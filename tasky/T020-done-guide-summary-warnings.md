# T020 — Guide — shrnutí, rozpory, bezpečnostní warningy

**Track:** D (guide) | **Závislosti:** T018, T019 | **Assignee:** —

## Goal
Závěrečné shrnutí guide s doporučeními a vysvětlením, detekce rozporů v odpovědích a bezpečnostní upozornění. Viz `zadani/legacy-master-spec.md` §8, §15, §17.

## User roles
Uživatel procházející guide (visitor i přihlášený).

## Preconditions
T018, T019 done.

## Main flow
1. Souhrnná obrazovka po dokončení: lidsky čitelné shrnutí odpovědí, identifikovaná rizika a nejasnosti, chybějící podklady, doporučené profese **s vysvětlením proč** (`zadani/16-ai-team-execution-rules.md` §5), doporučený další krok.
2. Detekce rozporů (pravidla v datech scénáře): např. rozpočet vs. rozsah → jemné upozornění s možností upravit odpovědi, neblokuje.
3. Bezpečnostní warning: kroky s `safety_warning` flagem (T019) zobrazí výrazné upozornění ihned během průchodu + znovu v souhrnu; explicitní text, že platforma není havarijní služba (`zadani/legacy-master-spec.md` §15).
4. Editace odpovědi přímo ze souhrnu (skok na krok, návrat do souhrnu).
5. CTA blok: pokračovat na brief (T021 — slot), uložit na později.

## Alternative flows
Guide dokončen se samými „nevím“ → souhrn to poctivě uvádí a doporučuje konzultaci; žádné vymyšlené závěry.

## Validation
N/A (čte session).

## Permissions
Souhrn vidí jen vlastník session.

## States
Session `completed` po zobrazení souhrnu.

## Edge cases
Rozpor uživatel ignoruje → smí pokračovat (upozornění zůstává v briefu jako riziko); změna odpovědi ze souhrnu zneplatní větev → engine přepočítá (T017).

## Analytics
Eventy: `guide.summary_viewed`, `guide.conflict_shown`, `guide.safety_warning_shown`.

## Acceptance criteria
- [ ] E2E: dokončení scénáře → souhrn s doporučenými profesemi a důvody.
- [ ] Scénář F s rizikovou odpovědí zobrazí bezpečnostní warning okamžitě i v souhrnu.
- [ ] Rozpor zobrazí upozornění, ale neblokuje dokončení.
- [ ] Samá „nevím“ → doporučení konzultace, žádný odborný závěr.

## Out of scope
Generování briefu (T021), oslovování profesionálů.

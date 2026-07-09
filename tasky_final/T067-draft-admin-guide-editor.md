# T067 — Admin — editor guide scénářů

**Track:** P (platforma) | **Závislosti:** T035, T019 | **Stav:** draft

## Goal
Správa guide scénářů přes admin UI místo seedu: editace otázek, větvení, warningů a publikace nových verzí bez nasazení kódu. Viz `zadani/legacy-master-spec.md` §48 (správa guide scénářů), engine T017.

## Scope
- Editor scénáře: CRUD kroků (typy otázek z T017), možnosti odpovědí, vysvětlivky, podmínky větvení (vizuální editor nad JSON DSL), safety warning flagy, pravidla rozporů (T020), mapování na doporučené profese.
- Verzování (mechanismus z T017): úpravy jdou do nové draft verze; publikace verze = vědomá akce; běžící session dokončí svou verzi.
- Validace při uložení: nedosažitelné kroky, cyklické podmínky, odkazy na neexistující odpovědi, chybějící „nevím" cesta — editor nedovolí publikovat rozbitý scénář.
- Náhled/test režim: admin projde scénář jako uživatel před publikací.
- Deaktivace scénáře; statistiky per scénář (completion rate, drop-off per krok — z eventů T017).
- Audit změn a publikací.

## Klíčová pravidla
Guide pravidla platí i pro obsah z editoru: „nevím" u každé otázky, žádné falešné závěry, safety warningy pro rizikové odpovědi (`zadani/16-ai-team-execution-rules.md` §4); publikovaná verze immutable.

## Akceptační náčrt
Úprava scénáře nezasáhne běžící sessions; validátor odmítne nedosažitelný krok i otázku bez „nevím"; test režim; publikace s auditem; drop-off statistiky viditelné.

## Out of scope
Engine (T017), obsah scénářů (T019 seed zůstává výchozím obsahem), AI generování otázek, A/B testování scénářů.

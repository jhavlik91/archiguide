# T019 — Guide — obsah scénářů

**Track:** D (guide) | **Závislosti:** T017 | **Assignee:** —

## Goal
Definovat a naseedovat všech 14 scénářů guide jako data pro engine (T017), přesně dle `zadani/legacy-master-spec.md` §7 a §9–17.

## User roles
N/A (obsah/data).

## Preconditions
T017 done (formát scénářů).

## Main flow
1. Obecné otázky (§9): lokalita (s volbou soukromí přesné adresy), vlastnický vztah, rozpočet (vč. „nevím“ a rozlišení projekt/realizace/celkem), čas, podklady.
2. Scénáře A–H dle §10–17: nový dům (vč. rozlišení fází nápad/pozemek/studie/projekt/realizace), rekonstrukce domu (vč. povinné doplňující otázky na nosné stěny při bourání), rekonstrukce bytu, koupě nemovitosti, koupě pozemku, technický problém (vč. bezpečnostních triggerů — data pro T020), změna dispozice, „nevím, co potřebuji“ (volný popis + cílené doplňující otázky).
3. Zbývající scénáře ze §7 (interiér, zahrada, hledám firmu, hledám profesi, konzultace) — kratší větve mapované na obecné otázky + doporučení.
4. Mapování výstupů: každá koncová větev → doporučené profese (slugy z T005) + doporučený další krok + podklady k přípravě.
5. Bezpečnostní triggery (§15): trhliny, únik plynu, spálenina, zaplavená elektroinstalace → flag `safety_warning` v datech.

## Alternative flows
—

## Validation
Seed validátor: každá větev končí výstupem (žádná slepá ulička); všechny odkazované profese existují v taxonomii; podmínky syntakticky validní.

## Permissions
N/A.

## States
Scénáře verze 1, `active`.

## Edge cases
„Nevím“ na klíčové otázce → větev vede na konzultaci/posouzení, nikdy na vymyšlený závěr (`zadani/16-ai-team-execution-rules.md` §4); guide nemá dost informací → výstup to explicitně uvádí.

## Analytics
N/A (eventy řeší engine).

## Acceptance criteria
- [ ] Všech 14 scénářů naseedováno a průchozích.
- [ ] Validátor potvrdí: žádná slepá ulička, všechny profese existují.
- [ ] Scénář B: „chci bourat stěny“ + „nevím, zda nosná“ → doporučení statika, nikdy „lze bourat“.
- [ ] Scénář F: rizikové odpovědi nesou `safety_warning` flag.
- [ ] Scénář H: volný popis → doplňující otázky → návrh kategorií s vysvětlením.

## Out of scope
Engine (T017), UI (T018), render warningů (T020), admin editace scénářů.

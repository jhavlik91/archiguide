# T013 — Portfolio — blokový editor

**Track:** C (portfolio) | **Závislosti:** T012, T014 | **Assignee:** —

## Goal
WYSIWYG blokový editor portfolia: drag & drop, autosave, undo/redo, náhled. Viz `zadani/legacy-master-spec.md` §25.

## User roles
Vlastník projektu / org editor+.

## Preconditions
Existující portfolio projekt (T012), media knihovna (T014).

## Inputs
Bloky dle `zadani/10-domain-entities.md` PortfolioBlock. MVP sada: text, heading, image, gallery, before_after, quote, list, table, technical_data, CTA. (Video, map, pdf, floorplan, timeline, budget, award, team, materials — finální produkt.)

## Main flow
1. Model `PortfolioBlock`: project, type, order, content (JSON per typ, Zod schéma pro každý typ).
2. Editor: přidání bloku z palety, inline editace, drag & drop řazení, duplikace, smazání.
3. Autosave (debounce ~2 s) s viditelným stavem „uloženo / ukládám / chyba“ — nikdy falešně nehlásit úspěch (`zadani/16-ai-team-execution-rules.md` §8).
4. Undo/redo v rámci session.
5. Náhled: desktop/mobil přepínač.

## Alternative flows
Výpadek sítě při autosave → retry + varování, lokální buffer, žádná tichá ztráta dat.

## Validation
Zod schéma per typ bloku; obrázkové bloky odkazují jen na média z vlastní knihovny (T014).

## Permissions
Stejné jako editace projektu (T012).

## States
Bloky patří draft verzi; publish (T012) je snapshotuje.

## Edge cases
Prázdný projekt (empty state s výzvou); souběžná editace dvěma editory (last-write-wins + varování o novější verzi); velmi dlouhý obsah.

## Analytics
Eventy: `portfolio.block_added` (s typem), `portfolio.preview_used`.

## Acceptance criteria
- [ ] E2E: přidání textu + galerie + before/after → přeřazení → autosave → reload → obsah zachován.
- [ ] Undo/redo funguje pro přidání/smazání/přeřazení.
- [ ] Selhání uložení zobrazí chybu a data nezmizí.
- [ ] Mobilní náhled odpovídá veřejnému renderu (T016 sdílí render komponenty).

## Out of scope
Pokročilé bloky (finální produkt), úpravy obrázků (T015), verze/historie.

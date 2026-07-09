# T057 — Inspirace → guide

**Track:** M (social) | **Závislosti:** T056, T017 | **Stav:** draft

## Goal
Konverze inspirace na záměr: „Chci něco podobného" z projektu/moodboardu předvyplní guide a vede k briefu. Klíčový akviziční use case. Viz `zadani/legacy-master-spec.md` §41, metrika `moodboard_to_guide` (`zadani/14-metrics-analytics.md`).

## Scope
- CTA „Chci něco podobného" na veřejném portfolio projektu (T016) a moodboardu (T056).
- Předvyplnění guide session (T017): typ projektu, styl/preference odvozené ze zdroje (typ realizace, rozsah) — jako **předvyplněné odpovědi, které uživatel potvrzuje/mění**, ne skryté domněnky; reference na inspirační zdroj se uloží do session.
- Guide pokračuje standardně (lokalita, rozpočet…) → brief (T021) obsahuje sekci „Inspirace" s odkazy na zdrojové projekty/moodboard.
- Brief s inspirací → poptávka/matching standardní cestou; profesionál vidí inspirační referenci (co se klientovi líbí) — pokud je zdroj veřejný.
- Autor zdrojového projektu se může objevit v doporučených kandidátech (T028 signál „autor inspiračního projektu") s vysvětlením.

## Klíčová pravidla
Předvyplnění je transparentní a editovatelné — žádné vymyšlené odpovědi (guide pravidla §4); privátní moodboard sdílený do briefu = vědomé rozhodnutí (viditelnost itemů); kredit autora inspirace zachován.

## Akceptační náčrt
CTA z projektu → guide s předvyplněným typem → dokončení → brief se sekcí Inspirace; uživatel může každou předvyplněnou odpověď změnit; profesionál vidí inspiraci v poptávce; metrika `moodboard_to_guide` se emituje.

## Out of scope
Vizuální podobnostní vyhledávání (ML), automatická extrakce stylu z obrázků, moodboard core (T056).

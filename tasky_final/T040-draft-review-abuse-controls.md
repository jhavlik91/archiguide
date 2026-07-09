# T040 — Review abuse controls + appeals

**Track:** I (trust+) | **Závislosti:** T037, T036 | **Stav:** draft

## Goal
Detekce a řešení zneužití recenzí (revenge, extortion, competitor, duplicity, koordinace) a plné appeals workflow pro moderační rozhodnutí. Public launch bloker (`zadani/15-release-roadmap.md`). Viz `zadani/12-moderation-trust-safety.md` §9, `zadani/09-edge-cases.md` — Reviews.

## Scope
- Signály do moderační fronty: recenze krátce po sporu/zamítnutí, více recenzí z jednoho účtu na konkurenty v téže profesi/regionu, nápadné vzorce (nové účty, časové shluky), duplicitní obsah.
- Extortion flow: hodnocený může u disputu označit „vydírání" s doložením (screenshot konverzace — platformní zprávy dohledatelné); prioritní fronta.
- Appeals: `actioned → appealed → closed` (stavy z T036 existují) — UI pro odvolání proti skrytí/zamítnutí, druhé posouzení jiným moderátorem, finální rozhodnutí s odůvodněním.
- Guardrail dashboard pro moderátory: report rate, time to moderation, false positive rate (`zadani/14-metrics-analytics.md`).
- Rate limity: recenze/reporty per účet per období.

## Klíčová pravidla
Detekce vytváří **podněty pro lidské rozhodnutí**, ne automatické mazání; falešná pozitiva poškozují legitimní recenzenty. Skrytá recenze v průběhu šetření = stav `moderation_pending`, ne tiché smazání.

## Akceptační náčrt
Duplicitní recenze detekována a slčena do případu; dispute s extortion příznakem má prioritu ve frontě; appeal posuzuje jiný moderátor než původní; žádná recenze se nesmaže automaticky bez lidského rozhodnutí.

## Out of scope
ML klasifikace obsahu (heuristiky stačí), obecná moderace ne-recenzního obsahu (T036).

# T061 — Sponsored + featured placement

**Track:** N (monetizace) | **Závislosti:** T059, T028, T034 | **Stav:** draft

## Goal
Placené zvýraznění: featured profil/listing ve vyhledávání, sponzorovaná pozice v matchingu a feedu — vždy transparentně označené a auditovatelné. Viz `zadani/13-monetization.md` §8, `zadani/legacy-master-spec.md` §47.4.

## Scope
- Model `Placement`: subjekt (profil/služba/job/produkt), umístění (search / matching / feed / kategorie), období, stav, audit.
- Aktivace `sponsorship flag` v matchingu (T028/T029 — pole a UI slot už existují): sponzorovaná karta **navíc** k organickým, označená „Sponzorováno", **oddělená od organického důvodu doporučení** (§8) — sponzorovaný kandidát musí i tak splnit tvrdé podmínky (profese, region).
- Featured ve vyhledávání (T034): označená pozice nad výsledky, ne skryté promíchání do organického řazení.
- Featured job listing (T043 slot), promoted product (T064 slot).
- Nákup: self-serve přes T059 (období, umístění, cena předem) + admin správa.
- Audit: kdo, co, kdy, za kolik, kde se zobrazovalo — auditovatelnost (§8); frekvence/kapacita pozic omezená (UX guardrail).

## Klíčová pravidla
**Nikdy skrytý paid ranking** (`zadani/16-ai-team-execution-rules.md` §11); organický matching neprezentovat falešně (§1); sponzorovaná pozice nesplňující tvrdé podmínky relevance se nezobrazí (peníze nekoupí nerelevantní doporučení); edge case „sponsored placement bez označení" = kritický bug.

## Akceptační náčrt
Sponzorovaná karta vždy s označením (test na všech umístěních); organické pořadí beze změny; nerelevantní sponzor se v matchingu nezobrazí; audit záznam kompletní; expirace placementu okamžitá.

## Out of scope
Aukční model cen, ad-tech metriky (imprese/CTR billing), retargeting; matching engine (T028), search (T034) — jen integrace.

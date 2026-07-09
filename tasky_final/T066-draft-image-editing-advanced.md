# T066 — Pokročilé úpravy obrázků (AI)

**Track:** P (platforma) | **Závislosti:** T015 | **Stav:** draft

## Goal
Rozšíření obrazových úprav portfolia o AI funkce a pokročilé nástroje nad rámec základních úprav z T015. Viz `zadani/legacy-master-spec.md` §25.3.

## Scope
- Dle §25.3 (rozpracovat proti plnému znění sekce): vylepšení kvality (upscale/doostření), odstranění objektů/retušování, automatické vyvážení expozice/barev, rozmazání citlivých údajů (obličeje, SPZ, čísla popisná — vazba na edge cases Portfolio), hromadné úpravy.
- Anonymizační asistent: detekce obličejů/SPZ/adres na fotografiích s nabídkou rozmazání před publikací (`zadani/09-edge-cases.md` — Portfolio: fotografie obsahuje osoby/adresu).
- Zpracování asynchronně (fronta) s náhledem před aplikací; AI úprava vždy jako **nová verze — originál obnovitelný** (pravidlo z `zadani/16-ai-team-execution-rules.md` §7, mechanismus z T015).
- Označení výrazně AI-upravených vizualizací (transparentnost — realizace vs. vizualizace nesmí být zaměnitelné).
- Limity dle plánu (T058 slot — AI operace jako entitlement).

## Klíčová pravidla
Originál vždy obnovitelný; AI nikdy nemění obsah tak, aby klamal (dokreslování neexistujících realizací = anti-goal); citlivé údaje ve fotkách jsou privacy povinnost, ne jen feature.

## Akceptační náčrt
AI úprava vytvoří verzi, originál obnovitelný; anonymizační detekce nabídne rozmazání před publikací; asynchronní job s poctivým stavem (žádný falešný úspěch); limity dle plánu.

## Out of scope
Základní editor (T015), generování obrázků z textu, AI staging interiérů (možný navazující task), video.

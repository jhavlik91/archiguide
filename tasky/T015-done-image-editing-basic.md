# T015 — Úpravy obrázků (základní)

**Track:** C (portfolio) | **Závislosti:** T014 | **Assignee:** —

## Goal
Základní editace obrázků v knihovně: crop, rotate, resize, poměr stran, jas, kontrast, saturace. Viz `zadani/legacy-master-spec.md` §25.3 (základní sada).

## User roles
Vlastník media assetu.

## Preconditions
T014 done.

## Main flow
1. Editor UI nad assetem: crop s presety poměrů (1:1, 4:3, 16:9, volný), rotate 90°, jas/kontrast/saturace slidery, náhled.
2. Uložení = **nová verze** assetu (derivát z originálu); použití v obsahu se přepne na novou verzi.
3. „Vrátit originál“ — kdykoli obnoví původní podobu (`zadani/legacy-master-spec.md` §25.3).
4. Server-side zpracování přes sharp (parametry z klienta, render na serveru).

## Alternative flows
Zavření editoru bez uložení → žádná změna.

## Validation
Crop nesmí být menší než 50×50 px; parametry úprav v bezpečných mezích.

## Permissions
Jen vlastník assetu (org: editor+).

## States
Asset: originál + řetěz verzí; aktivní verze jedna.

## Edge cases
Úprava assetu použitého v publikovaném portfoliu (nová verze se projeví hned — upozornit); opakované úpravy (vždy z originálu, ne z derivátu, aby nedegradovala kvalita).

## Analytics
Event: `media.edited` (typ úpravy).

## Acceptance criteria
- [ ] Crop + jas → uložení → nová verze aktivní, originál zachován.
- [ ] „Vrátit originál“ obnoví původní stav.
- [ ] Opakovaná úprava vychází z originálu (unit test pipeline).

## Out of scope
AI funkce (odstranění pozadí, rozmazání osob/SPZ, upscale…) — finální produkt; perspektivní narovnání.

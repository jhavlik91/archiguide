# T062 — B2C Premium

**Track:** N (monetizace) | **Závislosti:** T059, T021 | **Stav:** draft

## Goal
Placené B2C služby: concierge podpora, review briefu expertem, asistovaný shortlist, podpora porovnání nabídek. Viz `zadani/13-monetization.md` §5, `zadani/legacy-master-spec.md` §47.5.

## Scope
- B2C premium plán/jednorázové služby (T058/T059 infrastruktura): brief review (expert projde brief a doplní doporučení), concierge (asistence s poptávkou a výběrem), shortlist assistance, comparison support (strukturované porovnání obdržených nabídek).
- Comparison view: tabulka reakcí na poptávku (cena, termín, rozsah, verifikace, hodnocení) — pro premium uživatele rozšířená o asistované poznámky.
- Interní role „concierge" (operátor platformy) s vymezeným přístupem: vidí brief/poptávku klienta jen po objednání služby a se souhlasem (least privilege).
- Objednání premium služby → interní fronta → výstup (komentovaný brief, doporučený shortlist) doručený do účtu + notifikace.

## Klíčová pravidla
Premium nesmí deformovat marketplace: concierge shortlist vychází z organického matchingu (T028) s vysvětlením, ne z placement plateb profesionálů (střet zájmů T061 × T062 explicitně zakázán); přístup operátora ke klientským datům auditovaný.

## Akceptační náčrt
Objednání brief review → expert vidí brief → komentovaný výstup u klienta; concierge nevidí data před objednávkou; shortlist s důvody nezávislý na sponzoringu; free klient neztrácí žádnou core funkci.

## Out of scope
Definice plánů (T058), platby (T059), comparison view základ pro všechny (patří do T027 iterace — rozhodnout při rozpracování), právní/odborné poradenství jako služba platformy.

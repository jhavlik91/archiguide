# T063 — Supplier — profily + katalogy produktů

**Track:** O (supplier) | **Závislosti:** T009, T005 | **Stav:** draft

## Goal
Ekosystém výrobců/dodavatelů: supplier profil, produktové katalogy, technické materiály, propojení s realizacemi. Package 15. Viz `zadani/legacy-master-spec.md` §4.6, §5.17 (Supply taxonomie), `zadani/15-release-roadmap.md`.

## Scope
- Supplier jako typ organizace (T009 rozšíření, ne nová entita) s kategorií z taxonomie Supply (T005/T018-content-taxonomy).
- Model `Product`: supplier, název, kategorie, popis, technické parametry, média, dokumenty (technické listy — T023), stav (`draft → published → archived`).
- Katalog na profilu dodavatele: kategorie, filtry, detail produktu.
- Propojení produkt ↔ realizace: portfolio projekt (materials blok z T013) může odkázat konkrétní produkt — oboustranně viditelné („použito v realizacích"), jen se souhlasem autora portfolia.
- Produkty ukládatelné do moodboardů (T056 slot).
- Publikace technických materiálů (články/dokumenty pro profesionály).

## Klíčová pravidla
Supplier obsah jasně odlišený od nezávislého obsahu profesionálů; propojení s realizací vyžaduje souhlas autora realizace (žádné jednostranné marketingové přivlastnění); draft nikdy veřejný.

## Akceptační náčrt
Supplier profil s katalogem; produkt s technickým listem; propojení s realizací po souhlasu obou stran; produkt v moodboardu s kreditem; kategorie z taxonomie.

## Out of scope
Lead capture a promoted products (T064), e-commerce (košík, objednávky produktů), ceníky/dostupnost skladem, supplier plány (T058 data).

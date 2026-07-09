# T056 — Moodboardy

**Track:** M (social) | **Závislosti:** T016, T023 | **Stav:** draft

## Goal
Organizace inspirace: moodboard z uložených projektů, obrázků, produktů a materiálů, s poznámkami. Viz `zadani/legacy-master-spec.md` §40, `zadani/10-domain-entities.md` — Moodboard.

## Scope
- Model `Moodboard`: owner, visibility (`private` default | `shared` odkazem | `project` — vázaný na workspace T047 slot), items, notes.
- Item typy: celý portfolio projekt, jednotlivý obrázek z portfolia, produkt (slot T063), materiál, vlastní nahraný obrázek (T023).
- Přidávání: z detailu projektu/obrázku („uložit do moodboardu"), z uloženého (T055 slot), vlastní upload.
- Poznámky per item i per board; jednoduché řazení (drag & drop).
- Sdílení odkazem (read-only, odvolatelné — vzor T022); projektový moodboard viditelný členům workspace.
- Zdrojový obrázek vždy s kreditem a odkazem na původní projekt/autora.

## Klíčová pravidla
Privátní default; uložený obrázek z cizího portfolia nese kredit autora — moodboard není kopírování bez atribuce; smazaný zdrojový projekt → item s placeholder (obdoba T023).

## Akceptační náčrt
Uložení obrázku z portfolia do boardu s kreditem; sdílený board read-only, odvolatelný; privátní board neviditelný; poznámky u itemů; odpublikovaný zdroj → placeholder.

## Out of scope
Konverze na guide (T057), kolaborativní editace boardu, produkty dodavatelů (T063 — jen slot).

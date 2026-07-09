# T041 — Produktizované služby — nabídka

**Track:** J (služby) | **Závislosti:** T007, T005 | **Stav:** draft

## Goal
Profesionál nabízí službu s jasným rozsahem a cenou (60min konzultace, technická inspekce, druhý názor…). Package 10 (`zadani/15-release-roadmap.md`). Viz `zadani/legacy-master-spec.md` §29, `zadani/10-domain-entities.md` — ServiceOffering.

## Scope
- Model `ServiceOffering`: provider (profil/organizace), title, popis, cena, rozsah, **co klient dodá** (inputs), **co dostane** (outputs), termín dodání (lead time), omezení, storno podmínky, stav (`draft → published → archived`).
- CRUD v dashboardu profesionála; počet aktivních služeb později limitován plánem (T058 — zde jen konfigurovatelný strop).
- Veřejná prezentace: sekce „Služby" na profilu (T008 slot) + samostatná detail stránka služby s CTA „objednat" (slot T042).
- Šablony běžných služeb dle profese (§29 příklady) pro rychlé založení — data, ne hardcode.
- Napojení na guide výstup: doporučený další krok může odkázat na typ služby (např. konzultace) — slot.

## Klíčová pravidla
Jasná cena a rozsah — žádné „cena dohodou" bez vysvětlení struktury (`zadani/13-monetization.md` §1); draft není veřejný; multi-profession: služby vážou na profese z taxonomie, žádný hardcode.

## Akceptační náčrt
Publikovaná služba viditelná na profilu se všemi povinnými poli; draft neviditelný; archivace nezruší proběhlé objednávky; storno podmínky vždy zobrazeny před objednávkou.

## Out of scope
Objednávkový flow a rezervace (T042), platby (T059), transaction fees (T059/T060), vyhledávání služeb (T068).

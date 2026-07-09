# T068 — Vyhledávání — rozšíření

**Track:** P (platforma) | **Závislosti:** T034, T041, T037 | **Stav:** draft

## Goal
Rozšíření vyhledávání z profesionálů (T034) na plný rozsah dle zadání: služby, firmy, projekty; filtry dostupnost, hodnocení, cena, vzdálenost. Viz `zadani/legacy-master-spec.md` §38–39.

## Scope
- Nové vyhledávané entity: firmy/organizace (T009), publikované portfolio projekty (T016), služby (T041) — jednotné vyhledávací rozhraní s taby/typem výsledku, fulltext `tsvector` per entita.
- Nové filtry (§39): hodnocení (agregace z T037), cena/cenové pásmo (služby, pricing model profilu), dostupnost (kapacitní data T046, availability profilu), jazyk, velikost firmy, vzdálenost — geo výpočet (PostGIS nebo zeměpisná mřížka) místo pouhé shody regionu.
- Řazení dle hodnocení/relevance/vzdálenosti; featured pozice z T061 (označené, oddělené).
- Uložená hledání s volitelnou notifikací na nové výsledky (opt-in, digest kanál T033).
- Našeptávač (profese, lokality, firmy).

## Klíčová pravidla
Jen publikovaný obsah; hodnocení ve filtru = jen ověřené recenze (T037); nový profesionál bez recenzí nesmí být defaultním řazením pohřben (vzor z matchingu T028); geo data profilů zůstávají na úrovni, kterou vlastník zveřejnil (service area, ne přesná adresa).

## Akceptační náčrt
Hledání najde službu, firmu i projekt; filtr vzdálenosti od lokality funguje; řazení dle hodnocení jen z ověřených recenzí; uložené hledání notifikuje; featured výsledek označen.

## Out of scope
Základ profesionálů (T034), externí search engine (Postgres stačí i zde — revidovat při rozpracování dle objemu), vizuální/podobnostní vyhledávání, vyhledávání ve zprávách (T051).

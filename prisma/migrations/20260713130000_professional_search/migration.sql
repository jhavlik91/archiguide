-- T034: veřejné vyhledávání profesionálů — fulltext přes Postgres `tsvector`.
--
-- Zapíná rozšíření `unaccent`, aby fulltext ignoroval diakritiku: „zámečník"
-- i „zamecnik" dají po `unaccent()` stejný lexém a najdou stejné profily
-- (T034 § Edge cases). Dokument (headline, bio, specializace, názvy profesí a
-- publikovaných portfolio projektů) se skládá a matchuje za běhu v service
-- vrstvě (`features/search/service.ts`) nad ŽIVÝM publikovaným stavem — proto
-- se odpublikovaný profil okamžitě ztratí z výsledků bez potřeby přeindexování.
-- Materializovaný `tsvector` sloupec + trigger je připravená cesta pro škálování
-- (viz komentář v service vrstvě), pro MVP je dataset malý a přímý dotaz stačí.
--
-- Append-only: nepřidává sloupce do cizích tabulek (T007/T012), jen DB rozšíření.

CREATE EXTENSION IF NOT EXISTS unaccent;

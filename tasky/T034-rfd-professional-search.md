# T034 — Vyhledávání profesionálů

**Track:** H (trust/admin) | **Závislosti:** T007 | **Assignee:** —

## Goal
Veřejné vyhledávání a katalog profesionálů: fulltext + filtry (profese, lokalita, specializace, verifikace). Postgres `tsvector`, bez externího enginu. Viz `zadani/legacy-master-spec.md` §38–39, `TECHNICKE-ZADANI.md` §2.

## User roles
Kdokoli včetně návštěvníka (`zadani/05-permission-matrix.md` — prohlížet veřejné profily: Y pro všechny).

## Preconditions
T007 done (publikované profesionální profily).

## Main flow
1. Indexace: `tsvector` sloupec nad publikovanými profily — headline, bio, specializace, názvy publikovaných portfolio projektů (§38: fulltext hledá i v bio, projektech, specializacích); česká konfigurace (unaccent + czech/simple dictionary), aktualizace triggerem nebo při save.
2. Stránka `/profesionalove`: fulltext pole + filtry: profese (taxonomie T005), region/lokalita, specializace, ověřený účet (badge z T011), řazení (relevance / nejnovější).
3. Výsledky: karty profilů (jméno, profese, region, headline, náhled portfolia, přesné verifikační badge — „Telefon ověřen", nikdy „Verified Professional" dle `zadani/12-moderation-trust-safety.md` §3).
4. Vyhledávání přes synonyma profesí (taxonomie T005 — synonyms pole): „projektant" najde odpovídající profese.
5. URL-persistované filtry a dotaz (sdílitelné, SEO indexovatelné pro kategorie/regiony); cursor stránkování.
6. Prázdný výsledek: návrhy (zkusit širší region, odebrat filtr, příbuzné profese) — `zadani/07-screen-states.md`.
7. Mobil: filtry v drawer, karty pod sebou.

## Alternative flows
Dotaz bez fulltext shody, ale s odpovídající profesí v taxonomii → nabídnout kategorii; překlep/část slova → prefix matching (`to_tsquery` s `:*`).

## Validation
Dotaz sanitizovaný (tsquery escapování), filtry proti taxonomii; neznámé hodnoty ignorovat.

## Permissions
Jen publikované profily; draft/deaktivované se nikdy neobjeví ve výsledcích ani v indexu. Žádná privátní pole v kartě (přesná adresa, kontakty).

## States
N/A (čtení).

## Edge cases
Profil odpublikován → okamžitě mimo výsledky (index update); profesionál ve více profesích → nalezitelný přes všechny (`zadani/16-ai-team-execution-rules.md` §11 — žádný hardcode jedné profese); dotaz s diakritikou vs. bez → stejné výsledky (unaccent); prázdná DB → smysluplný stav katalogu.

## Analytics
Eventy: `search_performed` (dotaz bez PII, počet výsledků), `search_result_clicked`, `search_empty`.

## Acceptance criteria
- [ ] Fulltext najde profil podle textu v bio i podle názvu portfolio projektu.
- [ ] „Zamecnik" i „zámečník" vrací stejné výsledky; synonymum profese funguje.
- [ ] Draft profil se ve výsledcích nikdy neobjeví (test).
- [ ] Kombinace filtrů profese + region + ověření vrací korektní průnik.
- [ ] Prázdný výsledek nabídne konkrétní další kroky.

## Out of scope
Vyhledávání poptávek, služeb a firem jako samostatné entity (firmy nalezitelné přes profily členů; plné vyhledávání — finální produkt), řazení dle hodnocení (T037), geo-vzdálenostní výpočty (region match stačí pro MVP), uložená hledání.

# T054 — Feed

**Track:** M (social) | **Závislosti:** T053, T016, T026 | **Stav:** draft

## Goal
Obsahový feed: nové projekty, realizace, poptávky, pracovní a kapacitní nabídky, odborné příspěvky. Viz `zadani/legacy-master-spec.md` §26.1, Package 13.

## Scope
- Zdroje feedu (§26.1): publikované portfolio projekty (T016), veřejné poptávky (T026), pracovní nabídky (T043 slot), kapacitní nabídky (T046 slot), odborné příspěvky (nový lehký model `Post`: autor, text, obrázky, viditelnost), diskuse.
- Model `Post` + tvorba příspěvku (profil/organizace); stavy `draft → published → hidden` (moderace).
- Skládání feedu: primárně sledovaní (T053) + relevantní obsah dle profese/regionu; chronologické řazení s jasnou logikou — **žádný skrytý paid ranking** (`zadani/16-ai-team-execution-rules.md` §11), sponzorovaný obsah označen (slot T061).
- Feed pro nepřihlášeného: veřejný objevovací feed (kurátorovaný/nejnovější veřejný obsah).
- Prázdný feed nového uživatele → onboarding doporučení koho sledovat dle profese/zájmu.
- Report příspěvku (T036, target type `post`).

## Klíčová pravidla
Jen veřejný obsah — feed nikdy neprosákne draft/privátní data (anonymizace poptávek platí i zde); každá položka feedu odkazuje do svého kontextu.

## Akceptační náčrt
Publikace portfolia sledovaného → položka ve feedu followera; příspěvek s obrázky; draft se nikdy neobjeví; feed nepřihlášeného jen veřejný obsah; report příspěvku funguje.

## Out of scope
Interakce like/komentář/uložení (T055), algoritmická personalizace/ML, sponzorované pozice (T061), video obsah.

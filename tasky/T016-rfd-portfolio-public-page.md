# T016 — Portfolio — veřejná stránka

**Track:** C (portfolio) | **Závislosti:** T012 | **Assignee:** —

## Goal
Veřejný render publikovaného portfolio projektu — prémiová prezentace, responzivní. Viz `zadani/legacy-master-spec.md` §3.4.

## User roles
Visitor (čte); vlastník (preview draftu).

## Preconditions
Publikovaný projekt (T012) s bloky (T013 — render komponenty se sdílejí, vyvíjet lze proti seed datům).

## Main flow
1. Route `/projekt/[slug]`: hero (titul, typ, lokalita, rok, autoři), sekvence bloků dle typů (sdílené render komponenty s náhledem v T013).
2. Galerie s lightboxem; before/after slider.
3. Autoři: odkaz na profil vlastníka + potvrzené spoluautory (T012).
4. Seznam projektů na profilu profesionála/firmy (doplnění slotu v T008/T010).
5. SEO + OG obrázek z prvního image bloku.

## Alternative flows
Preview draftu pro vlastníka (`?preview=1`).

## Validation
N/A (read-only).

## Permissions
Draft/archived → 404 pro veřejnost. Renderuje se publish snapshot, ne pracovní draft.

## States
Renderuje `published` snapshot.

## Edge cases
Projekt bez obrázků; neexistující slug; spoluautor zrušil potvrzení po publikaci (nezobrazí se); velmi dlouhá galerie (lazy loading).

## Analytics
Event: `portfolio.viewed`.

## Acceptance criteria
- [ ] Publikovaný projekt viditelný nepřihlášenému, draft 404.
- [ ] Render odpovídá náhledu z editoru (sdílené komponenty).
- [ ] Lightbox a before/after fungují na mobilu.
- [ ] Seznam projektů se zobrazuje na profilu vlastníka.

## Out of scope
Editor (T013), ukládání do inspirace/moodboardy (finální produkt), komentáře/liky.

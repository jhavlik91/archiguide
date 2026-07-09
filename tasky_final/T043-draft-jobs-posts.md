# T043 — Jobs — pracovní nabídky

**Track:** K (jobs/team/kapacita) | **Závislosti:** T009, T005 | **Stav:** draft

## Goal
Pracovní marketplace: firma publikuje nabídku (zaměstnání, freelance, internship, projektová spolupráce), veřejný výpis s filtry. Package 11. Viz `zadani/legacy-master-spec.md` §30, `zadani/10-domain-entities.md` — JobPost.

## Scope
- Model `JobPost`: organizace, role, lokalita, work mode (on-site/hybrid/remote), typ (§30.1), seniorita, rozsah, očekávání, odměna dle pravidel trhu, požadované dovednosti/profese (taxonomie), stav (`draft → published → paused → closed | expired`).
- CRUD pro firemní role s oprávněním (Owner/Admin/Recruiter dle `zadani/05-permission-matrix.md` — firemní role).
- Veřejný výpis `/prace` s filtry (profese, lokalita, work mode, typ, seniorita) + detail; expirace publikovaných nabídek.
- Zobrazení na firemním profilu (T010 slot).
- Notifikace `relevant_job` pro profesionály dle profese/regionu (opt-in preference, T033).

## Klíčová pravidla
Nejasná odměna → pole povinně strukturované (rozsah nebo „dle dohody" s vysvětlením) — `zadani/09-edge-cases.md` — Jobs; diskriminační obsah reportovatelný (T036, target type `job_post`); duplicitní nabídka detekována (stejná role+firma aktivní).

## Akceptační náčrt
Publikace jen s firemní rolí s oprávněním; expirovaná nabídka mimo výpis, detail hlásí stav; filtry dle taxonomie; report nabídky funguje.

## Out of scope
Application flow (T044), placené/featured listingy (T061 + `zadani/13-monetization.md` §6), doporučování kandidátů.

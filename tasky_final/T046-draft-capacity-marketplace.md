# T046 — Kapacitní marketplace

**Track:** K (jobs/team/kapacita) | **Závislosti:** T007 | **Stav:** draft

## Goal
Profesionál zveřejní volnou kapacitu („BIM modelář, 20 h týdně, dostupný od září") a firmy/profesionálové ji najdou. Viz `zadani/legacy-master-spec.md` §32, `zadani/10-domain-entities.md` — CapacityOffer.

## Scope
- Model `CapacityOffer`: profesionál, dostupný od, hodin týdně, délka dostupnosti, typ práce/skills (vazba na profese/specializace), region, remote/on-site, stav (`draft → published → paused → expired | closed`).
- CRUD v dashboardu profesionála; automatická expirace po konci období dostupnosti.
- Výpis kapacit s filtry (profese, region, remote, dostupnost od, hodiny) — konzument je B2B strana.
- Kontakt na nabídku → konverzace (T030 kontext) nebo propojení s team requestem (T045 slot).
- Feed event `kapacitní nabídka` (slot pro T054).
- Volitelná dostupnost promítnutá do matchingu (T028 kritérium dostupnost — kapacitní data jako signál).

## Klíčová pravidla
Kapacita je časově citlivá — prošlá nabídka nesmí vypadat aktivní; publikace kapacity je vědomé rozhodnutí (může signalizovat nevytíženost — soukromí: viditelnost volitelně jen pro ověřené firmy).

## Akceptační náčrt
Publikovaná kapacita nalezitelná dle filtrů; expirace automatická; kontakt otevře konverzaci; pauza okamžitě skryje z výpisu.

## Out of scope
Rezervace kapacity se závazkem, fakturace, kalendářová synchronizace.

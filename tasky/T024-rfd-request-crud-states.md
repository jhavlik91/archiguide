# T024 — Poptávka — CRUD + stavový model

**Track:** F (marketplace) | **Závislosti:** T021 | **Assignee:** —

## Goal
Model poptávky (Request) navázané na brief, její vytvoření, editace a kompletní stavový automat s validovanými přechody. Jádro marketplace. Viz `zadani/legacy-master-spec.md` §20, `zadani/08-workflows-state-machines.md` §3.

## User roles
B2C klient (vlastník), B2B klient/profesionál/firma (dle `zadani/05-permission-matrix.md` — publikace B2C/B2B poptávky).

## Preconditions
T021 done. Uživatel má brief (poptávka bez briefu v MVP nevzniká — guide je kritická cesta).

## Main flow
1. Model `Request` dle `zadani/10-domain-entities.md`: typ (`b2c` | `b2b` v MVP), visibility (řeší T025 — zde pole + default `private`), FK na Brief, status, target professions (z taxonomie T005), region, budget, timeline.
2. Vytvoření z briefu: předvyplnění z brief dat, uživatel potvrdí/upraví; jeden brief může mít více poptávek (např. jiné profese).
3. Editace draftu; po publikaci jen omezená editace (upřesnění, ne změna smyslu) s viditelnou poznámkou „upraveno“.
4. Stavový automat: `draft → active → in_discussion → awarded → closed`; `active → paused → active`, `active → cancelled | expired`, `in_discussion → cancelled`. Přechody jako server actions s kontrolou oprávnění; neplatný přechod server odmítne (`zadani/08-workflows-state-machines.md` — stavová pravidla).
5. Expirace: `active` poptávka s prošlým termínem → `expired` (kontrola při čtení + denní job stačí pro MVP).
6. Auditní záznam významných přechodů (publish, pause, cancel, award, close).
7. Dashboard vlastníka: seznam mých poptávek se stavem a počtem reakcí (slot pro T027).

## Alternative flows
Zrušení s aktivními reakcemi → reakce dostanou stav umožňující notifikaci (T032 slot); pauza → nové reakce nejsou přijímány, rozpracované konverzace pokračují.

## Validation
Zod: povinné target professions (≥1), region, typ; budget/timeline mohou být „neuvedeno“ (nevím je validní).

## Permissions
CRUD jen vlastník; publikace dle permission matice (B2C poptávku publikuje B2C klient, B2B podmíněně); přechody stavů jen vlastník (award/close), admin cokoliv.

## States
Viz Main flow 4. Stavy enum v DB, uživatel vždy vidí aktuální stav.

## Edge cases
Klient smaže účet během aktivní poptávky → poptávka `cancelled`, reakce notifikovány (`zadani/09-edge-cases.md` — Request); profesionál reaguje těsně po `paused` → reakce odmítnuta se srozumitelnou hláškou; brief se změní po publikaci poptávky → poptávka drží snapshot briefu z okamžiku publikace; spam/nelegální poptávka → nahlásitelná (T036 slot).

## Analytics
Eventy: `request_created`, `request_published`, stavové přechody (`request_paused`, `request_cancelled`, `request_closed`).

## Acceptance criteria
- [ ] Unit testy stavového automatu: všechny povolené přechody projdou, neplatné server odmítne.
- [ ] E2E: brief → vytvoření poptávky → publikace → pauza → obnovení.
- [ ] Publikace vyžaduje oprávnění dle role; návštěvník nikdy.
- [ ] Expirovaná poptávka přejde do `expired` a nepřijímá reakce.
- [ ] Auditní log obsahuje publish/pause/cancel/award/close.

## Out of scope
Viditelnost + anonymizace (T025), veřejný výpis (T026), reakce (T027), matching (T028), typy poptávek mimo B2C/B2B (invite-only, urgentní, subdodavatelské, pracovní — finální produkt).

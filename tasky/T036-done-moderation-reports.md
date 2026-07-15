# T036 — Moderace — nahlášení obsahu

**Track:** H (trust/admin) | **Závislosti:** T004 | **Assignee:** —

## Goal
Univerzální report systém (nahlášení profilu, projektu, poptávky, zprávy, recenze) a moderační fronta s akcemi. Beta exit criteria: „admin umí řešit reporty" (`zadani/15-release-roadmap.md`). Viz `zadani/12-moderation-trust-safety.md`, `zadani/legacy-master-spec.md` §49.

## User roles
Přihlášený uživatel (reporter); moderátor/admin (zpracování — `zadani/05-permission-matrix.md`).

## Preconditions
T004 done. Konzumující domény (T008, T016, T026, T031, T037) přidávají „nahlásit" tlačítko volající sdílené API tohoto tasku.

## Main flow
1. Model `Report` dle `zadani/10-domain-entities.md`: reporter, target type (profile, portfolio_project, request, message, review — polymorfně), target id, reason (enum `zadani/12-moderation-trust-safety.md` §4: spam, scam, fake identity, harassment, dangerous advice, copyright, impersonation, illegal solicitation), volitelný popis, state.
2. Sdílená komponenta + server action `reportContent(targetType, targetId, reason, note)` — domény jen embedují.
3. Stavový model reportu (§5): `open → triaged → under_review → actioned | dismissed`; `actioned → appealed → closed`, `dismissed → closed`.
4. Moderační fronta v `(admin)/`: výpis reportů s filtry (stav, typ, důvod), řazení dle stáří; detail: nahlášený obsah (jen nezbytný kontext — u zprávy nahlášená zpráva + bezprostřední okolí, ne celá historie), historie reportů téhož cíle/uživatele.
5. Akce (§6): no action (dismiss), warning uživateli (notifikace slot), content hide (moderation state na cílové entitě), content remove, feature restriction a suspenze účtu (napojení na T035 suspenzi). Každá akce: povinný důvod + auditní záznam.
6. Reporter dostane zpětnou vazbu o vyřešení (bez detailu akce); nahlášený je informován při zásahu proti němu s důvodem.

## Alternative flows
Duplicitní report téhož cíle týmž uživatelem → připojí se k existujícímu open reportu (počítadlo), ne nový záznam; obsah smazán autorem před vyřízením → report jde uzavřít s poznámkou.

## Validation
Reason z enumu; target musí existovat; reporter nemůže nahlásit vlastní obsah.

## Permissions
Report: každý přihlášený; fronta a akce: moderátor + admin (suspenze jen admin, dle T035); moderátor vidí nahlášený obsah i privátní jen v rozsahu reportu (matice — číst cizí zprávy: C).

## States
Report: viz Main flow 3, neplatné přechody odmítnuty; cílové entity: `visible → hidden → visible` (restore).

## Edge cases
Koordinované hromadné nahlášení jednoho cíle → agregace do jednoho případu, ne DoS fronty; report obsahu, na který reporter ztratil přístup (byl zablokován) → report zůstává platný; hide obsahu, který je v běžící poptávce → účastníci vidí placeholder s vysvětlením; falešné/šikanózní reporty → dismiss + historie reportera viditelná moderátorovi.

## Analytics
Eventy: `report_created`, `report_actioned`, `report_dismissed`; guardrail metriky time-to-moderation (`zadani/14-metrics-analytics.md`).

## Acceptance criteria
- [x] E2E: uživatel nahlásí zprávu → report ve frontě → moderátor hide → obsah skryt s placeholder, reporter notifikován.
- [x] Unit testy stavového automatu reportu.
- [x] Duplicitní report se agreguje.
- [x] Moderátor u nahlášené zprávy nevidí celou konverzaci.
- [x] Každá moderační akce má auditní záznam s důvodem.

## Out of scope
Automatická detekce (spam filtry, ML), appeals workflow UI (stav existuje, plné UI — finální produkt), review-specific abuse ochrany (T037), suspenze mechanika (T035 — zde jen volání).

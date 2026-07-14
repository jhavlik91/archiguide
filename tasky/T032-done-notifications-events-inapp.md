# T032 — Notifikace — event systém + in-app

**Track:** G (komunikace) | **Závislosti:** T004 | **Assignee:** Claude

## Goal
Doménový event systém a in-app notifikace: jednotné API, kterým ostatní domény emitují události, deduplikace, notifikační centrum. Viz `zadani/11-notifications.md`, `zadani/10-domain-entities.md` — Notification.

## User roles
Všichni přihlášení (příjemci).

## Preconditions
T004 done.

## Main flow
1. Model `Notification`: recipient, event type (enum dle `zadani/11-notifications.md` — messaging, marketplace, matching, verification skupiny pro MVP), channel, priority (`low|normal|high|urgent`), state (`unread → read`), odkaz do kontextu, dedup klíč.
2. Emitní API `lib/notifications.ts`: `emit(eventType, recipient, context)` — jediný vstupní bod; domény (T027, T030, T011…) volají emit, systém rozhodne kanály dle default channel policy a preferencí (preference UI v T033, zde jen respektování uložených hodnot s defaulty dle policy tabulky).
3. **Deduplikace**: opakovaný emit se stejným dedup klíčem v okně neverzí duplicitní notifikaci (např. 5 zpráv v konverzaci = 1 nepřečtená notifikace s počtem).
4. Notifikační centrum (zvoneček v layoutu T006): seznam, nepřečtené počítadlo, označit přečtené (jednotlivě/vše).
5. Každá notifikace: **důvod** (proč ji uživatel dostal) a **odkaz vedoucí přímo do kontextu** (konverzace, poptávka, reakce) — pravidla z `zadani/11-notifications.md`.
6. MVP event types: `new_message`, `new_response`, `response_viewed`, `shortlisted`, `response_accepted`, `response_rejected`, `request_paused`, `request_closed`, `new_recommendation`, `recommended_request`, `verification_*`. Enum otevřený pro rozšíření (finální produkt), žádný hardcode na jednu doménu.

## Alternative flows
Kontext notifikace mezitím smazán → klik vede na smysluplnou stránku se stavem, ne 404 bez vysvětlení; příjemce = původce akce → notifikace se neemituje (vlastní akce nenotifikuje).

## Validation
Event type z enumu; recipient existuje; kontextový odkaz povinný.

## Permissions
Uživatel vidí jen své notifikace. Notifikace nesmí prozradit obsah, na který příjemce nemá právo (např. jen „nová zpráva od X", ne obsah).

## States
Notification: `unread → read`; hromadné označení.

## Edge cases
Bouře eventů (např. hromadné reakce) → deduplikace drží centrum použitelné; notifikace na anonymizovanou poptávku neprozrazuje identitu klienta; uživatel ztratí oprávnění ke kontextu (odebrán z konverzace) → notifikace zůstává, cíl korektně hlásí nedostupnost.

## Analytics
Eventy: `notification_created`, `notification_opened` (bez citlivých dat v názvech — `zadani/14-metrics-analytics.md`).

## Acceptance criteria
- [x] Unit testy emit API: dedup, ne-notifikace vlastní akce, respektování preferencí.
- [x] E2E: nová zpráva (T030) → nepřečtená notifikace → klik vede do konverzace → přečteno.
- [x] 5 rychlých zpráv v jedné konverzaci = 1 notifikace, ne 5.
- [x] Notifikace zobrazuje důvod a validní odkaz do kontextu.
- [x] Cizí notifikace nejsou dostupné (403/404).

## Out of scope
E-mail, digest, preference UI (T033), SMS a push (finální produkt), real-time doručení (stačí revalidace).

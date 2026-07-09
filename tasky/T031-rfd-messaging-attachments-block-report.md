# T031 — Messaging — přílohy, kontext, block/report

**Track:** G (komunikace) | **Závislosti:** T030, T023 | **Assignee:** —

## Goal
Rozšíření messagingu: přílohy ve zprávách (obrázky, PDF), blokace uživatele a nahlášení zprávy. Dokončuje Package 7 (`zadani/15-release-roadmap.md`). Viz `zadani/legacy-master-spec.md` §27.2–27.3.

## User roles
Účastníci konverzace.

## Preconditions
T030, T023 done.

## Main flow
1. Přílohy zpráv přes attachment systém (T023): obrázky (inline náhled), PDF a dokumenty (karta s názvem/velikostí); viditelnost `shared_in_context` — přístup jen účastníci konverzace.
2. Blokace uživatele: účastník zablokuje protistranu → blokovaný nemůže psát (srozumitelná hláška bez detailu „byl jste zablokován" vs. neutrální „zprávu nelze doručit" — zvolit neutrální variantu, nepřiživovat konflikt), blokující konverzaci nevidí v aktivním inboxu; blokace je vratná v nastavení.
3. Nahlášení zprávy: důvody dle `zadani/12-moderation-trust-safety.md` §4 (spam, scam, harassment, phishing…); report vytváří záznam pro moderační frontu (model kompatibilní s T036 — koordinovat append-only, report zprávy = `Report` s target type `message`). Nahlášená zpráva zpřístupní moderátorovi jen nahlášený obsah + nezbytný kontext, ne celou historii (permission matice — číst cizí zprávy: C).
4. Privacy hint: detekce telefonního čísla/e-mailu v odchozí zprávě → jemné nenucené upozornění (kontakt sdílíte na vlastní uvážení), **neblokuje** — platforma nesmí bránit legitimní komunikaci (§27.3).
5. Odstranění vlastní přílohy → placeholder „příloha odstraněna" (T023).

## Alternative flows
Upload přílohy selže → zpráva se neodešle napůl (zpráva s přílohou je atomická), text zůstává; report vlastní zprávy → nedává smysl, zablokováno.

## Validation
Mime/velikost dle T023; report vyžaduje důvod z enumu.

## Permissions
Přílohu stáhne jen účastník konverzace (`canAccess` z T023); blokace jen účastník; report jen účastník.

## States
Block: aktivní/zrušená per dvojice uživatelů; Report: `open` (další stavy zpracovává T036); Message moderation state `hidden` po moderačním zásahu.

## Edge cases
Příloha odstraněna po přečtení protistranou → placeholder, ne chyba (`zadani/09-edge-cases.md` — Messaging); blokovaný účastník ve společné konverzaci ke stejné poptávce → smí dokončit jen čtení historie; phishing zpráva → report + moderace; blokace během rozepsané odpovědi protistrany → odeslání selže srozumitelně.

## Analytics
Eventy: `attachment_sent`, `conversation_blocked`, `message_reported` (viz `zadani/14-metrics-analytics.md`).

## Acceptance criteria
- [ ] E2E: odeslání zprávy s obrázkem → protistrana vidí náhled a stáhne; třetí uživatel přílohu nestáhne.
- [ ] Blokace: blokovaný nemůže doručit zprávu, blokující ji nevidí; odblokování obnoví komunikaci.
- [ ] Report zprávy vytvoří záznam ve frontě s důvodem a kontextem.
- [ ] Telefon ve zprávě vyvolá hint, ale zpráva se odešle.
- [ ] Nedoručitelná zpráva s přílohou nezanechá osiřelou přílohu.

## Out of scope
Moderační workflow reportů (T036), zmínky/reakce/vyhledávání ve zprávách, skupinové konverzace, tvrdé skrývání kontaktů podle business pravidel (monetizace — finální produkt).

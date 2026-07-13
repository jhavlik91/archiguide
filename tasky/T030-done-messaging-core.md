# T030 — Messaging — core

**Track:** G (komunikace) | **Závislosti:** T004 | **Assignee:** Claude

## Goal
Základ zpráv: konverzace 1:1 (klient–profesionál), odesílání textových zpráv, stav přečtení, inbox. Viz `zadani/legacy-master-spec.md` §27, `zadani/15-release-roadmap.md` Package 7.

## User roles
Přihlášení uživatelé (`zadani/05-permission-matrix.md` — psát zprávy: všechny přihlášené role, návštěvník N; číst cizí zprávy: nikdo kromě podmíněně moderátor/admin).

## Preconditions
T004 done.

## Main flow
1. Modely dle `zadani/10-domain-entities.md`: `Conversation` (participants, context — polymorfní odkaz např. na Request/Response, state), `Message` (sender, conversation, content, reply reference, moderation state; attachments řeší T031).
2. Vytvoření konverzace: z kontextu (reakce na poptávku, profil) nebo přímo; existující konverzace stejných účastníků ve stejném kontextu se znovupoužije — žádné duplicity.
3. Odeslání zprávy: server action, optimistické UI s potvrzením uložení — **nikdy falešně nehlásit odesláno** (`zadani/16-ai-team-execution-rules.md` §8).
4. Inbox: seznam konverzací řazený dle poslední zprávy, nepřečtené počítadlo, náhled poslední zprávy; vlákno konverzace se stavem přečtení a odpovědí na konkrétní zprávu (reply reference).
5. Polling/refresh pro nové zprávy (bez websocketů v MVP — interval revalidace stačí).
6. Kontext konverzace viditelný v hlavičce (odkaz na poptávku/profil, ze které vznikla).
7. Responsivní: mobilní two-pane → navigace seznam ↔ vlákno (`zadani/legacy-master-spec.md` §53.3).

## Alternative flows
Zpráva neuložena (síť/server) → jasná chyba, obsah zůstává v poli, retry; konverzace s deaktivovaným účtem → historie čitelná, odeslání zablokované s vysvětlením.

## Validation
Zod: neprázdný obsah, max délka; odesílatel musí být účastník konverzace.

## Permissions
Číst/psát jen účastníci; žádný jiný uživatel nemá přístup (ani jiné role v matici — „číst cizí zprávy" jen moderátor/admin podmíněně, to řeší T036 přes reporty, ne přímý přístup). Vše přes `lib/permissions.ts`. Analytika nesbírá obsah zpráv (`zadani/14-metrics-analytics.md` — pravidla).

## States
Conversation: `active → archived` (per účastník); Message moderation state: `visible` (default; `hidden` používá T036).

## Edge cases
Účet zrušen → zprávy zůstávají s placeholder identitou „zrušený účet" (`zadani/09-edge-cases.md` — Messaging); duplicitní rychlé odeslání (double-click) → idempotence; velmi dlouhé vlákno → stránkovaná historie; XSS v obsahu → obsah renderován jako text, nikdy HTML.

## Analytics
Eventy: `conversation_started`, `message_sent` (bez obsahu zpráv).

## Acceptance criteria
- [x] E2E: uživatel A napíše B → B vidí konverzaci v inboxu s nepřečteným počítadlem → odpoví → A vidí odpověď.
- [x] Cizí uživatel (ani jiný přihlášený) konverzaci neotevře (403/404).
- [x] Selhání odeslání nezahodí rozepsaný text a nehlásí úspěch.
- [x] Stejný kontext nevytvoří druhou konverzaci stejných účastníků.
- [x] Obsah zprávy s HTML se zobrazí jako text.

## Out of scope
Přílohy, block/report, ochrana kontaktů (T031), skupinové/projektové konverzace (finální produkt), notifikace (T032/T033), real-time push, vyhledávání ve zprávách.

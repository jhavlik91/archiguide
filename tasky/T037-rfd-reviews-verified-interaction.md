# T037 — Hodnocení s ověřenou interakcí

**Track:** H (trust/admin) | **Závislosti:** T027 | **Assignee:** —

## Goal
Recenze profesionála/firmy podmíněná ověřenou interakcí na platformě, s právem na reakci a základní ochranou proti zneužití. Základ Package 9 — review eligibility + reviews. Viz `zadani/legacy-master-spec.md` §36, `zadani/08-workflows-state-machines.md` §6.

## User roles
Klient s ověřenou interakcí (reviewer); hodnocený profesionál/firma (reakce); moderátor (spory — návaznost na T036).

## Preconditions
T027 done. Eligibilita v MVP = reakce profesionála ve stavu `accepted` na poptávku klienta (interaction evidence dle `zadani/10-domain-entities.md` — Review).

## Main flow
1. Model `Review`: reviewer, target (profil/organizace), interaction evidence (FK na accepted RequestResponse), ratings per kritérium (§36.2: komunikace, kvalita, termíny, transparentnost, profesionalita — škála 1–5), text, status, reply.
2. Eligibilita: systém nabídne hodnocení po `accepted` (a při uzavření poptávky); **bez ověřené interakce recenzi nelze založit** (§36.1) — žádné volné recenze.
3. Jedna recenze per interakce; editovatelná krátce po odeslání (24 h), pak zamčená.
4. Stavový automat: `eligible → submitted → published`; `submitted → moderation_pending`; `published → disputed → published | hidden`, `hidden → restored`.
5. Právo na reakci: hodnocený připojí jednu veřejnou odpověď (§36.3).
6. Spor (dispute): hodnocený rozporuje recenzi s důvodem → `disputed`, recenze zůstává viditelná s příznakem „rozporováno", případ jde do moderační fronty (T036, target type `review`); moderátor: ponechat (`published`) / skrýt (`hidden`).
7. Zobrazení na veřejném profilu (T008 — slot): průměr per kritérium, počet recenzí, jednotlivé recenze s odpověďmi; **badge vždy říká, co znamená** — „hodnocení z ověřených spoluprací" (`zadani/12-moderation-trust-safety.md` §3).

## Alternative flows
Klient hodnotí firmu i konkrétní osobu → v MVP cílí recenze na subjekt reakce (profil, nebo organizace, pokud reagovala firma); reviewer smaže účet → recenze zůstává anonymizovaná („bývalý uživatel").

## Validation
Zod: všechna kritéria povinná, text volitelný s max délkou; evidence musí patřit revieweru a být `accepted`; duplicitní recenze na tutéž interakci odmítnuta (§36.3 — ochrana proti duplicitám).

## Permissions
Založení: jen reviewer s eligibilitou (matice — vytvořit recenzi: C); reply: jen hodnocený; dispute: jen hodnocený; moderace: moderátor/admin; čtení published: veřejné.

## States
Viz Main flow 4; přechody validované na serveru, auditní záznam u moderace.

## Edge cases
Revenge review po sporu o platbu → dispute flow, moderátor rozhoduje (`zadani/09-edge-cases.md` — Reviews); extortion („dám 1* pokud nevrátíte peníze") → reportovatelné (T036), moderátor skryje; recenze konkurenta → nemožná bez accepted interakce (eligibilita ji blokuje by design); spor, zda interakce proběhla → evidence je platformní accepted reakce, spor se týká obsahu; jedna zakázka, více hodnotících osob → v MVP hodnotí vlastník poptávky.

## Analytics
Eventy: `review_eligible`, `review_submitted`, `review_disputed` (viz `zadani/14-metrics-analytics.md` — Trust).

## Acceptance criteria
- [ ] Recenzi nelze založit bez accepted interakce (test na server action).
- [ ] E2E: accepted reakce → výzva k hodnocení → odeslání → recenze na veřejném profilu.
- [ ] Duplicitní recenze na stejnou interakci odmítnuta.
- [ ] Hodnocený může odpovědět a rozporovat; disputed recenze nese viditelný příznak.
- [ ] Skrytá recenze se nepočítá do průměru a není veřejná.

## Out of scope
Detekce koordinovaného zneužití (finální produkt), recenze mimo platformní interakce (import, externí zakázky), hodnocení klientů profesionály, váhování matchingu recenzemi (T028 má slot).

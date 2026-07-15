# T033 — Notifikace — e-mail + preference + digest

**Track:** G (komunikace) | **Závislosti:** T032 | **Assignee:** —

## Goal
E-mailový kanál notifikací, uživatelské preference per událost/kanál a týdenní digest. Dokončuje Package 8 (`zadani/15-release-roadmap.md`). Viz `zadani/11-notifications.md`, `zadani/legacy-master-spec.md` §28.

## User roles
Všichni přihlášení.

## Preconditions
T032 done. E-mail transport dle `TECHNICKE-ZADANI.md` §2 (Resend; dev = preview transport).

## Main flow
1. E-mail dispatcher napojený na emit pipeline (T032): událost → šablona → odeslání dle default channel policy (`zadani/11-notifications.md`: new_response Y, new_message C = jen dle preference, weekly digest Y…).
2. E-mailové šablony (React Email nebo ekvivalent): hlavička, důvod notifikace, CTA odkaz přímo do kontextu, patička s odkazem na správu preferencí a one-click unsubscribe (per kategorie).
3. Preference UI v nastavení účtu: matice událost-skupina × kanál (in-app / e-mail); frekvence e-mailů: okamžitě / denní souhrn / týdenní digest (§28.2). In-app nelze plně vypnout pro kritické servisní události.
4. Týdenní digest: souhrn za období (nové reakce, doporučení, nepřečtené zprávy — počty a titulky); **digest neobsahuje citlivá data nevhodná do e-mailu** (žádný obsah zpráv, žádné adresy — `zadani/11-notifications.md` pravidla); neposílá se, když není co poslat.
5. Denní/týdenní odesílání: cron endpoint / scheduled job; idempotentní (opakovaný běh nepošle duplicitu).
6. Bounce/failure handling: chyba odeslání se loguje, nezpůsobí pád emit pipeline (e-mail je best-effort, in-app je zdroj pravdy).

## Alternative flows
Uživatel vše vypne → dostává jen in-app kritické servisní; unsubscribe link z e-mailu → potvrzení + okamžitá platnost bez přihlášení (podepsaný token).

## Validation
Preference jen pro vlastní účet; hodnoty z enumu.

## Permissions
Preference čte/mění jen vlastník. Odesílané e-maily respektují viditelnost dat (anonymizovaná poptávka zůstává anonymní i v e-mailu).

## States
Per-notifikace e-mail stav: `queued → sent | failed` (pro audit).

## Edge cases
Digest období bez aktivity → e-mail se neodešle; změněný e-mail účtu → posílá se jen na ověřený (T011); notifikace o smazaném kontextu → e-mail se nepošle, pokud kontext už neexistuje v čase odeslání; duplicitní cron běh → idempotence.

## Analytics
Eventy: `email_sent`, `email_unsubscribed`, `digest_sent` (bez citlivých dat).

## Acceptance criteria
- [x] Nová reakce na poptávku → e-mail dle policy (Y) s odkazem do kontextu; nová zpráva bez opt-in e-mail negeneruje.
- [x] Změna preference se okamžitě projeví (unit test dispatch rozhodování).
- [x] Unsubscribe z patičky funguje bez přihlášení a jen pro danou kategorii.
- [x] Digest neobsahuje obsah zpráv ani adresy; prázdný digest se neodešle.
- [x] Selhání e-mail providera neshodí vytvoření in-app notifikace.

## Out of scope
SMS a push (finální produkt), marketingové e-maily, A/B testování šablon, transakční e-maily auth (T003 — reset hesla apod. už existují).

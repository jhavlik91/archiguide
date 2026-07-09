# QA Acceptance Pack

## E2E-001 — Neznámý rozpočet
1. Návštěvník začne „Rekonstrukce domu“.
2. U rozpočtu vybere „Nevím“.
3. Dokončí guide.
4. Vznikne brief.
Expected:
- brief nemá vymyšlenou částku,
- doporučí další krok vhodný pro odhad.

## E2E-002 — Koupě domu před rozhodnutím
1. Klient vybere koupi nemovitosti.
2. Vloží odkaz na inzerát.
3. Uvede obavy z vlhkosti.
4. Dokončí guide.
Expected:
- doporučení relevantních profesí,
- žádná definitivní diagnóza.

## E2E-003 — Soukromá adresa
1. Klient vytvoří brief s přesnou adresou.
2. Publikuje anonymizovanou poptávku.
Expected:
- adresa není veřejná.

## E2E-004 — Profesionál bez kapacity
1. Profesionál nastaví unavailable.
2. Klient dokončí matching.
Expected:
- profesionál není prezentován jako aktivně dostupný.

## E2E-005 — Sponsored result
1. Matching obsahuje sponsorovaný profil.
Expected:
- jasné označení,
- organické důvody nejsou zaměněny s reklamou.

## E2E-006 — Portfolio draft
1. Profesionál vytvoří projekt.
2. Uloží draft.
Expected:
- veřejný návštěvník projekt nenajde.

## E2E-007 — Coauthor
1. Autor označí spoluautora.
2. Spoluautor nepotvrdí.
Expected:
- není zobrazen jako potvrzený spoluautor.

## E2E-008 — Pause request
1. Aktivní request má 2 reakce.
2. Klient ho pozastaví.
Expected:
- reakce zůstávají,
- nové reakce nejsou přijímány.

## E2E-009 — Messaging block
1. A zablokuje B.
Expected:
- B nemůže zahájit novou přímou konverzaci.

## E2E-010 — Review eligibility
1. Uživatel bez ověřené interakce otevře review flow.
Expected:
- standardní review není povoleno.

## E2E-011 — Company removal
1. Člen je odebrán z firmy.
Expected:
- osobní účet zůstává,
- firemní oprávnění zmizí.

## E2E-012 — Sensitive document public warning
1. Uživatel mění soukromý dokument na veřejný.
Expected:
- explicitní potvrzení.

## E2E-013 — Safety trigger
1. Uživatel uvede zápach plynu.
Expected:
- bezpečnostní upozornění,
- žádné běžné „doporučení počkat na nabídky“.

## E2E-014 — Resume guide
1. Uživatel vyplní část guide.
2. Odejde.
3. Vrátí se.
Expected:
- pokračuje z uloženého stavu.

## E2E-015 — Mobile request response
1. Profesionál na mobilu otevře request.
2. Reaguje.
3. Připojí soubor.
Expected:
- flow dokončitelný.

## E2E-016 — Request update after sharing
1. Brief je sdílen.
2. Klient ho upraví.
Expected:
- systém jasně rozliší novou verzi.

## E2E-017 — Downgrade
1. Pro účet má více projektů než Free limit.
2. Downgrade.
Expected:
- projekty nejsou automaticky smazány.

## E2E-018 — Review dispute
1. Profesionál nahlásí recenzi.
Expected:
- stav sporu je viditelný oprávněným osobám,
- historie je auditovatelná.

## E2E-019 — Empty match
1. V regionu není relevantní profesionál.
Expected:
- žádná falešná doporučení,
- nabídnut bezpečný další krok.

## E2E-020 — Multi-role context
1. Uživatel je klient i člen firmy.
2. Publikuje obsah.
Expected:
- je jasné, za koho publikuje.

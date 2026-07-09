# Acceptance Criteria

## AC — B2C Guide

### AC-G-001
Given uživatel zahájí guide  
When zvolí libovolný hlavní scénář  
Then systém zobrazí relevantní první otázky  
And nezobrazí otázky, které jsou již zjevně nerelevantní.

### AC-G-002
Given otázka podporuje odpověď „nevím“  
When ji uživatel zvolí  
Then může pokračovat  
And výstup označí neznámou informaci jako chybějící, nikoli odhadnutou.

### AC-G-003
Given uživatel přeruší guide  
When se později vrátí  
Then může pokračovat od uloženého stavu.

### AC-G-004
Given odpověď naznačuje možné bezpečnostní riziko  
When je podmínka vyhodnocena  
Then systém zobrazí jasné upozornění  
And neprezentuje guide jako náhradu havarijní pomoci.

### AC-G-005
Given uživatel dokončí guide  
Then vždy vznikne shrnutí  
And doporučený další krok  
And seznam doporučených profesí nebo vysvětlení, proč profesi zatím nelze určit.

## AC — Brief

### AC-B-001
Given dokončený guide  
When uživatel vytvoří brief  
Then brief obsahuje dostupné odpovědi  
And neznámé hodnoty nejsou doplněny vymyšlenou hodnotou.

### AC-B-002
Given brief obsahuje přesnou adresu  
Then její veřejná viditelnost je defaultně vypnutá.

### AC-B-003
Given uživatel upraví brief  
Then změna se projeví až po uložení  
And je jasné, zda jde o draft nebo publikovanou verzi.

## AC — Request

### AC-R-001
Given draft poptávky  
When uživatel publikuje  
Then musí být zvolen režim viditelnosti.

### AC-R-002
Given anonymizovaná poptávka  
Then veřejnost nevidí identitu klienta  
And nevidí přesnou adresu  
And nevidí neveřejné přílohy.

### AC-R-003
Given aktivní poptávka  
When klient zvolí Pause  
Then nové reakce nejsou přijímány  
And existující konverzace zůstávají dostupné.

### AC-R-004
Given profesionál reaguje  
Then klient vidí stav reakce  
And profesionál vidí vlastní stav reakce.

## AC — Matching

### AC-M-001
Given doporučený profesionál  
Then systém zobrazí alespoň jeden lidsky srozumitelný důvod doporučení.

### AC-M-002
Given sponzorovaný výsledek  
Then je jasně označen jako placený  
And nesmí být vydáván za čistě organické doporučení.

### AC-M-003
Given profesionál má vypnuté přijímání leadů  
Then není doporučován jako aktivně dostupný.

## AC — Portfolio

### AC-P-001
Given nový projekt  
When uživatel přidá bloky  
Then lze měnit jejich pořadí.

### AC-P-002
Given uživatel upraví obrázek  
Then originál zůstává obnovitelný.

### AC-P-003
Given draft  
When není publikován  
Then není veřejně dostupný.

### AC-P-004
Given spoluautor není potvrzen  
Then nesmí být prezentován jako potvrzený člen projektu.

## AC — Messaging

### AC-MS-001
Given uživatel nemá oprávnění ke konverzaci  
Then obsah není dostupný.

### AC-MS-002
Given blokace uživatele  
Then blokovaný účet nemůže zahájit novou přímou konverzaci s blokujícím účtem.

### AC-MS-003
Given zpráva je nahlášena  
Then report obsahuje referenci na konkrétní zprávu bez nutnosti veřejného sdílení celé konverzace.

## AC — Notifications

### AC-N-001
Given uživatel vypne e-mail pro komentáře  
Then komentáře neodesílají e-mail  
And in-app notifikace se řídí zvláštním nastavením.

### AC-N-002
Given quiet hours  
Then neurgentní push/SMS respektují nastavené období.

## AC — Reviews

### AC-REV-001
Given uživatel nemá ověřenou interakci  
Then nemůže vytvořit standardní hodnocení spolupráce.

### AC-REV-002
Given profesionál reaguje na recenzi  
Then reakce je veřejně spojena s konkrétní recenzí.

### AC-REV-003
Given recenze je ve sporu  
Then její stav je auditovatelný.

## AC — Organizations

### AC-O-001
Given editor firmy  
Then nemůže změnit vlastníka firmy.

### AC-O-002
Given člen opustí firmu  
Then jeho osobní účet zůstává aktivní  
And firemní oprávnění jsou odebrána.

## AC — Privacy

### AC-PR-001
Given upload dokumentu do projektu  
Then uživatel musí znát jeho aktuální viditelnost.

### AC-PR-002
Given uživatel mění soukromý obsah na veřejný  
Then systém zobrazí explicitní potvrzení u citlivých dat.

## AC — Mobile

### AC-MOB-001
Guide je dokončitelný na mobilním viewportu bez nutnosti desktopu.

### AC-MOB-002
Uživatel může na mobilu reagovat na poptávku a odeslat přílohu.

## AC — Admin

### AC-A-001
Změna verifikačního stavu musí být auditovatelná.

### AC-A-002
Moderátor nesmí získat více oprávnění než potřebuje pro moderaci.

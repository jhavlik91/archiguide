# T042 — Služby — objednávka + rezervace konzultace

**Track:** J (služby) | **Závislosti:** T041, T030, T032 | **Stav:** draft

## Goal
Objednání produktizované služby klientem a rezervace konzultace s termínem — dokončení Package 10 request/booking flow. Viz `zadani/legacy-master-spec.md` §29, §19 (rezervovat konzultaci jako výstupní akce guide).

## Scope
- Model `ServiceOrder`: služba, klient, stav (`requested → confirmed → in_progress → delivered → completed`; `requested → declined`, `confirmed → cancelled_by_client | cancelled_by_provider`), dodané podklady (attachments T023), termín.
- Objednávka: klient vyplní požadované inputs služby → profesionál potvrdí/odmítne (s důvodem) → dodání outputs → klient potvrdí dokončení.
- Rezervace konzultace: služba s termínem — profesionál nabídne sloty / potvrdí navržený čas; změna termínu notifikuje obě strany (`booking change` policy z `zadani/11-notifications.md`).
- Automaticky založená konverzace k objednávce (T030 kontext).
- Storno dle podmínek služby (T041) — stav + důvod, viditelné oběma stranám.
- Dokončená objednávka = ověřená interakce pro recenzi (rozšíření eligibility T037).
- Notifikace všech přechodů (T032); upomínka blížící se konzultace.

## Klíčová pravidla
Platba mimo platformu v první iteraci (cena je informativní) — platební integrace až T059; stav objednávky vždy viditelný oběma stranám; nikdy nezrušit termín bez notifikace.

## Akceptační náčrt
Happy path objednávka → potvrzení → dodání → dokončení → nabídka recenze; odmítnutí s důvodem; storno respektuje podmínky; změna termínu notifikuje; konverzace navázaná na objednávku.

## Out of scope
Online platby a transaction fees (T059), kalendářové integrace (ICS/Google), video hovory.

# T069 — Messaging — ochrana kontaktů dle fáze interakce

**Track:** P (platforma) | **Závislosti:** T031, T058 | **Stav:** draft

## Goal
Business pravidla pro skrývání přímých kontaktních údajů do určité fáze interakce — ochrana marketplace hodnoty bez poškození legitimní komunikace. Viz `zadani/legacy-master-spec.md` §27.3.

## Scope
- Konfigurovatelná pravidla per kontext: v jaké fázi interakce se odhalují přímé kontakty (např. telefon klienta až po přijetí reakce / odemčení leadu T060); vazba na entitlements (T058) a lead access (T060).
- Detekce kontaktů ve zprávách (rozšíření hintu z T031): dle pravidel buď jen upozornit (default), nebo maskovat s vysvětlením proč a kdy se odhalí.
- Odhalení kontaktu = explicitní akce vlastníka kontaktu („sdílet telefon") — vždy dostupná; platforma nikdy nedrží kontakty jako rukojmí proti vůli obou stran.
- Transparentní komunikace pravidel oběma stranám (žádné tiché mazání obsahu zpráv).

## Klíčová pravidla
§27.3 doslova: platforma **nesmí bránit legitimní komunikaci způsobem, který uživatele poškozuje** — maskování je nastavitelné business pravidlo s jasným vysvětlením, ne cenzura; privátní data klienta (T025 anonymizace) mají přednost před monetizační logikou; urgentní/bezpečnostní situace pravidla obcházejí.

## Akceptační náčrt
Kontakt maskován jen dle aktivního pravidla s vysvětlením; vlastník kontaktu ho může vždy vědomě sdílet; po dosažení fáze (accepted/unlock) se komunikace uvolní; audit konfigurace pravidel; žádná tichá modifikace zpráv bez indikace.

## Out of scope
Messaging core/přílohy (T030/T031), lead unlock mechanika (T060), právní vymáhání obcházení platformy.

# Screen States

Každá významná obrazovka musí definovat minimálně:

## 1. Loading
- skeleton nebo jasný indikátor,
- žádné blikání soukromých dat,
- možnost retry při dlouhém čekání.

## 2. Empty
Příklad inbox:
> Zatím nemáte žádné konverzace.

Příklad portfolio:
> Zatím nemáte žádný projekt. Přidejte první realizaci nebo case study.

## 3. Error
Musí obsahovat:
- co se nepodařilo,
- zda lze retry,
- zda jsou data uložená,
- bezpečný další krok.

## 4. Partial error
Např. profil se načte, ale reviews ne.
Nesmí spadnout celá obrazovka.

## 5. Permission denied
Musí vysvětlit:
- že obsah existuje, pokud to není citlivé,
- proč není dostupný,
- případně jak získat přístup.

## 6. Deleted
Obsah byl odstraněn.

## 7. Archived
Obsah je archivovaný, ale dostupný oprávněným osobám.

## 8. Offline / unstable connection
U editací:
- zobrazit neuložené změny,
- nehlásit falešné uložení.

## 9. Draft
Jasně odlišit od publikovaného stavu.

## 10. Moderation pending
Obsah čeká na kontrolu.

## Povinné stavy dle modulu

### Guide
- new,
- in progress,
- resumed,
- conflict detected,
- safety warning,
- completed,
- abandoned.

### Request
- draft,
- active,
- paused,
- awarded,
- closed,
- cancelled,
- expired.

### Portfolio
- draft,
- scheduled/pending publication pokud podporováno,
- published,
- unpublished,
- archived,
- moderation restricted.

### Messaging
- empty,
- unread,
- blocked,
- reported,
- participant removed.

### Verification
- not started,
- in progress,
- pending review,
- verified,
- rejected,
- expired,
- revoked.

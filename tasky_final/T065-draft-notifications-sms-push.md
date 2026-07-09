# T065 — Notifikace — SMS + push

**Track:** P (platforma) | **Závislosti:** T033 | **Stav:** draft

## Goal
Zbývající notifikační kanály: SMS (úzce vymezené případy) a web push. Public launch kritérium „notification preferences" kompletní. Viz `zadani/11-notifications.md`, `zadani/legacy-master-spec.md` §28.3.

## Scope
- SMS kanál (provider např. Twilio): **jen** urgentní události, potvrzení/změna rezervace (T042), blížící se termín, kritická obchodní událost (§28.3); vyžaduje ověřený telefon (T011) + explicitní opt-in per kategorie.
- Web push (service worker + Push API): opt-in prompt v rozumný moment (ne při prvním načtení), kanál C dle default policy tabulky.
- Rozšíření preference UI (T033) o sloupce SMS/push; dispatcher (T032) rozšířen o nové kanály — deduplikace napříč kanály (push doručený ≠ ještě SMS).
- Doručenkové stavy per kanál; fallback řetězec pro urgentní (in-app → push → e-mail).

## Klíčová pravidla
**SMS nikdy pro marketing defaultně**; urgent ≠ automaticky SMS bez opt-in, kromě právně nutných servisních případů (`zadani/11-notifications.md` pravidla); push obsah bez citlivých dat (lock screen!); odhlášení kanálu okamžité.

## Akceptační náčrt
SMS jen s ověřeným číslem a opt-in; marketing přes SMS nemožný ani konfigurací; push notifikace bez citlivého obsahu; dedup napříč kanály; preference respektované dispatcherem (testy).

## Out of scope
Nativní mobilní aplikace (web push stačí), e-mail/digest (T033), notifikační obsah domén (emitují existující tasky).

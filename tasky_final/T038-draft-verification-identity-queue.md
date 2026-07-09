# T038 — Verifikace — identita + verifikační fronta

**Track:** I (trust+) | **Závislosti:** T011, T035 | **Stav:** draft

## Goal
Ověření identity uživatele s manuální review a obecná verifikační fronta v adminu — infrastruktura pro všechny pokročilé typy verifikací (T039). Public launch bloker (`zadani/15-release-roadmap.md`). Viz `zadani/12-moderation-trust-safety.md` §2, `zadani/08-workflows-state-machines.md` §7.

## Scope
- Model `Verification` zobecněný z T011: subject (user/organizace), type, status, issued/expiry, review notes, rozsah; doklady přes attachment systém (T023) se sensitivity flagem, přístupné jen verifikačnímu týmu.
- Stavový automat: `not_started → in_progress → pending_review → verified`; `pending_review → rejected → in_progress`, `verified → expired | revoked`.
- Flow identity: uživatel nahraje doklad → fronta → moderátor/admin schválí či zamítne s důvodem.
- Verifikační fronta v `(admin)/`: výpis pending žádostí, detail s doklady, akce approve/reject/revoke, audit.
- Notifikace `verification_pending/approved/rejected/expiring` (typy už existují z T032).
- Badge na profilu: přesně „Identita ověřena" — badge policy `zadani/12-moderation-trust-safety.md` §3.

## Klíčová pravidla
Doklady totožnosti = nejcitlivější data na platformě: šifrované úložiště, přístup jen verifikační role, retence (smazání dokladů po rozhodnutí, uchová se jen výsledek). Badge nikdy neagreguje („Verified Professional" zakázáno).

## Akceptační náčrt
Stavový automat testy; doklad nedostupný nikomu mimo verifikační roli; zamítnutí s důvodem umožní opakování; expirace odebere badge; audit každého rozhodnutí.

## Out of scope
Automatická verifikace (OCR, bankID — možná navazující task), typy business/kvalifikace/autorizace/pojištění (T039).

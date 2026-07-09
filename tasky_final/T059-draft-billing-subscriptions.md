# T059 — Billing + subscription lifecycle

**Track:** N (monetizace) | **Závislosti:** T058 | **Stav:** draft

## Goal
Platební integrace (Stripe) a životní cyklus předplatného: checkout, obnova, upgrade/downgrade, selhání platby, zrušení. Viz `zadani/13-monetization.md`, metriky Revenue (`zadani/14-metrics-analytics.md`).

## Scope
- Stripe Checkout + customer portal; webhooky (route handler) → synchronizace stavu `Subscription` (T058): `active → past_due → cancelled`, trial volitelně.
- Upgrade okamžitý (proration), downgrade ke konci období s aplikací pravidel T058 (read-only označení, žádné mazání).
- Selhání platby: grace period s notifikacemi, pak downgrade na Free pravidly T058 — nikdy okamžitá ztráta obsahu.
- Faktury/účtenky přes Stripe; fakturační údaje subjektu (osoba/organizace, DIČ).
- Transaction fees infrastruktura pro služby (T042): platba za objednávku přes platformu s provizí (§4) — druhá iterace tasku, možno vyčlenit.
- Admin: přehled plateb, refundy (edge cases `zadani/09-edge-cases.md` — Monetization: refund, chargeback, změna ceny plánu — existující předplatitelé grandfathering).
- Eventy: `checkout_started`, `subscription_started/upgraded/downgraded`, `transaction_completed`.

## Klíčová pravidla
Zdroj pravdy o zaplacení = webhooky (ne redirect); žádná citlivá karetní data na platformě; cena viditelná před každým checkoutem; chargeback nesmaže obsah, jen omezí plán.

## Akceptační náčrt
Checkout → aktivní plán → entitlements se projeví; webhook idempotence; selhání platby → grace → Free bez ztráty dat; refund admin flow s auditem; downgrade proces dle T058.

## Out of scope
Definice plánů (T058), lead unlock platby (T060), sponsored self-serve (T061), více měn/daňová automatizace v první iteraci.

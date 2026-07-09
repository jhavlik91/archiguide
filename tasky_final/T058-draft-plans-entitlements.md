# T058 — Plány + entitlements engine

**Track:** N (monetizace) | **Závislosti:** T004 | **Stav:** draft

## Goal
Definice plánů (Free/Pro/Studio/Business/Enterprise) a entitlements vrstva, přes kterou features zjišťují limity — bez plateb (T059). Viz `zadani/13-monetization.md` §2, §9–10, `zadani/legacy-master-spec.md` §47.1.

## Scope
- Model `Subscription` dle `zadani/10-domain-entities.md`: subject (profil/organizace), plan, status, entitlements; plány jako data (ne hardcode) s přesnými limity: počet portfolio projektů, členů, aktivních služeb, lead unlocks, analytika, priority support, branding (§9).
- Entitlements API `lib/entitlements.ts`: `can(subject, feature)`, `limit(subject, resource)`, `usage(subject, resource)` — jediný vstupní bod, konzumují T012 (počet projektů), T041 (počet služeb), T060 (lead kvóty), T009 (členové)…
- Free plán = default pro každého (základní profil, omezené portfolio, základní messaging).
- **Downgrade pravidla (§10):** obsah nad limit se nemaže — označí se read-only s jasným vysvětlením a možností exportu/úpravy výběru, co zůstane aktivní.
- UI: stránka plánů s jasnými cenami a limity (`plan_viewed` metrika); stav „využíváte X z Y" v dashboardu.
- Admin: přiřazení plánu ručně (než existuje billing T059), přehled subscriptions (permission matice — správa monetizace: jen Admin).

## Klíčová pravidla
Jasné ceny, jasné limity, žádné skryté poplatky (§1); enforcement na serveru (entitlements vrstva), ne jen v UI; downgrade nikdy nesmaže obsah automaticky.

## Akceptační náčrt
Free profil narazí na limit portfolia se srozumitelnou hláškou a CTA; downgrade označí přebytek read-only, nic nesmaže; entitlements testy per plán; admin změní plán s auditem.

## Out of scope
Platby a checkout (T059), lead fees (T060), sponsored (T061), B2C premium (T062), supplier plány (T063).

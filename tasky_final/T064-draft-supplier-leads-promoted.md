# T064 — Supplier — lead capture + promoted products

**Track:** O (supplier) | **Závislosti:** T063, T061 | **Stav:** draft

## Goal
B2B lead generation pro dodavatele: poptávka produktu/vzorku/konzultace z detailu produktu, promoted products, supplier analytika. Viz `zadani/legacy-master-spec.md` §4.6, §47.7, `zadani/13-monetization.md` §7.

## Scope
- Lead capture: CTA na detailu produktu („poptat produkt", „vyžádat vzorek/technickou konzultaci") → strukturovaný lead (kontakt jen se souhlasem odesílatele, kontext projektu volitelně) → supplier inbox + konverzace (T030).
- Lead management pro suppliera: stavy leadu (`new → contacted → qualified → closed`), pipeline přehled.
- Promoted product: placené zvýraznění v katalogu/feedu přes placement infrastrukturu (T061) — vždy označené.
- Supplier analytika (dle plánu T058): zobrazení produktů, leady, konverze — agregovaně, žádné sledování identity návštěvníků bez souhlasu.
- Monetizace: profile subscription / catalogs / lead generation / promoted product / analytics (§7) — entitlements z T058.

## Klíčová pravidla
Lead vzniká jen vědomou akcí uživatele (žádný prodej kontaktů z prohlížení); promoted vždy transparentní (T061 pravidla); analytika bez PII (`zadani/14-metrics-analytics.md` pravidla).

## Akceptační náčrt
Poptávka produktu → lead u suppliera s konverzací; kontakt odesílatele jen s jeho souhlasem; promoted product označen; analytika jen agregovaná; entitlements limity dle plánu.

## Out of scope
Katalogy (T063), placement engine (T061), e-commerce transakce, integrace na CRM dodavatelů.

# T060 — Lead monetizace

**Track:** N (monetizace) | **Závislosti:** T059, T027 | **Stav:** draft

## Goal
Monetizace přístupu k poptávkám: unlock fee / kredity / kvóty v plánu, omezený počet kupujících, refund pravidla. Viz `zadani/13-monetization.md` §3, `zadani/legacy-master-spec.md` §47.3, `zadani/10-domain-entities.md` — LeadAccess.

## Scope
- Model `LeadAccess`: professional, request, access type (`included_quota` | `unlocked_fee` | `credit` | `exclusive`), status.
- Business pravidla per typ poptávky: co je zdarma (zobrazení anonymizované poptávky zůstává veřejné — T026), co je zpoplatněno (plný kontakt/reakce nad kvótu plánu); konfigurace, ne hardcode.
- **Cena známá před odemčením** (§3); kvóty z entitlements (T058): „X reakcí měsíčně v plánu"; kredity dokupitelné (T059).
- Omezený počet kupujících per lead (např. max 5) — počítadlo viditelné („odemklo 3/5 profesionálů"); exclusive lead = jediný kupující, transparentně dražší.
- Refund nevalidního leadu (mrtvá poptávka, spam, fake) — žádost + admin posouzení + kredit zpět; lead koupen vícekrát omylem → idempotence (`zadani/09-edge-cases.md` — Monetization).
- Guardrail: klientova poptávka nesmí být poškozena monetizací (reakce od profesionálů s kvótou zdarma vs. placené — stejná viditelnost pro klienta).

## Klíčová pravidla
Anonymizace (T025) platí i pro odemčené leady — unlock odemyká interakci, ne soukromá data klienta bez jeho akce; matching pořadí (T028) nikdy neovlivněno tím, kdo platí; transparentní ceny.

## Akceptační náčrt
Profesionál vidí cenu před odemčením; kvóta plánu se čerpá viditelně; limit kupujících enforcován; refund flow s auditem; odemčení neodhalí privátní pole poptávky.

## Out of scope
Plány/kvóty definice (T058), platební mechanika (T059), sponsored placement (T061), dynamické ceny leadů.

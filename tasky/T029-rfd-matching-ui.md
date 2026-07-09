# T029 — Matching UI

**Track:** F (marketplace) | **Závislosti:** T028 | **Assignee:** —

## Goal
Uživatelské rozhraní doporučených profesionálů pro vlastníka poptávky: kandidátní seznam s důvody, shortlist, dismiss, oslovení. Viz `zadani/legacy-master-spec.md` §21, `zadani/15-release-roadmap.md` Package 6.

## User roles
Vlastník poptávky (B2C/B2B klient).

## Preconditions
T028 done.

## Main flow
1. Sekce „Doporučení profesionálové" na detailu vlastní poptávky: karty kandidátů (jméno, profese, region, náhled portfolia, verifikační badge z T011).
2. Každá karta zobrazuje **lidsky čitelný důvod doporučení** složený ze strukturovaných reasons (T028) — např. „Doporučeno, protože studio realizovalo 8 rekonstrukcí bytů podobné velikosti a působí ve vašem regionu."
3. Akce na kartě: shortlist (uložit do užšího výběru), dismiss (skrýt s volitelným důvodem), zobrazit profil (T008), oslovit — u veřejné poptávky odkaz na pozvání k reakci, u neveřejné vytvoření `RequestInvite` (T025).
4. Záložky: doporučení / shortlist / skrytí (dismiss je vratný).
5. Sponzorovaná pozice: UI komponenta má slot pro `sponsorship flag` s viditelným označením „Sponzorováno" — v MVP se nezobrazuje (flag vždy false), ale komponenta s ním počítá (`zadani/16-ai-team-execution-rules.md` §11 — žádný skrytý paid ranking).
6. Prázdný stav: poctivé vysvětlení z enginu (žádní profesionálové dané profese v regionu) + doporučení: rozšířit region, upravit profese (`zadani/07-screen-states.md`).

## Alternative flows
Kandidát mezitím deaktivoval profil → karta zmizí; dismiss všech → prázdný stav s možností obnovit skryté.

## Validation
Akce validují vlastnictví poptávky a existenci doporučení.

## Permissions
Vše jen vlastník poptávky; doporučení nejsou veřejná ani viditelná kandidátům.

## States
Recommendation `shown → shortlisted | dismissed` (přechody přes engine API T028).

## Edge cases
Mobil: karty pod sebou, důvod doporučení nezkrácený do nesrozumitelnosti; kandidát s omezenou dostupností → důvod to uvádí, karta není skrytá (`zadani/09-edge-cases.md` — Matching); pozvání téhož kandidáta dvakrát → idempotentní.

## Analytics
Eventy: `match_shown`, `match_shortlisted`, `match_dismissed`, `match_profile_viewed`, `match_invited`.

## Acceptance criteria
- [ ] E2E: publikovaná poptávka → seznam doporučení s důvody → shortlist → pozvání kandidáta.
- [ ] Každá karta zobrazuje důvod doporučení; nikde se nezobrazuje procentní skóre.
- [ ] Dismiss skryje kandidáta a lze jej vrátit.
- [ ] Prázdný výsledek zobrazí vysvětlení a doporučené kroky, ne prázdnou stránku.
- [ ] Komponenta karty umí vykreslit označení „Sponzorováno" (Storybook stav).

## Out of scope
Engine a skórování (T028), messaging s kandidátem (T030), notifikace kandidátům (T032/T033), placené pozice (finální produkt).

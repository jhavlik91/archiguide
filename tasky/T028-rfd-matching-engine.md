# T028 — Matching engine

**Track:** F (marketplace) | **Závislosti:** T024, T007 | **Assignee:** —

## Goal
Server-side matching poptávka ↔ profesionálové: kandidátní seznam se skóre a **vysvětlitelnými důvody**. Žádná falešná přesnost. Viz `zadani/legacy-master-spec.md` §21, `zadani/16-ai-team-execution-rules.md` §5.

## User roles
N/A (engine); konzumuje T029 (UI) a T033 (digest — slot).

## Preconditions
T024, T007 done.

## Main flow
1. Model `MatchRecommendation` dle `zadani/10-domain-entities.md`: target (request), candidate (profil/organizace), **reasons** (strukturovaný seznam), status (`new → shown → shortlisted | dismissed`), sponsorship flag (v MVP vždy false, pole existuje).
2. Skórovací kritéria (§21): shoda profese (tvrdá podmínka), specializace, lokalita/service area vs. region poptávky, typ projektu vs. portfolio, rozsah/rozpočet vs. pricing model, dostupnost, úroveň verifikace, hodnocení (slot T037). Váhy v konfiguraci, ne hardcode.
3. **Každé doporučení nese strojově čitelné důvody** (`{ type: "profession_match" | "region" | "similar_projects", detail }`), ze kterých UI složí lidskou větu typu „realizoval 8 rekonstrukcí bytů v regionu". Doporučení bez alespoň jednoho důvodu nevznikne.
4. Skóre je interní pro řazení — **nikdy se nevystavuje jako procento** (§5: žádné „97,4 %" bez opory).
5. Trigger: publikace poptávky (T024) → výpočet kandidátů; přepočet při významné změně poptávky.
6. API: `getRecommendations(request)`, `recomputeMatches(request)`, `updateStatus(recommendation, status)`.

## Alternative flows
Žádný vhodný kandidát → prázdný výsledek s explicitním důvodem (žádní profesionálové dané profese v regionu) — UI z toho udělá poctivý empty state; příliš mnoho rovnocenných → stabilní řazení (sekundárně dle kompletnosti profilu, ne náhodně při každém načtení).

## Validation
Kandidát musí mít publikovaný profil a aktivní příjem poptávek (accepting leads flag z T007).

## Permissions
Doporučení k poptávce čte jen vlastník poptávky + admin. Profesionál nevidí, že byl doporučen (to řeší až notifikace `recommended_request` — slot).

## States
Recommendation: `new → shown → shortlisted | dismissed`.

## Edge cases
Skvělé portfolio, nulová dostupnost → doporučit lze, důvod uvádí omezenou dostupnost (`zadani/09-edge-cases.md` — Matching); nový profesionál bez recenzí → nesmí být systémově pohřben (kritéria bez review dat se převáží, ne vynulují); konflikt zájmů (kandidát = vlastník poptávky / člen jeho organizace) → vyloučen; deaktivovaný profil → doporučení staženo.

## Analytics
Eventy: `match_computed`, `match_dismissed`, `match_shortlisted`.

## Acceptance criteria
- [ ] Unit testy: profese je tvrdá podmínka; region a specializace zvyšují skóre; konflikt zájmů vyloučen.
- [ ] Každé doporučení má ≥1 strukturovaný důvod.
- [ ] Žádné API nevrací skóre jako procento přesnosti.
- [ ] Prázdný výsledek vrací důvod, ne jen [].
- [ ] Nový profesionál bez recenzí se v kandidátech objevuje.

## Out of scope
UI (T029), notifikace profesionálům, sponzorované pozice (monetizace — finální produkt), ML/embeddings (MVP = deterministická pravidla).

# T027 — Reakce profesionála na poptávku

**Track:** F (marketplace) | **Závislosti:** T026, T007 | **Assignee:** —

## Goal
Reakce profesionála na poptávku (zájem, otázka, nabídka) a její životní cyklus na obou stranách — shortlist, přijetí, odmítnutí. Uzavírá request-response smyčku. Viz `zadani/legacy-master-spec.md` §20.4, `zadani/08-workflows-state-machines.md` §4.

## User roles
Profesionál / firma (autor reakce, dle `zadani/05-permission-matrix.md` — reagovat na poptávku); vlastník poptávky (přijímá, shortlistuje, odmítá).

## Preconditions
T026, T007 done. Profesionál má profil, poptávka je `active` (nebo pozvaná neveřejná).

## Main flow
1. Model `RequestResponse` dle `zadani/10-domain-entities.md`: professional (profil/organizace), request, message, price model, availability/orientační termín, relevant portfolio items (FK na portfolio projekty, jen `published`), status.
2. Formulář reakce z detailu poptávky (§20.4): zpráva, cenový model (hodinová/fixní/„po konzultaci"), orientační termín, volitelně přiložené relevantní portfolio projekty.
3. Stavový automat: `draft → sent → viewed → shortlisted → accepted`; `sent → withdrawn`, `viewed → rejected`, `shortlisted → rejected | withdrawn`. `viewed` se nastavuje automaticky při prvním zobrazení vlastníkem.
4. Jedna reakce per profesionál per poptávka (editovatelná dokud `sent`, pak jen withdraw).
5. Vlastník: seznam reakcí na své poptávce (karta: profesionál, zpráva, cena, portfolio odkazy), akce shortlist / odmítnout / přijmout. Přijetí reakce → poptávka `in_discussion`/`awarded` dle volby (napojení na T024 přechody).
6. Odmítnutí: volitelný důvod, profesionál vidí stav své reakce (bez detailního zdůvodnění, pokud ho vlastník neuvede).
7. Profesionál: dashboard „moje reakce" se stavy.

## Alternative flows
Poptávka `paused`/`cancelled` po odeslání reakce → reakce zůstává, stav poptávky viditelný; withdraw po shortlistu → vlastník notifikován (T032 slot); accepted → CTA otevřít konverzaci (T030 slot).

## Validation
Zod: zpráva povinná, portfolio items musí patřit autorovi a být published; reakce jen na `active` poptávku (nebo pozvanou).

## Permissions
Reagovat smí jen role s oprávněním (profesionál Y, ostatní C dle matice); reakci čte autor + vlastník poptávky; stavy mění: autor (withdraw), vlastník (viewed/shortlist/reject/accept).

## States
Viz Main flow 3. Neplatné přechody server odmítne; auditní záznam accept/reject.

## Edge cases
Reakce těsně po pause → srozumitelné odmítnutí (`zadani/09-edge-cases.md` — Request); klient přijme více nabídek → povoleno (víc profesí na projektu), každá reakce má vlastní stav; profesionál smaže profil s aktivní reakcí → reakce `withdrawn`; spam reakce → nahlásitelná (T036 slot).

## Analytics
Eventy: `response_sent`, `response_viewed`, `response_shortlisted`, `response_accepted`, `response_rejected` (viz `zadani/14-metrics-analytics.md`).

## Acceptance criteria
- [ ] E2E: profesionál reaguje → vlastník vidí reakci (stav `viewed`) → shortlist → accept → poptávka `in_discussion`.
- [ ] Unit testy stavového automatu reakce včetně neplatných přechodů.
- [ ] Druhá reakce téhož profesionála na tutéž poptávku je odmítnuta.
- [ ] Reakce na `paused` poptávku se nezaloží a uživatel dostane vysvětlení.
- [ ] Přiložit lze jen vlastní published portfolio projekty.

## Out of scope
Messaging (T030), notifikace (T032/T033), matching (T028), hodnocení po spolupráci (T037), lead fees/monetizace.

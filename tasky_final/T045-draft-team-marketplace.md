# T045 — Team marketplace — poptávka profesionála profesionálem

**Track:** K (jobs/team/kapacita) | **Závislosti:** T024, T007 | **Stav:** draft

## Goal
B2B sourcing: profesionál/firma hledá jiného profesionála („hledám statika", „hledám subdodavatele elektro"). Viz `zadani/legacy-master-spec.md` §31, §43 (use case architekt hledá statika), `zadani/10-domain-entities.md` — TeamRequest.

## Scope
- **Rozhodnuto: žádná samostatná entita.** Team request je nový typ nad Request infrastrukturou z T024 (`type: b2b_team | subcontract`) — reuse stavového automatu, auditu i dashboardů. Atributy `TeamRequest` z `zadani/10-domain-entities.md` se mapují na Request + rozšiřující pole: owner (profil/organizace), projektový kontext (volitelný, může být důvěrný), hledaná profese/specializace, confidentiality.
- Viditelnost: veřejná / neveřejná / **jen pro ověřené** (§31) — třetí režim rozšiřuje T025 (podmínka verifikace T038/T039).
- Reakce profesionála — reuse RequestResponse flow (T027) včetně relevantních portfolio projektů.
- Matching (T028) aplikovaný na team requesty — kandidáti dle profese/specializace/regionu, s důvody.
- Confidentiality: důvěrný projektový kontext se odhalí až po shortlistu/NDA kroku — do té doby jen anonymní popis.

## Klíčová pravidla
Bez guide — team request vzniká přímo (guide je B2C cesta); confidentiality flag respektován v každé projekci; „jen pro ověřené" vyžaduje jasně komunikovaný typ verifikace.

## Akceptační náčrt
Architekt založí poptávku na statika → statik ji vidí ve výpisu/matchingu → reaguje → shortlist → konverzace; režim „jen pro ověřené" skryje poptávku neověřeným; důvěrný kontext neviditelný před shortlistem.

## Out of scope
Pracovní nabídky (T043), kapacitní nabídky (T046), projektový workspace po navázání (T047), NDA dokumenty.

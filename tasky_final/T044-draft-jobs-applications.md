# T044 — Jobs — application flow

**Track:** K (jobs/team/kapacita) | **Závislosti:** T043, T030 | **Stav:** draft

## Goal
Reakce profesionála na pracovní nabídku a správa uchazečů na straně firmy. Viz `zadani/legacy-master-spec.md` §30, `zadani/09-edge-cases.md` — Jobs.

## Scope
- Model `JobApplication`: uchazeč (profil), nabídka, průvodní zpráva, odkaz na profil/portfolio, stav (`sent → viewed → shortlisted → accepted | rejected`; `sent → withdrawn`) — obdoba automatu reakce z T027.
- Apply z detailu nabídky; jedna aktivní přihláška per uchazeč per nabídka.
- Externí apply flow: nabídka může mít externí URL — pak platforma jen přesměruje a apply se netrackuje (edge case dle zadání).
- Recruiter pohled: seznam uchazečů per nabídka, stavy, otevření konverzace (T030 kontext).
- Notifikace `application_update` uchazeči při změně stavu (typ z `zadani/11-notifications.md`).
- Uzavření nabídky (role obsazena) → otevřené přihlášky notifikovány, stav jasně komunikován.

## Klíčová pravidla
Uchazeč vždy vidí stav své přihlášky; přihláška po expiraci/obsazení nejde odeslat se srozumitelným vysvětlením; data uchazečů vidí jen firemní role s náborovým oprávněním (Recruiter/Admin/Owner).

## Akceptační náčrt
Happy path apply → viewed → shortlist → konverzace → accepted; withdraw funguje; expirovaná nabídka odmítne apply; externí apply přesměruje bez založení záznamu; cizí firma přihlášky nevidí.

## Out of scope
ATS funkce (poznámky, hodnocení kandidátů), CV parsing, recruiter plán a monetizace (T058/T061).

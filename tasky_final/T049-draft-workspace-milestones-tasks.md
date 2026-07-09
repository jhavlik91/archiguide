# T049 — Workspace — milníky + úkoly

**Track:** L (workspace) | **Závislosti:** T047 | **Stav:** draft

## Goal
Milníky a úkoly v projektové místnosti + timeline projektu. Viz `zadani/legacy-master-spec.md` §34, `zadani/10-domain-entities.md` — Milestone.

## Scope
- Model `Milestone`: workspace, title, due date, status (`planned → in_progress → completed`; `→ cancelled`); model `WorkspaceTask`: title, popis, assignee (člen), due date, stav (`open → in_progress → done`), volitelná vazba na milník.
- Timeline pohled: milníky a úkoly chronologicky, aktuální stav projektu čitelný na první pohled.
- Notifikace `milestone_due` (blížící se termín — typ z `zadani/11-notifications.md`), přiřazení úkolu.
- Oprávnění: milníky spravuje Owner/Lead; úkoly vytváří kdokoli kromě Viewer, uzavírá assignee nebo Owner/Lead.
- Posun termínu milníku → viditelná historie změn (klient musí vidět, že se termín posunul, a kdy).

## Klíčová pravidla
Žádný projektový management moloch — jednoduchý seznam s termíny; stav nikdy odvozený jen z textu (`zadani/08-workflows-state-machines.md` — pravidla); změny termínů auditované.

## Akceptační náčrt
Milník s termínem → notifikace před termínem; úkol přiřazen členovi → notifikace; Viewer nemůže měnit; posun termínu zanechá stopu; dokončení všech milníků nabídne přechod projektu na `completed`.

## Out of scope
Ganttovy grafy, závislosti mezi úkoly, time tracking, opakované úkoly.

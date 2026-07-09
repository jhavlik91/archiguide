# T047 — Projektová místnost — core

**Track:** L (workspace) | **Závislosti:** T024, T030 | **Stav:** draft

## Goal
Soukromý workspace vzniklý po navázání spolupráce: členové, role, stavový model projektu. Základ Package 12. Viz `zadani/legacy-master-spec.md` §34, `zadani/08-workflows-state-machines.md` §8, `zadani/05-permission-matrix.md` — projektová místnost.

## Scope
- Model `ProjectWorkspace`: projekt (vazba na Request/awarded spolupráci nebo samostatně), members, role (Project owner, Client, Lead professional, Professional, Contractor, Viewer), stav.
- Stavový automat: `idea → planning → sourcing → active → completed → archived`; `active → paused → active`, `planning|sourcing → cancelled`.
- Vznik: z awarded poptávky (owner = klient, přijatý profesionál pozván) nebo ručně.
- Správa členů: pozvat (i e-mailem mimo platformu → onboarding), odebrat, změnit roli; pozvánkový automat `created → sent → accepted | declined | expired | revoked` (`zadani/08-workflows-state-machines.md` §10).
- Permission vrstva per workspace role — rozšíření `lib/permissions.ts` o workspace kontext; least privilege (Viewer jen čte).
- Přehledová stránka workspace: stav, členové, sloty pro moduly (soubory T048, milníky T049, schvalování T050, chat T051).

## Klíčová pravidla
Workspace je **soukromý** — žádný veřejný přístup; odebraný člen ztrácí přístup okamžitě, ale jeho příspěvky zůstávají (`zadani/09-edge-cases.md` — Workspace); každý přechod stavu má oprávnění a audit.

## Akceptační náčrt
Awarded poptávka → workspace se členy; pozvánka e-mailem projde onboardingem; odebraný člen nedostane žádná data; stavový automat testy; Viewer nemůže nic měnit.

## Out of scope
Soubory (T048), milníky/úkoly (T049), schvalování (T050), chat (T051), veřejná prezentace týmu (T052).

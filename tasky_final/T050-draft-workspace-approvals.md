# T050 — Schvalování s verzemi

**Track:** L (workspace) | **Závislosti:** T048 | **Stav:** draft

## Goal
Profesionál odešle výstup (výkres, vizualizaci, dokument) ke schválení klientem; komentáře vázané na obrázek/PDF/verzi. Viz `zadani/legacy-master-spec.md` §35, `zadani/08-workflows-state-machines.md` §9, `zadani/10-domain-entities.md` — Approval.

## Scope
- Model `Approval`: workspace, artefakt + **konkrétní verze** (soubor z T048), requester, reviewers (členové), status.
- Stavový automat: `draft → submitted → in_review → approved`; `in_review → changes_requested → submitted`, `in_review → rejected`, `submitted → withdrawn`.
- Komentáře vázané na: obrázek (bod/oblast v obrázku), PDF (stránka), verzi jako celek (§35).
- Nová verze artefaktu po `changes_requested` → nové kolo, historie kol zachována; approval se vždy váže na konkrétní verzi — schválení staré verze nelze zaměnit za schválení nové (`zadani/09-edge-cases.md` — Workspace: approval na starší verzi).
- Notifikace `approval_requested`, `changes_requested`, `approval_completed` (typy z `zadani/11-notifications.md`).
- Souběh: dva reviewers současně → konzistentní výsledek (poslední rozhodující akce vyhrává s viditelnou historií, nebo vyžadovat všechny — rozhodnout při rozpracování).

## Klíčová pravidla
Schválení je závazný moment — auditní záznam (kdo, kdy, kterou verzi); nikdy tichá záměna verze pod schválením; reviewer musí vidět, co přesně schvaluje.

## Akceptační náčrt
Odeslání verze → klient komentuje bod v obrázku → changes_requested → nová verze → schválení; schválená verze nezměnitelná; historie kol kompletní; souběžné schválení konzistentní.

## Out of scope
Elektronický podpis, právní závaznost, CAD diff, schvalovací workflow s více úrovněmi.

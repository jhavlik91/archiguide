# Tasky

Jeden soubor = jeden atomický task pro jednoho agentického vývojáře. Formát vychází z handoff šablony v `zadani/16-ai-team-execution-rules.md`.

## Pojmenování

```
T<###>-<stav>-<slug>.md
```

- `###` — unikátní číslo, nikdy se nerecykluje.
- `<stav>`:
  - `rfd` — ready for development (lze začít, pokud jsou závislosti `done`),
  - `done` — hotovo, mergnuto v `main`.
- Změna stavu = přejmenování souboru (`git mv`).
- Rozpracovanost se značí vyplněním pole **Assignee** v souboru.

## Pravidla

1. Před začátkem ověř, že všechny tasky v poli **Závislosti** jsou `done`.
2. Pracuj jen ve scope tasku — co je v *Out of scope*, nedělej, i kdyby to „dávalo smysl“.
3. Dodržuj průřezová pravidla z `TECHNICKE-ZADANI.md` §4 a `zadani/16-ai-team-execution-rules.md`.
4. Definition of Done je v `TECHNICKE-ZADANI.md` §5.
5. Konflikty ve sdílených souborech (`schema.prisma`, `lib/`) řeš append-only — nikdy neměň cizí modely/funkce.

## Dependency graf

Viz `TECHNICKE-ZADANI.md` §5–6. Track A (T001–T006) je prerekvizita, pak lze tracky B–H vyvíjet paralelně.

## Post-MVP

Návrh rozpadu features finálního produktu (T038–T069) je ve složce `tasky_final/` ve stavu `draft`. Před vývojem se draft rozpracuje do plné handoff šablony, přejmenuje na `rfd` a přesune sem.

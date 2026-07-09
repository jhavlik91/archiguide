# T022 — Brief — editace, sdílení, export

**Track:** E (brief) | **Závislosti:** T021, T023 | **Assignee:** —

## Goal
Manuální úpravy vygenerovaného briefu, řízené sdílení (privátní odkaz) a export do dokumentu. Viz `zadani/legacy-master-spec.md` §19, `zadani/15-release-roadmap.md` Package 4.

## User roles
Vlastník briefu (B2C/B2B klient). Příjemce sdíleného odkazu (kdokoli s odkazem — jen čtení).

## Preconditions
T021, T023 done. Existuje brief ve stavu `draft`/`ready`.

## Main flow
1. Editor briefu: všechny sekce z §18 editovatelné formulářem (ne volný text celého briefu); autosave draftu, nikdy neztratit rozpracované změny (`zadani/16-ai-team-execution-rules.md` §8).
2. Přílohy briefu přes attachment systém (T023): každá příloha má explicitní viditelnost; citlivé dokumenty defaultně soukromé.
3. Sdílení: vygenerování privátního odkazu (token), odvolatelného; sdílená verze je snapshot stavu `shared`. Před prvním sdílením privacy kontrola — pokud text obsahuje vzor přesné adresy/telefonu/e-mailu, zobrazit explicitní varování (`zadani/12-moderation-trust-safety.md` §8), neblokovat.
4. Úprava po sdílení → stav `revised`, uživatel vidí, že sdílená verze je starší, a může znovu sdílet (`shared`), viz `zadani/08-workflows-state-machines.md` §2.
5. Export briefu do tisknutelného dokumentu (print-friendly HTML → PDF přes prohlížeč stačí pro MVP); export nikdy neobsahuje soukromá pole (přesná adresa, kontakty), pokud je uživatel explicitně nezahrne.
6. Archivace briefu (`draft → archived`).

## Alternative flows
Odvolání odkazu → sdílená stránka vrací „odkaz již není platný“; příjemce odkazu nevidí soukromé přílohy (jen ty s viditelností pro sdílení).

## Validation
Zod schémata per sekce (rozpočet číslo/rozsah, lokalita strukturovaná); server actions.

## Permissions
Editace/sdílení/export jen vlastník; čtení přes token bez přihlášení (read-only, bez indexace — `noindex`).

## States
`draft → ready → shared`, `shared → revised → shared`, `draft → archived`; neplatné přechody server odmítne.

## Edge cases
Brief se změní po rozeslání → příjemci vidí snapshot, vlastník vidí diff upozornění (`zadani/09-edge-cases.md` — Brief); přesná adresa vepsaná do textového pole → privacy varování při sdílení; různé přílohy pro různé příjemce → mimo MVP, ale viditelnost per příloha už existuje (T023); omylem zveřejněný dokument → odvolání odkazu + změna viditelnosti přílohy okamžitě účinná.

## Analytics
Eventy: `brief_edited`, `brief_shared`, `brief_exported`.

## Acceptance criteria
- [ ] E2E: editace sekce → autosave → sdílení odkazem → anonymní zobrazení read-only verze.
- [ ] Odvolaný odkaz přestane fungovat okamžitě.
- [ ] Sdílení briefu s přesnou adresou v textu zobrazí varování.
- [ ] Export neobsahuje soukromá pole bez explicitního zahrnutí.
- [ ] Úprava po sdílení přepne stav na `revised` a vlastník to vidí.

## Out of scope
Vytvoření poptávky z briefu (T024), oslovení profesionálů (T027/T029), verzování s plnou historií.

# Pravidla práce pro AI vývojový tým

## 1. Neimprovizovat produktový význam
Pokud feature není jasná:
- použij existující principy,
- nevymýšlej nový business model,
- nevytvářej skryté oprávnění.

## 2. Každý feature task musí obsahovat
- cíl,
- role,
- preconditions,
- happy path,
- alternate paths,
- validations,
- permissions,
- states,
- analytics,
- acceptance criteria.

## 3. Povinné kontrolní otázky
Před implementací:
- Co vidí návštěvník?
- Co vidí vlastník?
- Co vidí cizí uživatel?
- Co je defaultně soukromé?
- Co se stane při „nevím“?
- Co se stane při prázdném výsledku?
- Co se stane při chybě?
- Co se stane na mobilu?
- Co se stane po ztrátě oprávnění?

## 4. Guide pravidla
- žádné falešné odborné závěry,
- unknown je validní odpověď,
- dynamické větvení,
- vysvětlení důvodu doporučení,
- bezpečnostní warning při riziku.

## 5. Matching pravidla
- důvody doporučení,
- sponsored označení,
- žádná falešná přesnost typu 97,4 % bez opory.

## 6. Privacy
- exact address private by default,
- attachments explicit visibility,
- public conversion warning,
- least privilege.

## 7. Portfolio
- original media restorable,
- draft not public,
- coauthor confirmation,
- multi-profession blocks.

## 8. Error handling
Nikdy:
- falešně nehlásit save success,
- neztratit draft bez upozornění,
- nezobrazit interní chybu jako odborný závěr.

## 9. Delivery unit
Každý agent má implementovat malý uzavřený celek.

Příklad:
> Request visibility selector

Ne:
> Udělej celý marketplace.

## 10. Review gate
Každý balík projde:
- product review,
- permission review,
- privacy review,
- edge case review,
- acceptance review.

## 11. Zakázané zkratky
- hardcode jediné profese,
- předpoklad jedné firmy na uživatele,
- předpoklad jedné role,
- zveřejnění kontaktů defaultně,
- spojení draft a published stavu,
- skrytý paid ranking.

## 12. Agent handoff template

### Task
### Goal
### User roles
### Preconditions
### Inputs
### Main flow
### Alternative flows
### Validation
### Permissions
### States
### Edge cases
### Analytics
### Acceptance criteria
### Out of scope

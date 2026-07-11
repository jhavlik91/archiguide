# T009 — Organizace — CRUD + členové

**Track:** B (profily) | **Závislosti:** T004 | **Assignee:** —

## Goal
Firemní profil s více členy a interními rolemi. Viz `zadani/legacy-master-spec.md` §23, entita Organization v `zadani/10-domain-entities.md`.

## User roles
Professional (zakládá firmu), org role: owner, admin, editor, member (recruiter/sales až po MVP).

## Preconditions
Přihlášený uživatel s rolí professional nebo client (B2B).

## Inputs
Název, logo, popis, IČO (volitelně), sídlo, regiony působnosti, specializace.

## Main flow
1. Modely `Organization`, `OrganizationMember` (user × org × role). Jedna osoba může spravovat více firem.
2. Založení firmy → zakladatel = owner.
3. Pozvání člena e-mailem (token; existující účet se připojí, neexistující projde registrací a pak se připojí).
4. Správa rolí členů, odebrání člena.
5. Editace firemního profilu (owner/admin/editor).

## Alternative flows
- Pozvaný odmítne → pozvánka `declined`.
- Owner odchází → musí předat ownership, jinak nelze.

## Validation
Název povinný; min. 1 owner v každém okamžiku; pozvánka expiruje za 14 dní.

## Permissions
owner: vše; admin: členové + profil; editor: profil; member: čtení interních dat. Vynuceno přes `lib/permissions.ts`.

## States
Org: `active|archived`. Pozvánka: `pending|accepted|declined|expired`.

## Edge cases
Jedna osoba ve více firmách; duplicitní firemní profil (kontrola IČO — warning, ne blok); poslední owner nemůže odejít; pozvání e-mailu, který už je členem.

## Analytics
Eventy: `org.created`, `org.member_invited`, `org.member_joined`.

## Acceptance criteria
- [ ] E2E: založení firmy → pozvání člena → přijetí → změna role → odebrání.
- [ ] Poslední owner nemůže odejít ani být odebrán (unit + e2e).
- [ ] Permission matice členů pokryta unit testy.

## Out of scope
Veřejná stránka (T010), pobočky, claim existující firmy, firemní portfolio.

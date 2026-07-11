# T002 — DB základ + User model

**Track:** A (foundation) | **Závislosti:** T001 | **Assignee:** —

## Goal
Zprovoznit PostgreSQL + Prisma a založit core `User` model, na který se navěsí všechny domény.

## User roles
N/A (infrastruktura).

## Preconditions
T001 done.

## Main flow
1. Prisma + PostgreSQL (docker-compose pro lokální dev), `lib/db.ts` singleton klient.
2. `schema.prisma` členěné komentářovými sekcemi per doména (konvence pro další tasky).
3. Model `User` dle `zadani/10-domain-entities.md`: identity (email), status (`active|deactivated|deleted`), locale, contact preferences, notification preferences (JSON), timestamps.
4. Seed skript infrastruktura (`prisma/seed/`).
5. CI: migrace se aplikují na testovací DB v pipeline.

## Validation
E-mail unikátní, case-insensitive.

## States
`User.status`: `active` → `deactivated` → `active`; `deleted` je terminální.

## Permissions / Analytics
N/A (řeší T004).

## Edge cases
Duplicitní registrace stejného e-mailu s jinou velikostí písmen.

## Acceptance criteria
- [ ] `docker compose up` + `prisma migrate dev` vytvoří DB.
- [ ] `prisma db seed` proběhne (byť zatím prázdný seed).
- [ ] Unit test ověří unikátnost e-mailu.
- [ ] CI běží migrace proti služební Postgres instanci.

## Out of scope
Auth flow (T003), role (T004), jakékoli doménové modely.

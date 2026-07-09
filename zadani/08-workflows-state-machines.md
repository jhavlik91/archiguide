# Workflows a stavové modely

## 1. Guide

`new -> in_progress -> completed`

Alternativně:
- `in_progress -> abandoned`
- `in_progress -> safety_warning -> in_progress`
- `in_progress -> conflict_detected -> resolved -> in_progress`

## 2. Brief

`draft -> ready -> shared`

Možné:
- `shared -> revised`
- `revised -> shared`
- `draft -> archived`

## 3. Request

`draft -> active -> in_discussion -> awarded -> closed`

Alternativy:
- `active -> paused -> active`
- `active -> cancelled`
- `active -> expired`
- `in_discussion -> cancelled`
- `awarded -> closed`

## 4. Professional response

`draft -> sent -> viewed -> shortlisted -> accepted`

Alternativy:
- `sent -> withdrawn`
- `viewed -> rejected`
- `shortlisted -> rejected`
- `shortlisted -> withdrawn`

## 5. Portfolio project

`draft -> published -> archived`

Alternativy:
- `published -> unpublished -> draft`
- `published -> restricted`
- `restricted -> published`
- `draft -> deleted`

## 6. Review

`eligible -> submitted -> published`

Alternativy:
- `submitted -> moderation_pending`
- `published -> disputed`
- `disputed -> published`
- `disputed -> hidden`
- `hidden -> restored`

## 7. Verification

`not_started -> in_progress -> pending_review -> verified`

Alternativy:
- `pending_review -> rejected`
- `verified -> expired`
- `verified -> revoked`
- `rejected -> in_progress`

## 8. Project workspace

`idea -> planning -> sourcing -> active -> completed -> archived`

Alternativy:
- `active -> paused -> active`
- `planning -> cancelled`
- `sourcing -> cancelled`

## 9. Approval

`draft -> submitted -> in_review -> approved`

Alternativy:
- `in_review -> changes_requested -> submitted`
- `in_review -> rejected`
- `submitted -> withdrawn`

## 10. Company invitation

`created -> sent -> accepted`

Alternativy:
- `sent -> declined`
- `sent -> expired`
- `sent -> revoked`

## Stavová pravidla

- Každý přechod musí mít oprávnění.
- Neplatný přechod se nesmí provést.
- Významné přechody mají auditní záznam.
- Uživatel musí vidět aktuální stav.
- Stav nesmí být odvozován jen z textového popisu.

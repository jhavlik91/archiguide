# Notifikace a komunikační pravidla

## Kanály
- in-app,
- e-mail,
- SMS,
- push.

## Priority
- low,
- normal,
- high,
- urgent.

## Události

### Messaging
- new_message
- mention
- attachment_received

### Marketplace
- request_published
- new_response
- response_viewed
- shortlisted
- response_accepted
- response_rejected
- request_paused
- request_closed

### Matching
- new_recommendation
- recommended_request

### Portfolio
- coauthor_invited
- coauthor_confirmed
- project_comment

### Workspace
- member_invited
- milestone_due
- approval_requested
- changes_requested
- approval_completed

### Reviews
- review_received
- review_reply
- review_disputed
- dispute_resolved

### Verification
- verification_pending
- verification_approved
- verification_rejected
- verification_expiring

### Jobs
- relevant_job
- application_update

## Default channel policy

| Událost | In-app | E-mail | SMS | Push |
|---|---:|---:|---:|---:|
| New message | Y | C | N | C |
| New response | Y | Y | N | C |
| Booking change | Y | Y | C | C |
| Urgent request | Y | C | C | C |
| Verification expiry | Y | Y | N | C |
| Weekly digest | N | Y | N | N |

## Pravidla
- SMS nikdy pro marketing defaultně.
- Urgentní neznamená automaticky SMS bez opt-in, kromě právně nutných servisních případů.
- Notifikace musí být deduplikované.
- Uživatel musí znát důvod notifikace.
- Odkaz musí vést do relevantního kontextu.
- Digest nesmí obsahovat citlivá data, která nejsou vhodná do e-mailu.

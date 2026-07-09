# Doménové entity — produktová úroveň

Tento dokument neřeší databázovou technologii.

## User
Atributy:
- identity,
- contact preferences,
- roles,
- status,
- locale,
- notification preferences.

## ProfessionalProfile
- headline,
- bio,
- professions,
- specializations,
- service areas,
- availability,
- pricing model,
- verification badges.

## Organization
- name,
- legal/business identity,
- brand,
- branches,
- members,
- roles,
- profile visibility.

## Profession
- category,
- name,
- synonyms,
- regulated flag,
- required verification hints.

## Specialization
- profession relation,
- label,
- description.

## ProjectIntent
Nezávazný záměr vzniklý v guide.

## GuideSession
- scenario,
- answers,
- state,
- progress,
- warnings,
- conflicts.

## Brief
- summary,
- goals,
- location,
- scope,
- budget,
- timing,
- inputs,
- missing inputs,
- risks,
- recommended professions,
- visibility.

## Attachment
- owner,
- context,
- visibility,
- sensitivity flag,
- metadata.

## Request
- type,
- visibility,
- brief reference,
- status,
- target professions,
- region,
- budget,
- timeline.

## RequestResponse
- professional,
- request,
- message,
- price model,
- availability,
- relevant portfolio items,
- status.

## MatchRecommendation
- target,
- candidate,
- reasons,
- status,
- sponsorship flag.

## PortfolioProject
- owner,
- coauthors,
- title,
- type,
- location,
- year,
- description,
- visibility,
- publication status.

## PortfolioBlock
Typy:
- text,
- heading,
- image,
- gallery,
- carousel,
- video,
- before_after,
- floorplan,
- pdf,
- map,
- quote,
- table,
- technical_data,
- materials,
- team,
- timeline,
- budget,
- award,
- CTA.

## Conversation
- participants,
- context,
- state.

## Message
- sender,
- conversation,
- content,
- attachments,
- reply reference,
- moderation state.

## Notification
- recipient,
- event type,
- channel,
- priority,
- state.

## ServiceOffering
- provider,
- title,
- scope,
- price,
- inputs,
- outputs,
- lead time,
- cancellation rules.

## Review
- reviewer,
- target,
- interaction evidence,
- ratings,
- text,
- status,
- reply.

## Verification
- subject,
- type,
- status,
- issued/expiry information,
- review notes.

## JobPost
- organization,
- role,
- location,
- work mode,
- seniority,
- compensation,
- status.

## TeamRequest
- owner,
- project context,
- profession needed,
- confidentiality,
- status.

## CapacityOffer
- professional,
- period,
- hours,
- location,
- work mode,
- skills.

## ProjectWorkspace
- project,
- members,
- roles,
- state.

## Milestone
- workspace,
- title,
- due date,
- status.

## Approval
- workspace,
- artifact/version,
- requester,
- reviewers,
- status.

## Moodboard
- owner,
- visibility,
- items,
- notes.

## Report
- reporter,
- target type,
- target,
- reason,
- state.

## Subscription
- subject,
- plan,
- status,
- entitlements.

## LeadAccess
- professional,
- request,
- access type,
- status.

# T006 — Design system + layout

**Track:** A (foundation) | **Závislosti:** T001 | **Assignee:** —

## Goal
Základní design system a aplikační layout, aby feature tasky skládaly UI z hotových komponent a vizuál byl konzistentní. Viz UX požadavky `zadani/legacy-master-spec.md` §53.

## User roles
Všechny.

## Preconditions
T001 done.

## Main flow
1. shadcn/ui setup + design tokens (barvy, typografie, spacing) v Tailwind configu.
2. Komponenty: Button, Input, Select, Textarea, Checkbox/Radio, Dialog, Toast, Card, Badge, Avatar, Tabs, EmptyState, Skeleton — každá se Storybook story.
3. Layouty: veřejný (header s navigací + login CTA), aplikační (sidebar/topbar + přepínač kontextu — slot, plní T004), admin.
4. Responzivita mobile-first — klíčové flow musí být plně použitelné na mobilu.
5. Stavové vzory: loading (Skeleton), empty (EmptyState), error (Toast/inline) — dokumentované ve Storybooku jako závazný vzor.

## Validation
N/A.

## Permissions
Layouty samy nic nevynucují (vynucení v middleware/T004), jen zobrazují správnou navigaci dle role.

## States
N/A.

## Edge cases
Dlouhá jména/texty (truncation), RTL není potřeba, mobilní viewport 360 px.

## Analytics
N/A.

## Acceptance criteria
- [ ] Všechny komponenty mají story a projdou Storybook buildem.
- [ ] Veřejný, aplikační a admin layout renderují na mobilu i desktopu (Playwright viewport testy).
- [ ] EmptyState/loading/error vzory zdokumentované ve Storybooku.

## Out of scope
Konkrétní feature obrazovky, obsah přepínače kontextu (T004).

# T014 — Media upload + knihovna

**Track:** C (portfolio) | **Závislosti:** T004 | **Assignee:** —

## Goal
Upload a správa obrázků s knihovnou per vlastník; originál vždy obnovitelný. Sdílená služba pro portfolio, profily, přílohy.

## User roles
Každý přihlášený (kvóty dle role později — monetizace).

## Preconditions
T004 done.

## Inputs
JPEG/PNG/WebP, max 25 MB/soubor.

## Main flow
1. Model `MediaAsset`: owner (user|org), original key, derivative keys, mime, rozměry, size, alt text, createdAt.
2. Storage adapter: S3-kompatibilní (prod) / filesystem (dev) za jedním interface.
3. Upload: přímý multipart přes route handler, generování derivátů (thumbnail, web-optimized) — sharp.
4. Knihovna UI: grid, multi-upload, mazání (soft delete pokud je asset použitý — varování), alt text.
5. **Originál se nikdy nepřepisuje** — deriváty a úpravy (T015) jsou vždy nové soubory (`zadani/16-ai-team-execution-rules.md` §7).

## Alternative flows
Příliš velký soubor → srozumitelná chyba před uploadem i na serveru (`zadani/09-edge-cases.md`).

## Validation
Mime whitelist (kontrola obsahu, ne jen přípony), max velikost, max 20 souborů na dávku.

## Permissions
Asset vidí a používá jen vlastník (user/org členové); veřejně se servírují jen deriváty assetů použitých v publikovaném obsahu.

## States
`active` | `deleted` (soft).

## Edge cases
Duplicitní upload (dedup přes hash — volitelně, jinak povolit); smazání assetu použitého v publikovaném portfoliu (blokovat s vysvětlením); EXIF: odstranit GPS metadata z derivátů (privacy).

## Analytics
Event: `media.uploaded` (počet, velikost).

## Acceptance criteria
- [ ] Multi-upload → deriváty se vygenerují → grid je zobrazí.
- [ ] Soubor 30 MB odmítnut se srozumitelnou hláškou.
- [ ] GPS EXIF se v derivátech nevyskytuje (unit test).
- [ ] Smazání použitého assetu blokováno s odkazy, kde je použit.

## Out of scope
Úpravy obrázků (T015), video, PDF preview, kvóty/limity.

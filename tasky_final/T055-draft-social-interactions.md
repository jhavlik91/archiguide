# T055 — Interakce — like, komentáře, uložení, sdílení

**Track:** M (social) | **Závislosti:** T054, T036 | **Stav:** draft

## Goal
Interakce s obsahem: like, komentáře, uložení, sdílení, nahlášení — pro příspěvky, portfolio projekty a další feed obsah. Viz `zadani/legacy-master-spec.md` §26.2.

## Scope
- Like: na příspěvek/portfolio projekt; počty veřejné.
- Komentáře: vlákno pod příspěvkem/projektem (autor obsahu může komentáře vypnout/skrýt jednotlivě); zmínka v komentáři → notifikace (`project_comment`, `mention` z `zadani/11-notifications.md`).
- Uložení: privátní záložky (obrázek/projekt — `image_saved`, `project_saved` z metrik; napojení na moodboardy T056).
- Sdílení: odkaz + interní sdílení do konverzace (T030).
- Nahlášení: reuse T036 (target types `post`, `comment`).
- Moderace komentářů: `visible → hidden` (T036 akce), autor obsahu může skrýt komentář u svého obsahu.

## Klíčová pravidla
Interakce jen s veřejným obsahem; uložení je soukromé (nikdo nevidí, co si uživatel ukládá); komentáře podléhají stejné moderaci jako ostatní obsah; žádné vanity notifikace bez opt-out.

## Akceptační náčrt
Like/unlike idempotentní; komentář → notifikace autorovi; skrytí komentáře autorem obsahu; uložený obrázek v „Uloženo"; report komentáře ve frontě.

## Out of scope
Feed skládání (T054), moodboard organizace uloženého (T056), reakce emoji škála, embed sdílení mimo platformu.

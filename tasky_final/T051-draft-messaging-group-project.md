# T051 — Messaging — skupinové a projektové konverzace

**Track:** L (workspace) | **Závislosti:** T030, T047 | **Stav:** draft

## Goal
Rozšíření messagingu o skupinové, týmové a projektové konverzace + zmínky, reakce a vyhledávání ve zprávách. Viz `zadani/legacy-master-spec.md` §27.1–27.2, §34 (chat v místnosti).

## Scope
- Typy konverzací: skupinová (ad-hoc členové), projektová (vázaná na workspace — členství synchronizované s workspace členy), týmová (organizace).
- Projektový chat: člen workspace = účastník; odebrání z workspace ukončí přístup k novým zprávám, historie do data odchodu zůstává čitelná dle rozhodnutí při rozpracování (default: ne — least privilege).
- Zmínky `@člen` → notifikace `mention` (typ z `zadani/11-notifications.md`); reakce emoji na zprávu; vyhledávání v konverzacích, kde je uživatel účastník.
- Správa skupiny: přidat/odebrat účastníka (zakladatel/owner), opustit konverzaci; systémové zprávy o změnách členství.
- Stav přečtení per účastník ve skupině.

## Klíčová pravidla
Skupinová konverzace po odchodu člena musí zůstat funkční (`zadani/09-edge-cases.md` — Messaging); vyhledávání nikdy nepřesáhne konverzace, kde je uživatel členem; analytika bez obsahu zpráv.

## Akceptační náčrt
Workspace chat drží členství synchronní s workspace; zmínka notifikuje; odebraný člen nevidí nové zprávy; vyhledávání vrací jen vlastní konverzace; odchod člena nerozbije vlákno.

## Out of scope
1:1 core (T030 hotové), přílohy/block/report (T031 hotové — platí i pro skupiny), video/audio hovory, externí hosté.

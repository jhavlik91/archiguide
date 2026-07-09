# T048 — Workspace — soubory, brief, poznámky

**Track:** L (workspace) | **Závislosti:** T047, T023 | **Stav:** draft

## Goal
Sdílené podklady projektu v místnosti: soubory s verzemi, připojený brief, poznámky. Viz `zadani/legacy-master-spec.md` §34.

## Scope
- Soubory přes attachment systém (T023) s workspace kontextem; viditelnost per workspace role (např. smlouva jen Owner+Client+Lead); verze souboru (nová verze nenahrazuje tiše starou — historie).
- Připojení briefu (T021/T022) do workspace — členové vidí aktuální verzi briefu dle oprávnění; citlivá pole (přesná adresa) viditelná jen rolím, kterým je klient zpřístupní.
- Poznámky: jednoduché sdílené texty (autor, datum, editace) — ne wiki, ne dokumenty.
- Složky/štítky pro organizaci souborů (jedna úroveň stačí).
- Audit: kdo nahrál/smazal/změnil viditelnost.

## Klíčová pravidla
Soubor sdílený mimo oprávnění je privacy incident (`zadani/09-edge-cases.md` — Workspace) — stahování jen přes autorizovaný endpoint (T023); smazání souboru = soft delete s placeholder; originál obnovitelný.

## Akceptační náčrt
Nahrání souboru → viditelnost dle role (Contractor nevidí smlouvu); nová verze zachová starou; odebraný člen nestáhne nic ani přes starou URL; brief v místnosti respektuje citlivá pole.

## Out of scope
Online náhledy CAD/BIM formátů, komentáře k souborům (T050 — vázané na schvalování), plnotextové vyhledávání v dokumentech.

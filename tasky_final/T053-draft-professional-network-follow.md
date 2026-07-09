# T053 — Profesní síť — follow + propojení

**Track:** M (social) | **Závislosti:** T008 | **Stav:** draft

## Goal
Základ sociální vrstvy: sledování profilů/firem, profesní propojení, označení spolupracovníka. Viz `zadani/legacy-master-spec.md` §26.3, Package 13.

## Scope
- Follow: jednosměrné sledování profilu/organizace (zdroj obsahu pro feed T054); follower počty na profilu (volitelně skryté vlastníkem).
- Propojení (connection): oboustranné — žádost + přijetí; seznam propojení na profilu (viditelnost volitelná).
- Označení spolupracovníka: „spolupracoval jsem s X na projektu Y" — vyžaduje potvrzení druhé strany (žádné jednostranné tvrzení o spolupráci); potvrzené spolupráce z workspace týmů (T052) se nabízejí automaticky.
- Správa: unfollow, zrušení propojení, blokace (reuse T031 block — blokovaný nemůže follow/connect).
- Notifikace: žádost o propojení, potvrzení spolupráce.

## Klíčová pravidla
Nepotvrzená spolupráce se nikde nezobrazuje; follow je veřejná akce jen se souhlasem (nastavení viditelnosti followers/following); žádný nákup viditelnosti v síti.

## Akceptační náčrt
Follow → obsah ve feedu; žádost o propojení → přijetí/odmítnutí; spolupráce viditelná až po potvrzení obou stran; blokace zamezí follow i propojení.

## Out of scope
Feed (T054), interakce s obsahem (T055), doporučování koho sledovat, import kontaktů.

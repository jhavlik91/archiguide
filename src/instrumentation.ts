/**
 * Next.js instrumentation — běží jednou při startu serveru pro všechny routy.
 * Zavádí registraci mezidoménových seamů, které jinak závisí na tom, jestli se
 * daný modul náhodou naimportuje. Konkrétně portfolio (T013) zde zaregistruje:
 *  - publikační detekci obsahu + zdroj bloků pro snapshot (do service vrstvy),
 *  - media usage resolver (T014) — aby serve/mazání médií znalo použití v
 *    portfoliu i na routě `/api/media/*`, která portfolio jinak neimportuje.
 *
 * Spouští se jen v Node runtime: `blocks-service` táhne serverovou vrstvu
 * (`service.ts` importuje node `crypto`), kterou by Edge runtime (middleware)
 * nedokázal zbundlovat. Edge tyto seamy nepotřebuje.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/features/portfolio/blocks-service");
  }
}

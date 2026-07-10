/**
 * Veřejné (klient-safe) API domény verifikace. Server-only funkce (service,
 * actions) se importují přímo z `./service` / `./actions`, aby se `server-only`
 * moduly nedostaly do klientského bundlu přes tento index.
 */
export * from "./rules";
export { VerificationBadges } from "./components/verification-badges";
export type { VerificationView, VerificationActionResult } from "./types";

/**
 * Barrel klient-bezpečné části attachment domény (T023). Server-only orchestrace
 * (`attach`, `canAccess`) je záměrně mimo — konzumující domény ji berou přes
 * veřejnou fasádu `@/lib/attachments`.
 */
export * from "./types";
export * from "./rules";
export * from "./registry";
export * from "./permissions";

/**
 * Barrel klient-bezpečné části messaging domény (T030). Server-only orchestrace
 * (`queries`, `service`) a server akce (`actions`) se importují přímo tam, kde
 * běží na serveru — sem patří jen čisté typy, pravidla a permission helpery.
 */
export * from "./types";
export * from "./rules";
export * from "./permissions";

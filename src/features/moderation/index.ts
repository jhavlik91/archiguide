/**
 * Barrel klient-bezpečné části moderační domény (T031, rozšíří T036). Server-only
 * service (`service.ts`) se importuje přímo tam, kde běží na serveru — sem patří
 * jen čisté typy, pravidla a validace.
 */
export * from "./types";
export * from "./rules";
export * from "./validation";

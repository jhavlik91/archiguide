// Barrel jen s ČISTÝMI moduly (bez `server-only`), aby šel importovat i z
// klientských komponent filtrů. Datová vrstva se importuje adresně z
// `@/features/search/service` (jen ze serverových rout).
export * from "./types";
export * from "./params";
export * from "./query";
export * from "./suggestions";

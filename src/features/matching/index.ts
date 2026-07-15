/**
 * Veřejný povrch domény matching (T028). Čisté moduly (typy, konfigurace,
 * skórování, stavový automat, oprávnění) jdou importovat i z klienta;
 * datová vrstva (`service.ts`) je server-only a importuje se přímo.
 */

export * from "./types";
export * from "./config";
export * from "./status";
export * from "./scoring";
export * from "./permissions";

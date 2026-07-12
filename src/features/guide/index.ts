/**
 * Veřejné API guide enginu (T017) — jen čisté moduly (bez DB / `next/*`), aby šly
 * použít i v UI (T018). Datová vrstva (`service.ts`) a cookie (`session-cookie.ts`)
 * jsou `server-only`, importují se přímo.
 */
export * from "./types";
export * from "./conditions";
export * from "./engine";
export * from "./validation";
export * from "./permissions";
export * from "./scenarios";

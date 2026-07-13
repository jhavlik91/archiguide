/**
 * Veřejné API domény brief (T021) — jen ČISTÉ moduly (bez DB / `next/*`), aby
 * šly použít i v UI a unit testech. Datová vrstva (`service.ts`) a akce
 * (`actions.ts`) jsou server-only, importují se přímo.
 */
export * from "./types";
export * from "./content";
export * from "./permissions";
export * from "./generator";

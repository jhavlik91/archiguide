/**
 * Veřejný povrch domény reakce na poptávku (T027). Čisté moduly (typy,
 * stavový automat, validace, oprávnění) jdou importovat i z klienta; datová
 * vrstva (`service.ts`) a akce (`actions.ts`) jsou server-only a importují se
 * přímo.
 */

export * from "./types";
export * from "./state-machine";
export * from "./validation";
export * from "./permissions";

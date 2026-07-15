/**
 * Veřejný povrch domény moderace (T036). Čisté moduly (typy, stavový automat,
 * validace, oprávnění) jdou importovat i z klienta; datová vrstva (`service.ts`)
 * a akce (`actions.ts`) jsou server-only a importují se přímo. Konzumující
 * domény ale nejčastěji jen embedují `components/report-button.tsx` — na tuhle
 * doménu samotnou nepotřebují sahat.
 */

export * from "./types";
export * from "./rules";
export * from "./state-machine";
export * from "./validation";
export * from "./permissions";

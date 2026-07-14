/**
 * Barrel klient-bezpečné části notifikací (T032). Server-only orchestrace
 * (`emit`, `service`, `queries`) a server akce (`actions`) se importují přímo tam,
 * kde běží na serveru (emit přes veřejné `@/lib/notifications`) — sem patří jen
 * čisté typy, pravidla a permission helpery.
 */
export * from "./types";
export * from "./rules";
export * from "./permissions";

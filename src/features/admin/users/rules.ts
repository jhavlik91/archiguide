/**
 * Čistá doménová pravidla admin akcí nad uživatelem (T035 § Edge cases). Bez
 * DB, aby šla pokrýt unit testy — service vrstva (`service.ts`) jen dodá data
 * (aktuální počet adminů, zda je cíl admin) a zavolá tuhle logiku.
 */

/** Admin nemůže zablokovat sám sebe. */
export function canSuspend(
  actorUserId: string,
  targetUserId: string,
): boolean {
  return actorUserId !== targetUserId;
}

/**
 * Smí se odebrat role `admin` cíli? Ne, pokud by v systému nezůstal žádný
 * admin — `targetIsAdmin` řekne, jestli cíl roli reálně má (odebrání role,
 * kterou nemá, je no-op a nikdy neporuší invariant).
 */
export function canRevokeAdminRole(
  targetIsAdmin: boolean,
  totalAdmins: number,
): boolean {
  if (!targetIsAdmin) return true;
  return totalAdmins > 1;
}

/**
 * Minimal class-name joiner used by placeholder components in the scaffold.
 * The full design-system helper (clsx + tailwind-merge) arrives with T006.
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

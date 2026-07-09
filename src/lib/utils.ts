import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Design-system class-name helper: merges conditional class lists (clsx) and
 * resolves conflicting Tailwind utilities so the last one wins (tailwind-merge).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

import { z } from "zod";
import { ROLES } from "@/lib/permissions";
import { roleSchema } from "@/features/roles/validation";

/**
 * Validace admin akcí nad uživatelem (T035 § Validation). Důvod je povinný u
 * blokace i změny role — obě akce zakládají auditní záznam (viz `features/admin/audit.ts`).
 */

const reasonSchema = z
  .string()
  .trim()
  .min(3, "Uveďte důvod (alespoň 3 znaky).")
  .max(500, "Důvod je příliš dlouhý (max. 500 znaků).");

export const suspendUserSchema = z.object({
  reason: reasonSchema,
});

export const unsuspendUserSchema = z.object({
  reason: reasonSchema,
});

export const roleChangeSchema = z.object({
  role: roleSchema,
  action: z.enum(["grant", "revoke"]),
  reason: reasonSchema,
});

/** Filtry výpisu uživatelů (T035 § Main flow 2). Vše volitelné. */
export const userListFilterSchema = z.object({
  query: z.string().trim().max(200).optional(),
  role: z.enum([...ROLES, "all"] as unknown as [string, ...string[]]).default(
    "all",
  ),
  status: z
    .enum(["active", "deactivated", "suspended", "deleted", "all"])
    .default("all"),
  verified: z.enum(["yes", "no", "all"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});

export type UserListFilter = z.infer<typeof userListFilterSchema>;

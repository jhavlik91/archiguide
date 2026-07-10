import { z } from "zod";
import { ROLES } from "@/lib/permissions";

/** Systémové role jako Zod enum (odvozeno z jediného zdroje pravdy `ROLES`). */
export const roleSchema = z.enum(
  ROLES as unknown as [string, ...string[]],
);

/** Kontext přepínatelný uživatelem (podmnožina rolí klient/profesionál). */
export const contextSchema = z.enum(["client", "professional"]);

/** Role, které si uživatel smí přidělit sám při onboardingu (T004 § Validation). */
export const SELF_SERVICE_ROLES = ["client", "professional"] as const;

export const claimRoleSchema = z.enum(SELF_SERVICE_ROLES);

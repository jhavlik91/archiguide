import { z } from "zod";
import {
  DESCRIPTION_MAX_LENGTH,
  INVITABLE_ROLES,
  NAME_MAX_LENGTH,
  ORG_ROLES,
} from "./types";

/**
 * Validace vstupů organizací (T009). Název je povinný (T009 § Validation),
 * ostatní pole jsou volitelná a vznikají postupně. Prázdné hodnoty jsou validní
 * a neblokují flow (viz TECHNICKE-ZADANI §4).
 */

/** Prázdný string → undefined; jinak ořízne okraje. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? undefined : v))
    .optional();

/** Pole textů: ořízne, zahodí prázdné a duplicity, zachová pořadí. */
const textList = (maxItemLength = 80) =>
  z
    .array(z.string().trim().min(1).max(maxItemLength))
    .transform((items) => [...new Set(items)])
    .optional()
    .transform((items) => items ?? []);

// --- Založení firmy ---------------------------------------------------------

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název firmy.").max(NAME_MAX_LENGTH),
  businessId: optionalText(20),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

// --- Editace firemního profilu ---------------------------------------------

export const updateOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Název firmy je povinný.")
    .max(NAME_MAX_LENGTH),
  logoUrl: z
    .string()
    .trim()
    .url("Zadejte platnou URL loga.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  description: optionalText(DESCRIPTION_MAX_LENGTH),
  businessId: optionalText(20),
  location: optionalText(120),
  serviceAreas: textList(),
  specializations: textList(),
  // Veřejný kontakt (T010) — opt-in, prázdné = nezveřejněno.
  publicEmail: z
    .string()
    .trim()
    .email("Zadejte platný e-mail.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  publicPhone: optionalText(40),
  publicWebsite: z
    .string()
    .trim()
    .url("Zadejte platnou URL webu.")
    // Renderuje se jako odkaz na veřejné stránce — jen http(s), ať nejde uložit
    // např. `javascript:` URL.
    .refine((url) => /^https?:\/\//i.test(url), "Web musí začínat http(s)://.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

// --- Opt-in člena do veřejného týmu -----------------------------------------

export const memberVisibilitySchema = z.object({
  visible: z.boolean(),
});
export type MemberVisibilityInput = z.infer<typeof memberVisibilitySchema>;

// --- Pozvání člena ----------------------------------------------------------

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Zadejte e-mail.")
    .email("Zadejte platný e-mail.")
    .toLowerCase(),
  // owner nelze pozvat — vzniká jen založením nebo předáním vlastnictví.
  role: z.enum(INVITABLE_ROLES).default("member"),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// --- Změna role člena -------------------------------------------------------

export const changeRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ORG_ROLES),
});
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

/** Cílový uživatel (odebrání člena, předání vlastnictví). */
export const memberTargetSchema = z.object({
  userId: z.string().min(1),
});

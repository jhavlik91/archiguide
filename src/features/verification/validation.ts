import { z } from "zod";
import { PHONE_CODE_LENGTH } from "./constants";

/**
 * Validační schémata verifikace (T011). Čisté (jen Zod), použitelné na serveru
 * i klientu. Telefon normalizujeme do E.164, kód je přesně N číslic.
 */

/**
 * Telefon v E.164: `+` a 8–15 číslic, první nenulová. Vstup smí obsahovat
 * mezery/pomlčky/závorky (běžné psaní), které se před validací odstraní.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^\+[1-9]\d{7,14}$/,
        "Zadejte telefon v mezinárodním formátu, např. +420123456789.",
      ),
  );

/** Kód z SMS: přesně `PHONE_CODE_LENGTH` číslic. */
export const codeSchema = z
  .string()
  .trim()
  .regex(
    new RegExp(`^\\d{${PHONE_CODE_LENGTH}}$`),
    `Kód má ${PHONE_CODE_LENGTH} číslic.`,
  );

/** E-mail pro změnu kontaktu — shodná pravidla jako v auth (T003). */
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Zadejte e-mail.")
  .email("Neplatný e-mail.");

export const requestPhoneSchema = z.object({ phone: phoneSchema });
export const confirmPhoneSchema = z.object({ code: codeSchema });
export const changeEmailSchema = z.object({ email: emailSchema });

export type RequestPhoneInput = z.infer<typeof requestPhoneSchema>;
export type ConfirmPhoneInput = z.infer<typeof confirmPhoneSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

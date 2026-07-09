import { z } from "zod";

/** Minimální délka hesla dle T003 (§ Validation). */
export const PASSWORD_MIN_LENGTH = 8;

/** Platnost tokenu pro reset hesla: 1 h (T003 § States). */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Rate limit citlivých akcí: 5 pokusů / min / IP (T003 § Validation). */
export const AUTH_RATE_LIMIT = { limit: 5, windowMs: 60 * 1000 } as const;

const email = z
  .string()
  .trim()
  .min(1, "Zadejte e-mail.")
  .email("Neplatný e-mail.");

const password = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Heslo musí mít alespoň ${PASSWORD_MIN_LENGTH} znaků.`,
  );

export const registerSchema = z.object({
  email,
  password,
  /** Souhlas s podmínkami je povinný (T003 § Main flow). */
  acceptTerms: z.boolean().refine((v) => v === true, {
    message: "Pro registraci je nutný souhlas s podmínkami.",
  }),
});

export const loginSchema = z.object({
  email,
  // Při loginu heslo jen nesmí být prázdné; délku řeší registrace.
  password: z.string().min(1, "Zadejte heslo."),
});

export const resetRequestSchema = z.object({
  email,
});

export const resetConfirmSchema = z.object({
  token: z.string().min(1, "Chybí token."),
  password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type ResetConfirmInput = z.infer<typeof resetConfirmSchema>;

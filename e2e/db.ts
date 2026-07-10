import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Kopie systémových rolí (e2e nezávisí na alias importu z `src`). */
type Role = "client" | "professional" | "moderator" | "admin";

/**
 * Přímý přístup do DB z e2e testů (T004) — jen pro přípravu stavu, který nelze
 * navodit přes UI (přidělení/odebrání role, jež v MVP dělá admin z T035).
 * `dotenv/config` načte DATABASE_URL z `.env` lokálně; v CI je v env jobu.
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL as string,
});
export const db = new PrismaClient({ adapter });

export async function grantRoleByEmail(
  email: string,
  role: Role,
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await db.userRole.upsert({
    where: { userId_role: { userId: user.id, role } },
    create: { userId: user.id, role },
    update: {},
  });
}

export async function revokeRoleByEmail(
  email: string,
  role: Role,
): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await db.userRole.deleteMany({ where: { userId: user.id, role } });
}

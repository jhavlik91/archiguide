import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton Prisma klient. V dev režimu se instance ukládá na `globalThis`,
// aby Next.js hot-reload nezakládal nové připojení při každé změně.
// Prisma 7 se k DB připojuje přes driver adapter (`@prisma/adapter-pg`).

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Chybí proměnná prostředí DATABASE_URL.");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

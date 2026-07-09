import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Seed infrastruktura. Zatím prázdná — jednotlivé domény si doplní vlastní
// seed data (taxonomie profesí, guide scénáře, …) v navazujících taskách.
// Spouští se přes `prisma db seed` (konfigurace v prisma.config.ts).

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Chybí proměnná prostředí DATABASE_URL.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Intentionally empty — placeholder pro doménové seedy.
  console.log("Seed dokončen (žádná data k vložení).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildTaxonomy } from "../../src/features/taxonomy/data";
import { hashPassword } from "../../src/features/auth/password";

// Seed infrastruktura. Doménové seedy se přidávají do `main`. Vše je idempotentní
// (upsert dle slugu), aby `prisma db seed` šlo spustit opakovaně i v CI.
// Spouští se přes `prisma db seed` (konfigurace v prisma.config.ts).

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Chybí proměnná prostředí DATABASE_URL.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/// Naplní taxonomii profesí (T005) — 17 kategorií a jejich profese.
async function seedTaxonomy() {
  const taxonomy = buildTaxonomy();
  let categoryCount = 0;
  let professionCount = 0;

  for (const category of taxonomy) {
    const savedCategory = await prisma.professionCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, position: category.position },
      create: {
        slug: category.slug,
        name: category.name,
        position: category.position,
      },
    });
    categoryCount += 1;

    for (const profession of category.professions) {
      await prisma.profession.upsert({
        where: { slug: profession.slug },
        update: {
          name: profession.name,
          synonyms: profession.synonyms,
          regulated: profession.regulated,
          verificationHints: profession.verificationHints,
          status: profession.status,
          position: profession.position,
          categoryId: savedCategory.id,
        },
        create: {
          slug: profession.slug,
          name: profession.name,
          synonyms: profession.synonyms,
          regulated: profession.regulated,
          verificationHints: profession.verificationHints,
          status: profession.status,
          position: profession.position,
          categoryId: savedCategory.id,
        },
      });
      professionCount += 1;
    }
  }

  console.log(
    `Taxonomie: ${categoryCount} kategorií, ${professionCount} profesí.`,
  );
}

/**
 * Vývojoví uživatelé s rolemi (T004). Slouží k lokálnímu vývoji a e2e testům
 * přepínání kontextu a ochrany (admin) rout. V produkci se nezakládají.
 * Heslo je společné a nízkohodnotné — jen pro dev/CI.
 */
const DEV_PASSWORD = "dev-password-123";
const DEV_USERS = [
  { email: "admin@archiguide.test", roles: ["admin"] as const },
  {
    email: "dual@archiguide.test",
    roles: ["client", "professional"] as const,
  },
] as const;

async function seedDevUsers() {
  if (process.env.NODE_ENV === "production") return;

  const passwordHash = await hashPassword(DEV_PASSWORD);
  for (const spec of DEV_USERS) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {},
      create: {
        email: spec.email,
        credential: { create: { passwordHash } },
      },
    });
    for (const role of spec.roles) {
      await prisma.userRole.upsert({
        where: { userId_role: { userId: user.id, role } },
        create: { userId: user.id, role },
        update: {},
      });
    }
  }
  console.log(`Dev uživatelé: ${DEV_USERS.length} (heslo: ${DEV_PASSWORD}).`);
}

async function main() {
  await seedTaxonomy();
  await seedDevUsers();
  console.log("Seed dokončen.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

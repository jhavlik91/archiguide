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

/**
 * Demo portfolio pro veřejnou stránku (T016): profesionál s publikovaným
 * profilem, jeho publikované dílo se snapshotem bloků a potvrzený spoluautor.
 * Umožní vývoj i e2e proti reálné stránce `/projekt/[slug]`. Jen dev/CI.
 * Idempotentní (upsert dle e-mailu/slugu). Obrázky jsou veřejné placeholdery.
 */
const DEMO_PROJECT_SLUG = "vila-nad-rekou";

async function upsertPublishedProfessional(
  email: string,
  headline: string,
  slug: string,
) {
  const passwordHash = await hashPassword(DEV_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, credential: { create: { passwordHash } } },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: user.id, role: "professional" } },
    create: { userId: user.id, role: "professional" },
    update: {},
  });
  await prisma.professionalProfile.upsert({
    where: { userId: user.id },
    update: { headline, slug, status: "published", publishedAt: new Date() },
    create: {
      userId: user.id,
      headline,
      slug,
      status: "published",
      publishedAt: new Date(),
    },
  });
  return user;
}

async function seedPortfolio() {
  if (process.env.NODE_ENV === "production") return;

  const owner = await upsertPublishedProfessional(
    "architekt@archiguide.test",
    "Ing. arch. Jan Novák",
    "jan-novak-architekt",
  );
  const coauthor = await upsertPublishedProfessional(
    "spoluautor@archiguide.test",
    "Ing. Petr Dvořák",
    "petr-dvorak-inzenyr",
  );

  const img = (seed: string) => `https://picsum.photos/seed/${seed}/1200/800`;
  const snapshot = {
    version: 1,
    title: "Vila nad řekou",
    projectType: "realization",
    location: "Praha 6",
    year: 2024,
    description:
      "Rodinná vila zasazená do svahu nad řekou. Práce se světlem, přírodními materiály a výhledem do zeleně.",
    visibility: "public",
    contentBlocks: [
      {
        type: "heading",
        content: { text: "Koncept", level: 2 },
      },
      {
        type: "text",
        content: {
          text: "Dům reaguje na terén a orientaci ke světovým stranám.\n\nHlavní obytný prostor se otevírá k jihu velkými prosklenými plochami.",
        },
      },
      {
        type: "gallery",
        content: {
          images: [
            {
              url: img("vila-1"),
              alt: "Pohled z ulice",
              caption: "Uliční fasáda",
            },
            { url: img("vila-2"), alt: "Obývací pokoj" },
            { url: img("vila-3"), alt: "Terasa" },
          ],
        },
      },
      {
        type: "before_after",
        content: {
          before: { url: img("vila-before"), alt: "Před rekonstrukcí" },
          after: { url: img("vila-after"), alt: "Po rekonstrukci" },
          beforeLabel: "Původní stav",
          afterLabel: "Realizace",
        },
      },
      {
        type: "technical_data",
        content: {
          items: [
            { label: "Užitná plocha", value: "240 m²" },
            { label: "Pozemek", value: "1 100 m²" },
            { label: "Dokončení", value: "2024" },
          ],
        },
      },
      {
        type: "quote",
        content: {
          text: "Nejlepší dům je ten, na který po čase zapomenete, že v něm bydlíte — prostě funguje.",
          author: "Jan Novák",
        },
      },
    ],
    snapshotAt: new Date().toISOString(),
  };

  const project = await prisma.portfolioProject.upsert({
    where: { slug: DEMO_PROJECT_SLUG },
    update: {
      publishedSnapshot: snapshot,
      status: "published",
      visibility: "public",
    },
    create: {
      ownerUserId: owner.id,
      title: "Vila nad řekou",
      projectType: "realization",
      location: "Praha 6",
      year: 2024,
      description: snapshot.description,
      visibility: "public",
      status: "published",
      slug: DEMO_PROJECT_SLUG,
      publishedSnapshot: snapshot,
      publishedAt: new Date(),
    },
  });

  await prisma.portfolioCoauthor.upsert({
    where: {
      projectId_userId: { projectId: project.id, userId: coauthor.id },
    },
    update: { status: "confirmed", respondedAt: new Date() },
    create: {
      projectId: project.id,
      userId: coauthor.id,
      status: "confirmed",
      respondedAt: new Date(),
    },
  });

  console.log(`Demo portfolio: /projekt/${DEMO_PROJECT_SLUG} (publikováno).`);
}

async function main() {
  await seedTaxonomy();
  await seedDevUsers();
  await seedPortfolio();
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

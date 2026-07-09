import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 přesouvá connection URL a nastavení migrací ze schema.prisma sem.
// Klient se k DB připojuje přes driver adapter (viz src/lib/db.ts); tento
// soubor slouží CLI příkazům (migrate, db seed, studio).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

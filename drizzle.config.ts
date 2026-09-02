import { defineConfig } from "drizzle-kit";

/**
 * Migrarile sunt fisiere SQL commit-uite, generate din schema si citite de
 * oameni inainte sa fie rulate. Nu se foloseste `drizzle-kit push` in afara
 * unui experiment local: intr-o baza cu date reale, o schimbare de schema
 * fara fisier de migrare e o schimbare pe care nu o poti reproduce.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrari",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgres://izorep:izorep@localhost:5433/izorep",
  },
  casing: "snake_case",
  verbose: true,
  strict: true,
});

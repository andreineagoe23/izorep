import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { conecteaza, URL_PROPRIETAR } from "./client.js";

/**
 * `npm run db:migrate` — aplica migrarile neaplicate, in ordine, ca
 * proprietar (`DATABASE_URL_PROPRIETAR`), niciodata ca aplicatie.
 *
 * `IZOREP_APP_PAROLA`, daca e pusa, devine parola rolului `izorep_app`.
 * Migrarea 0002 il creeaza cu parola din git, buna doar pentru baza locala;
 * pe Render o inlocuim la fiecare deploy cu cea din variabile, care e si in
 * `DATABASE_URL` al aplicatiei.
 */
const aici = dirname(fileURLToPath(import.meta.url));

const { db, sql, inchide } = conecteaza(URL_PROPRIETAR);
try {
  await migrate(db, { migrationsFolder: join(aici, "migrari") });
  console.log("Migrari aplicate.");
  const parola = process.env["IZOREP_APP_PAROLA"];
  if (parola) {
    // ALTER ROLE nu primeste parametri: literalul se scrie cu ghilimelele dublate.
    await sql.unsafe(`ALTER ROLE izorep_app PASSWORD '${parola.replaceAll("'", "''")}'`);
    console.log("Parola rolului izorep_app pusa din IZOREP_APP_PAROLA.");
  }
} finally {
  await inchide();
}

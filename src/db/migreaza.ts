import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { conecteaza, URL_PROPRIETAR } from "./client.js";

/** `npm run db:migrate` — aplica migrarile neaplicate, in ordine. */
const aici = dirname(fileURLToPath(import.meta.url));

const { db, inchide } = conecteaza(process.env["DATABASE_URL"] ?? URL_PROPRIETAR);
try {
  await migrate(db, { migrationsFolder: join(aici, "migrari") });
  console.log("Migrari aplicate.");
} finally {
  await inchide();
}

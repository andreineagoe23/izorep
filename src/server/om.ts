/**
 * `npm run om -- <email> "<nume>" [birou|contabilitate]` — da cont unui om.
 *
 * Fara ecran de administrare (aplicatie mica): conturile le adaugam noi. Omul
 * intra apoi cu link pe email. Ruleaza ca proprietar, in tenantul RADOIA.
 */
import { eq } from "drizzle-orm";
import { caTenant, conecteaza, URL_PROPRIETAR } from "../db/client.js";
import { tenant, utilizator } from "../db/schema.js";

const [email, nume, rol = "birou"] = process.argv.slice(2);
if (!email?.includes("@") || !nume || !["birou", "contabilitate"].includes(rol)) {
  console.error('Folosire: npm run om -- <email> "<nume>" [birou|contabilitate]');
  process.exit(1);
}

const { db, inchide } = conecteaza(process.env["DATABASE_URL_PROPRIETAR"] ?? URL_PROPRIETAR);
try {
  const [t] = await db.select().from(tenant).where(eq(tenant.denumire, process.env["TENANT"] ?? "RADOIA"));
  if (!t) throw new Error("Tenantul nu exista. Ruleaza intai: npm run db:seed");
  await caTenant(db, t.id, (tx) =>
    tx.insert(utilizator).values({ tenantId: t.id, email: email.trim().toLowerCase(), nume, rol })
      .onConflictDoUpdate({ target: [utilizator.tenantId, utilizator.email], set: { nume, rol, activ: true } }));
  console.log(`${nume} <${email.toLowerCase()}> poate intra (${rol}).`);
} finally {
  await inchide();
}

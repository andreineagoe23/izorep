/**
 * Conturile, din linia de comandă (aplicație mică: fără ecran de administrare).
 *
 *   npm run om -- <email> "<nume>" [birou|contabilitate]   cont nou, cu parolă temporară
 *   npm run om -- <email> "<nume>" [rol] --parola-stdin     cu parola citită de la intrare
 *   npm run om -- --reseteaza <email>                       parolă temporară nouă, deblocat, ieșit peste tot
 *   npm run om -- --dezactiveaza <email>                     nu mai intră; jurnalul îl păstrează
 *   npm run om -- --lista
 *
 * Parola temporară se tipărește o singură dată; la prima intrare omul își
 * alege alta. Cu `--parola-stdin` parola nu apare în istoricul terminalului
 * și nici în argumentele procesului: `printf '%s' "$P" | npm run om -- …`.
 *
 * Rulează ca proprietar (`DATABASE_URL_PROPRIETAR`, sau baza locală), în
 * tenantul `TENANT` (implicit RADOIA). Pe Render: adresa externă a bazei.
 */
import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { caTenant, conecteaza, URL_PROPRIETAR } from "../db/client.js";
import { sesiune, tenant, utilizator } from "../db/schema.js";
import { hashParola, parolaTemporara, problemaParola } from "./parola.js";

const arg = process.argv.slice(2);
const ROLURI = ["birou", "contabilitate"];
const folosire = (): never => {
  console.error([
    'Folosire: npm run om -- <email> "<nume>" [birou|contabilitate] [--parola-stdin]',
    "          npm run om -- --reseteaza <email>",
    "          npm run om -- --dezactiveaza <email>",
    "          npm run om -- --lista",
  ].join("\n"));
  process.exit(1);
};

const { db, inchide } = conecteaza(process.env["DATABASE_URL_PROPRIETAR"] ?? URL_PROPRIETAR);
try {
  const [t] = await db.select().from(tenant).where(eq(tenant.denumire, process.env["TENANT"] ?? "RADOIA"));
  if (!t) throw new Error("Firma nu există în bază. Rulează întâi: npm run db:seed");
  const peEmail = (e: string) => eq(sql`lower(${utilizator.email})`, e.trim().toLowerCase());

  if (arg[0] === "--lista") {
    const toti = await caTenant(db, t.id, (tx) => tx.select().from(utilizator));
    for (const u of toti) {
      console.log(`${u.activ ? "activ  " : "inactiv"} ${u.email} · ${u.nume} · ${u.rol}${u.parolaHash ? "" : " · fără parolă"}${
        u.parolaTemporara ? " · parolă temporară" : ""}${u.blocatPana && u.blocatPana > new Date() ? " · blocat" : ""}`);
    }
  } else if (arg[0] === "--reseteaza" || arg[0] === "--dezactiveaza") {
    const email = arg[1] ?? folosire();
    const temporara = parolaTemporara();
    const gasit = await caTenant(db, t.id, async (tx) => {
      const [u] = await tx.select().from(utilizator).where(peEmail(email));
      if (!u) return false;
      await tx.update(utilizator).set(arg[0] === "--reseteaza"
        ? { parolaHash: await hashParola(temporara), parolaTemporara: true, incercariGresite: 0, blocatPana: null, activ: true }
        : { activ: false }).where(eq(utilizator.id, u.id));
      await tx.delete(sesiune).where(and(eq(sesiune.utilizatorId, u.id)));
      return true;
    });
    if (!gasit) throw new Error(`Nu există cont pentru ${email}.`);
    console.log(arg[0] === "--reseteaza"
      ? `Parola temporară pentru ${email}: ${temporara}\nLa prima intrare își alege alta.`
      : `${email} nu mai poate intra.`);
  } else {
    const [email, nume, rol = "birou"] = arg.filter((a) => !a.startsWith("--"));
    if (!email?.includes("@") || !nume || !ROLURI.includes(rol)) folosire();
    const dinStdin = arg.includes("--parola-stdin");
    const parola = dinStdin ? readFileSync(0, "utf8").replace(/\r?\n$/, "") : parolaTemporara();
    const problema = dinStdin ? problemaParola(parola) : null;
    if (problema) throw new Error(problema);
    const hash = await hashParola(parola);
    const adresa = email!.trim().toLowerCase();
    await caTenant(db, t.id, (tx) =>
      tx.insert(utilizator).values({ tenantId: t.id, email: adresa, nume: nume!, rol, parolaHash: hash, parolaTemporara: !dinStdin })
        .onConflictDoUpdate({
          target: [utilizator.tenantId, utilizator.email],
          set: { nume: nume!, rol, activ: true, parolaHash: hash, parolaTemporara: !dinStdin, incercariGresite: 0, blocatPana: null },
        }));
    console.log(dinStdin
      ? `${nume} <${adresa}> poate intra (${rol}), cu parola dată.`
      : `${nume} <${adresa}> poate intra (${rol}).\nParola temporară: ${parola}\nLa prima intrare își alege alta.`);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await inchide();
}

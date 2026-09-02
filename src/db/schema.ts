import { sql } from "drizzle-orm";
import {
  boolean, date, index, jsonb, pgPolicy, pgTable,
  text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

/**
 * Schema de baza.
 *
 * Doua axe de separare, si NU sunt acelasi lucru:
 *
 *   tenant  — firma-client careia ii vinzi aplicatia. Granita DURA: doi
 *             tenanti nu vad nimic unul de la celalalt, niciodata.
 *   firma   — entitatea juridica emitenta din interiorul unui tenant.
 *             RADOIA ISOLIRUNG si R&F ISORAD SYSTEM sunt doua firme ale
 *             ACELUIASI tenant: impart clienti, liste de preturi, oameni.
 *             Granita MOALE, doar pentru serii de documente si antet.
 *
 * Confuzia dintre ele e cea mai scumpa greseala posibila aici. Azi exista un
 * singur tenant, dar coloana e pe fiecare tabel de la prima migrare: adaugata
 * peste treizeci de tabele pline, ar insemna backfill plus vanatoare dupa
 * fiecare interogare care a uitat-o.
 */

/**
 * Contextul de tenant al conexiunii. Vezi src/db/client.ts.
 *
 * `nullif(..., '')` nu e pedanterie. `set_config(..., true)` e local
 * tranzactiei, iar la incheierea ei parametrul nu revine la "nesetat", ci la
 * SIRUL GOL. Fara nullif, prima interogare de dupa o tranzactie crapa cu
 * `invalid input syntax for type uuid: ""` in loc sa nu vada nimic.
 */
const TENANT = sql`nullif(current_setting('app.tenant_id', true), '')::uuid`;

/**
 * Politica standard pentru un tabel cu tenant.
 *
 * `current_setting(..., true)` intoarce NULL cand contextul nu e pus, iar
 * `tenant_id = NULL` e NULL, deci randul e filtrat. Implicitul e "nu vezi
 * nimic", nu "vezi tot" — singurul implicit acceptabil.
 */
const doarTenantul = (nume: string) =>
  pgPolicy(nume, {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`tenant_id = ${TENANT}`,
    withCheck: sql`tenant_id = ${TENANT}`,
  });

export const tenant = pgTable("tenant", {
  id: uuid("id").primaryKey().defaultRandom(),
  denumire: text("denumire").notNull(),
  activ: boolean("activ").notNull().default(true),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
});

export const firma = pgTable("firma", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  denumire: text("denumire").notNull(),
  /** Raman null pana le da firma. Un CUI plauzibil dar gresit e mai rau decat gol. */
  cui: text("cui"),
  regCom: text("reg_com"),
  serieOferta: text("serie_oferta"),
  serieFactura: text("serie_factura"),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("firma_tenant_idx").on(t.tenantId),
  doarTenantul("firma_tenant"),
]);

export const utilizator = pgTable("utilizator", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  email: text("email").notNull(),
  nume: text("nume").notNull(),
  /** patron | tehnic | sef_echipa | gestionar | contabilitate */
  rol: text("rol").notNull(),
  activ: boolean("activ").notNull().default(true),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Email unic pe tenant, nu global: acelasi om poate exista la doi clienti.
  uniqueIndex("utilizator_tenant_email_idx").on(t.tenantId, t.email),
  doarTenantul("utilizator_tenant"),
]);

export const client = pgTable("client", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  denumire: text("denumire").notNull(),
  cui: text("cui"),
  /** rezidential | industrial | rafinarie — determina lista de preturi implicita. */
  categorie: text("categorie"),
  /** De unde stim de el: fisierul sursa, oferta, discutia. */
  sursa: text("sursa"),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("client_tenant_idx").on(t.tenantId),
  doarTenantul("client_tenant"),
]);

/**
 * Lista de preturi, versionata.
 *
 * Continutul sta ca document JSONB, nu spart in randuri de celule, si asta e
 * o decizie deliberata:
 *
 *  - lista e IMUTABILA dupa activare. Modificarea preturilor creeaza o
 *    versiune noua, nu editeaza celule. Un document versionat e exact ce e.
 *  - motorul incarca intotdeauna lista INTREAGA. Nicio interogare din
 *    aplicatie nu cere o singura celula, deci nimic nu castiga din spargere.
 *  - forma JSON e deja contractul testat: `ListaPreturi` si `ListaGoluriFoc`
 *    din src/pricing/lists.ts, cu 130 de teste in spate. Pastrand-o identica,
 *    listele din baza si cele din fisiere sunt interschimbabile — vezi testul
 *    de echivalenta din tests/db.test.ts.
 *
 * Metadatele care se INTEROGHEAZA raman coloane: care lista e activa pentru
 * tenantul X, sistemul Y, la data Z.
 */
export const listaPreturi = pgTable("lista_preturi", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  /** elastomer | vata_minerala | tabla | pvc | goluri_foc */
  sistem: text("sistem").notNull(),
  denumire: text("denumire").notNull(),
  /** "material + manopera" sau "manopera" — schimba ce inseamna pretul. */
  contine: text("contine").notNull(),
  moneda: text("moneda").notNull().default("EUR"),
  valabilDeLa: date("valabil_de_la").notNull(),
  valabilPanaLa: date("valabil_pana_la"),
  /** draft | activa | arhivata */
  status: text("status").notNull().default("draft"),
  /** De unde vine: numele fisierului Excel primit de la firma. */
  sursa: text("sursa"),
  continut: jsonb("continut").notNull(),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
  creatDe: uuid("creat_de").references(() => utilizator.id, { onDelete: "set null" }),
}, (t) => [
  index("lista_preturi_tenant_sistem_idx").on(t.tenantId, t.sistem, t.status),
  // O singura lista ACTIVA per sistem, per tenant. Doua liste active in
  // acelasi timp inseamna ca nimeni nu stie dupa care s-a ofertat.
  uniqueIndex("lista_preturi_una_activa_idx")
    .on(t.tenantId, t.sistem)
    .where(sql`status = 'activa'`),
  doarTenantul("lista_preturi_tenant"),
]);

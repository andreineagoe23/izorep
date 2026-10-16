import { sql } from "drizzle-orm";
import {
  boolean, customType, date, foreignKey, index, integer, jsonb, numeric, pgPolicy, pgTable,
  primaryKey, text, timestamp, uniqueIndex, uuid,
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
/**
 * O valoare pusa de aplicatie pentru o singura tranzactie (`cuCheie`). Ca la
 * tenant, sirul gol inseamna "nesetat", deci nu se potriveste cu nimic.
 */
const CHEIE = (nume: string) => sql.raw(`nullif(current_setting('${nume}', true), '')`);

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
  /**
   * Cheia stabila a firmei in aplicatie (`radoia`, `isorad`, ca `FIRME` din
   * `web/date/seed.ts`): pe ea se leaga oferta, santierul si depozitul, nu pe
   * denumire, care se scrie diferit de la un document la altul.
   */
  cod: text("cod"),
  /** Raman null pana le da firma. Un CUI plauzibil dar gresit e mai rau decat gol. */
  cui: text("cui"),
  regCom: text("reg_com"),
  serieOferta: text("serie_oferta"),
  serieFactura: text("serie_factura"),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("firma_tenant_idx").on(t.tenantId),
  uniqueIndex("firma_tenant_cod_idx").on(t.tenantId, t.cod),
  doarTenantul("firma_tenant"),
]);

export const utilizator = pgTable("utilizator", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  email: text("email").notNull(),
  nume: text("nume").notNull(),
  /** birou | contabilitate — rolurile se stabilesc cu firma */
  rol: text("rol").notNull(),
  activ: boolean("activ").notNull().default(true),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Email unic pe tenant, nu global: acelasi om poate exista la doi clienti.
  uniqueIndex("utilizator_tenant_email_idx").on(t.tenantId, t.email),
  doarTenantul("utilizator_tenant"),
  // La intrare nu se stie inca tenantul: omul scrie doar emailul. Vede randurile
  // cu adresa pe care a scris-o el, si nimic altceva. Vezi `cuCheie` in client.ts.
  pgPolicy("utilizator_dupa_email", {
    as: "permissive", for: "select", to: "public",
    using: sql`lower(email) = ${CHEIE("app.email_cautat")}`,
  }),
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
  /** elastomer | vata_minerala | tabla | tabla_inox | pvc | goluri_foc */
  sistem: text("sistem").notNull(),
  /**
   * rezidential | industrial | rafinarie
   *
   * Firma tine trei liste pentru acelasi sistem, cu valori diferite. Nu e un
   * coeficient peste rezidential — vata e x1,25 constant, dar elastomerul e
   * x1,25 la 9/13/19 mm si x1,20 la 25/32 mm — deci sunt documente separate,
   * nu un camp de inmultire. Destinatia intra in cheia de unicitate: doua
   * liste active pe acelasi sistem sunt corecte daca sunt pe destinatii
   * diferite, si o eroare daca nu. A doua axa din `liste-preturi.md` —
   * `contine`, material+manopera fata de doar manopera — exista deja ca
   * coloana, dar nu e inca in cheie: listele de manopera au alta FORMA (tarif
   * plat, nu matrice), deci intra cand se decide daca sunt acelasi tip de
   * document.
   */
  destinatie: text("destinatie").notNull().default("rezidential"),
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
  index("lista_preturi_tenant_sistem_idx").on(t.tenantId, t.sistem, t.destinatie, t.status),
  // O singura lista ACTIVA per sistem SI destinatie, per tenant. Doua liste
  // active pe acelasi sistem si aceeasi destinatie inseamna ca nimeni nu stie
  // dupa care s-a ofertat.
  uniqueIndex("lista_preturi_una_activa_idx")
    .on(t.tenantId, t.sistem, t.destinatie)
    .where(sql`status = 'activa'`),
  doarTenantul("lista_preturi_tenant"),
]);


/**
 * Seriile de diametre pe material.
 *
 * DN nu e un diametru masurabil, iar conversia DN -> diametru exterior DIFERA
 * dupa material: DN15 e ø21,3 la otel, dar ø18 la cupru si ø20 la PP-R. Codul
 * (`src/pricing/dn-table.ts`) aplica azi tabelul de otel tuturor, deci o
 * pozitie de cupru se tarifeaza pe randul gresit.
 *
 * Tabelul NU e per tenant: sunt norme (EN 10255, EN 10220, EN 1057,
 * EN ISO 15874, EN 12201, EN ISO 15875, EN ISO 1452, EN 1329/1401), aceleasi
 * pentru oricine. Un tenant_id aici ar sugera ca doua firme pot avea serii
 * diferite pentru aceeasi teava, ceea ce nu se poate. De aceea nu are nici
 * politica de RLS — nu e nimic de izolat.
 *
 * Sursa: `attachments/referinte/conversie-ml-mp-tevi-tubulaturi.xlsx`.
 */
export const serieDiametre = pgTable("serie_diametre", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** otel_negru | otel_zincat | cupru | ppr | pehd | pexa | pvc_presiune | pvc_canalizare | spiro */
  material: text("material").notNull(),
  /** Diametrul nominal. La spiro nominalul ESTE diametrul exterior. */
  dn: integer("dn"),
  /** Diametrul exterior real, in mm. Dupa el se cauta randul din lista. */
  diametruExterior: numeric("diametru_exterior", { precision: 8, scale: 2 }).notNull(),
  /** Echivalenta in toli, orientativa la plastic si cupru. */
  toli: text("toli"),
  /** Norma din care vine randul, cand se stie. */
  standard: text("standard"),
}, (t) => [
  // Un material poate avea doua randuri cu acelasi DN (PE-HD: DN125 e si
  // ø125, si ø140), deci unicitatea e pe diametrul exterior, nu pe DN.
  uniqueIndex("serie_diametre_material_od_idx").on(t.material, t.diametruExterior),
  index("serie_diametre_material_dn_idx").on(t.material, t.dn),
]);

/**
 * Sectiunile standard de tubulatura rectangulara.
 *
 * Suprafata nu se stocheaza: e `2 x (A + B + 4 x izolatie) / 1000` si depinde
 * de grosimea izolatiei, care e per pozitie. Un mp calculat si salvat ar fi
 * primul lucru care se invecheste.
 *
 * Referinta, ca si seria de diametre — nu e per tenant.
 */
export const sectiuneRectangulara = pgTable("sectiune_rectangulara", {
  id: uuid("id").primaryKey().defaultRandom(),
  aMm: integer("a_mm").notNull(),
  bMm: integer("b_mm").notNull(),
}, (t) => [
  uniqueIndex("sectiune_rectangulara_ab_idx").on(t.aMm, t.bMm),
]);

/**
 * Cat s-a folosit modelul (OpenAI) azi, pe tipuri: `linii` (randurile din
 * Excel trimise la `/api/extrage`) si `poze` (pozele din carnet si avizele).
 * Plafonul zilnic (`src/server/limita-model.ts`) se numara aici, nu in
 * memoria serverului: pe Render serverul gratuit adoarme dupa 15 minute si
 * ar porni de la zero la fiecare trezire.
 *
 * Fara tenant: cheia OpenAI e a serverului, deci si plafonul.
 */
export const folosireModel = pgTable("folosire_model", {
  /** Ziua, la Bucuresti. */
  zi: date("zi").notNull(),
  tip: text("tip").notNull(),
  unitati: integer("unitati").notNull(),
}, (t) => [
  primaryKey({ columns: [t.zi, t.tip] }),
]);

/* ------------------------------------------------------------------------ */
/* Faza 3: datele comune (9 octombrie 2026). Ce statea in browser trece aici. */
/* ------------------------------------------------------------------------ */

/**
 * Bytes, pentru fisierul clientului si pozele din carnet. Stau in baza, nu pe
 * disc: sunt putine (sute de kB, un MB o poza) si intra in acelasi backup.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/**
 * Hash-ul cautat la intrare. Ca la email: cine stie tokenul (sau cookie-ul)
 * vede randul lui, si atat. Hash-ul e secretul; in baza nu sta tokenul.
 */
const dupaHash = (nume: string) =>
  pgPolicy(nume, {
    as: "permissive", for: "all", to: "public",
    using: sql`hash = ${CHEIE("app.hash_cautat")}`,
    withCheck: sql`hash = ${CHEIE("app.hash_cautat")}`,
  });

/** Linkul de intrare primit pe email: o singura folosire, 15 minute. */
export const tokenIntrare = pgTable("token_intrare", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  utilizatorId: uuid("utilizator_id").notNull().references(() => utilizator.id, { onDelete: "cascade" }),
  /** sha256 al tokenului, hex. */
  hash: text("hash").notNull(),
  expira: timestamp("expira", { withTimezone: true }).notNull(),
  folositLa: timestamp("folosit_la", { withTimezone: true }),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("token_intrare_hash_idx").on(t.hash),
  doarTenantul("token_intrare_tenant"),
  dupaHash("token_intrare_dupa_hash"),
]);

/** Sesiunea din cookie. Iesirea o sterge; altfel expira singura. */
export const sesiune = pgTable("sesiune", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  utilizatorId: uuid("utilizator_id").notNull().references(() => utilizator.id, { onDelete: "cascade" }),
  hash: text("hash").notNull(),
  expira: timestamp("expira", { withTimezone: true }).notNull(),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("sesiune_hash_idx").on(t.hash),
  doarTenantul("sesiune_tenant"),
  dupaHash("sesiune_dupa_hash"),
]);

/**
 * Cererea de oferta: importul, cum il tinea browserul (`SesiuneImport` din
 * `web/istoric.ts`). Fisierul clientului plus ce a citit aplicatia si ce a
 * corectat omul; grila se reface din ele. Se editeaza cat se lucreaza la ea.
 *
 * Id-ul e cel dat de browser, text: la mutarea datelor din browser nimic nu se
 * traduce, iar o mutare repetata nu dubleaza nimic.
 */
export const cerere = pgTable("cerere", {
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  id: text("id").notNull(),
  nume: text("nume").notNull(),
  marime: integer("marime").notNull(),
  /** Cand a fost importata (ISO), cum o tinea browserul. */
  cand: timestamp("cand", { withTimezone: true }).notNull(),
  model: text("model"),
  destinatie: text("destinatie"),
  pozitii: integer("pozitii").notNull(),
  tarifate: integer("tarifate").notNull(),
  valoare: numeric("valoare", { precision: 14, scale: 2 }).notNull(),
  fisier: bytea("fisier").notNull(),
  /** extrase, editari, grosimiPropuse, descrieriSchimbate, preturiManuale. */
  lucru: jsonb("lucru").notNull(),
  creatDe: uuid("creat_de").references(() => utilizator.id, { onDelete: "set null" }),
  actualizatLa: timestamp("actualizat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  doarTenantul("cerere_tenant"),
]);

/**
 * Oferta salvata: ce a plecat la client, copiat, nu referentiat (regula 3).
 * Se salveaza la „Descarca oferta", o versiune noua de fiecare data. Nu se
 * editeaza si nu se sterge: trigger in migrarea 0006.
 *
 * `continut` e `CerereOferta` din `web/oferta.ts` (liniile cu preturile,
 * antetul, provenienta): din el se reface registrul si totalul. Lipseste doar
 * la ofertele mutate din browser, unde browserul tinea numai sumarul
 * (`mutata = true`); acolo cererea, mutata intreaga, reface liniile.
 */
export const oferta = pgTable("oferta", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  cerereId: text("cerere_id").notNull(),
  versiune: integer("versiune").notNull(),
  firmaId: uuid("firma_id").references(() => firma.id, { onDelete: "restrict" }),
  /** „RAD284", sau gol daca oferta n-a primit numar. */
  numar: text("numar").notNull(),
  /** Data scrisa pe oferta: „27.05.2026". */
  data: text("data").notNull(),
  client: text("client").notNull(),
  obiectiv: text("obiectiv").notNull(),
  /** Ce plateste clientul: dupa ajustare, adaosul de foc si discount. */
  valoare: numeric("valoare", { precision: 14, scale: 2 }).notNull(),
  pozitii: integer("pozitii").notNull(),
  continut: jsonb("continut"),
  mutata: boolean("mutata").notNull().default(false),
  creatDe: uuid("creat_de").references(() => utilizator.id, { onDelete: "set null" }),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("oferta_cerere_versiune_idx").on(t.tenantId, t.cerereId, t.versiune),
  foreignKey({ columns: [t.tenantId, t.cerereId], foreignColumns: [cerere.tenantId, cerere.id] }).onDelete("restrict"),
  doarTenantul("oferta_tenant"),
]);

/**
 * Santierul facut din oferta: planul (`PlanSantier` fara situatii) e inghetat
 * de cand exista o situatie de lucrari — istoricul ei e pe pozitiile lui.
 * Pana atunci se poate reface din oferta, ca in browser.
 */
export const santier = pgTable("santier", {
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  id: text("id").notNull(),
  ofertaId: uuid("oferta_id").references(() => oferta.id, { onDelete: "restrict" }),
  firmaId: uuid("firma_id").references(() => firma.id, { onDelete: "restrict" }),
  denumire: text("denumire").notNull(),
  /** Fisierul importat din care a iesit oferta. */
  fisier: text("fisier").notNull(),
  plan: jsonb("plan").notNull(),
  /** Seful de santier desemnat (S34). */
  responsabil: text("responsabil"),
  creat: timestamp("creat", { withTimezone: true }).notNull(),
  /**
   * Faza 7: cand s-a inchis, cu stocul la zero. Inchis, nu mai primeste
   * situatii si nici miscari pe depozitul lui (trigger, migrarea 0012).
   */
  inchisLa: timestamp("inchis_la", { withTimezone: true }),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  doarTenantul("santier_tenant"),
]);

/** Lucrarile suplimentare, peste planul inghetat. Doar se adauga. */
export const anexaSantier = pgTable("anexa_santier", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  santierId: text("santier_id").notNull(),
  motiv: text("motiv").notNull(),
  pozitii: jsonb("pozitii").notNull(),
  creatDe: uuid("creat_de").references(() => utilizator.id, { onDelete: "set null" }),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  foreignKey({ columns: [t.tenantId, t.santierId], foreignColumns: [santier.tenantId, santier.id] }).onDelete("restrict"),
  doarTenantul("anexa_santier_tenant"),
]);

/** Situatia de lucrari. Nu se editeaza; se sterge doar ultima (trigger). */
export const situatie = pgTable("situatie", {
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  santierId: text("santier_id").notNull(),
  nr: integer("nr").notNull(),
  id: text("id").notNull(),
  data: timestamp("data", { withTimezone: true }).notNull(),
  /** Cantitatea executata in perioada, pe numarul pozitiei. */
  cantitati: jsonb("cantitati").notNull(),
  nota: text("nota"),
  creatDe: uuid("creat_de").references(() => utilizator.id, { onDelete: "set null" }),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.santierId, t.nr] }),
  foreignKey({ columns: [t.tenantId, t.santierId], foreignColumns: [santier.tenantId, santier.id] }).onDelete("restrict"),
  doarTenantul("situatie_tenant"),
]);

/** O pagina din carnet: poza si randurile confirmate de om. Doar se adauga. */
export const masuratoare = pgTable("masuratoare", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  /** oferta | situatie */
  scop: text("scop").notNull(),
  santierId: text("santier_id"),
  poza: bytea("poza"),
  tipPoza: text("tip_poza"),
  randuri: jsonb("randuri").notNull(),
  creatDe: uuid("creat_de").references(() => utilizator.id, { onDelete: "set null" }),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("masuratoare_santier_idx").on(t.tenantId, t.santierId),
  doarTenantul("masuratoare_tenant"),
]);

/**
 * Locurile cu material. Id-ul e cel din miscari: `central`, sau id-ul
 * santierului pentru depozitul lui. Firma (S46: stoc separat, „se mai
 * amesteca"): un transfer intre depozite ale unor firme diferite se vede.
 */
export const depozit = pgTable("depozit", {
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  id: text("id").notNull(),
  denumire: text("denumire").notNull(),
  /** central | atelier | santier */
  tip: text("tip").notNull(),
  firmaId: uuid("firma_id").references(() => firma.id, { onDelete: "restrict" }),
  santierId: text("santier_id"),
  responsabil: text("responsabil"),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  doarTenantul("depozit_tenant"),
]);

/** Articolul din stoc: `Articol` din `src/stoc/registru.ts`, pe cheia lui (cu marca). */
export const articol = pgTable("articol", {
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  cheie: text("cheie").notNull(),
  sistem: text("sistem").notNull(),
  grosimeMm: numeric("grosime_mm", { precision: 8, scale: 2 }),
  rand: numeric("rand", { precision: 8, scale: 2 }),
  /** tub | saltea | placa | tabla. Null la articolele de dinainte de 11 octombrie 2026. */
  forma: text("forma"),
  /** ml | m2 */
  um: text("um").notNull(),
  marca: text("marca"),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.cheie] }),
  doarTenantul("articol_tenant"),
]);

/** Cum se cumpara un material (S13), pe cheia fara marca. */
export const ambalaj = pgTable("ambalaj", {
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  cheieBaza: text("cheie_baza").notNull(),
  unitate: text("unitate").notNull(),
  continut: numeric("continut", { precision: 12, scale: 3 }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.cheieBaza] }),
  doarTenantul("ambalaj_tenant"),
]);

/**
 * Necesarul de materiale al unei lucrari (`NecesarLucrare`). Se editeaza:
 * pierderile, materialul clientului, randurile puse de mana.
 */
export const necesar = pgTable("necesar", {
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  id: text("id").notNull(),
  santierId: text("santier_id"),
  continut: jsonb("continut").notNull(),
  actualizatLa: timestamp("actualizat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  doarTenantul("necesar_tenant"),
]);

/**
 * Miscarea de stoc. Stocul e suma lor; nimic nu se scrie peste o cifra. Nu se
 * editeaza si nu se sterge (trigger): o greseala se anuleaza cu storno.
 * `din` / `spre` sunt id-uri de depozit, fara cheie straina: depozitele
 * santierelor-exemplu din datele demo nu sunt in baza.
 */
export const miscare = pgTable("miscare", {
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  id: text("id").notNull(),
  data: timestamp("data", { withTimezone: true }).notNull(),
  /** intrare | transfer | consum | retur | ajustare */
  tip: text("tip").notNull(),
  articolCheie: text("articol_cheie").notNull(),
  cantitate: numeric("cantitate", { precision: 14, scale: 3 }).notNull(),
  din: text("din"),
  spre: text("spre"),
  lucrareId: text("lucrare_id"),
  nota: text("nota"),
  /** De ce: ajustarea la inventar, restul de la inchiderea santierului. */
  motiv: text("motiv"),
  /** Consumul calculat dintr-o situatie de lucrari (Faza 6): situatia lui. Fara cheie straina: situatia se poate sterge, consumul ramane, anulat. */
  situatieId: text("situatie_id"),
  anuleaza: text("anuleaza"),
  /** Pretul de achizitie pe unitate, EUR. */
  pret: numeric("pret", { precision: 14, scale: 4 }),
  /** Pretul in lei pe unitate si cursul cu care s-a trecut in euro, de pe document (Faza 4). */
  pretLei: numeric("pret_lei", { precision: 14, scale: 4 }),
  curs: numeric("curs", { precision: 10, scale: 4 }),
  /** Receptia: comanda si linia ei, documentul (aviz sau factura), furnizorul. */
  comandaId: text("comanda_id"),
  comandaLinie: text("comanda_linie"),
  document: jsonb("document"),
  furnizor: text("furnizor"),
  creatDe: uuid("creat_de").references(() => utilizator.id, { onDelete: "set null" }),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  foreignKey({ columns: [t.tenantId, t.articolCheie], foreignColumns: [articol.tenantId, articol.cheie] }).onDelete("restrict"),
  index("miscare_comanda_idx").on(t.tenantId, t.comandaId),
  doarTenantul("miscare_tenant"),
]);

/**
 * Comanda la furnizor (Faza 4), ca `Comanda` din `src/stoc/comenzi.ts`. Ciorna
 * se editeaza si se sterge; trimisa, nu se mai schimba (trigger), se poate doar
 * anula. Ce s-a primit nu sta aici: se socoteste din intrarile cu `comanda_id`.
 */
export const comanda = pgTable("comanda", {
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  id: text("id").notNull(),
  continut: jsonb("continut").notNull(),
  trimisaLa: timestamp("trimisa_la", { withTimezone: true }),
  anulataLa: timestamp("anulata_la", { withTimezone: true }),
  creatDe: uuid("creat_de").references(() => utilizator.id, { onDelete: "set null" }),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  doarTenantul("comanda_tenant"),
]);

/**
 * Avizul sau factura furnizorului, cum a venit: poza sau PDF-ul atasat la
 * receptie (S31). Doar se adauga (trigger): documentul primit nu se schimba.
 */
export const documentFurnizor = pgTable("document_furnizor", {
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  id: text("id").notNull(),
  comandaId: text("comanda_id").notNull(),
  /** aviz | factura */
  tip: text("tip").notNull(),
  numar: text("numar").notNull(),
  nume: text("nume").notNull(),
  tipFisier: text("tip_fisier").notNull(),
  fisier: bytea("fisier").notNull(),
  creatDe: uuid("creat_de").references(() => utilizator.id, { onDelete: "set null" }),
  creatLa: timestamp("creat_la", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.tenantId, t.id] }),
  foreignKey({ columns: [t.tenantId, t.comandaId], foreignColumns: [comanda.tenantId, comanda.id] }).onDelete("restrict"),
  doarTenantul("document_furnizor_tenant"),
]);

/** Furnizorii (S25). Comanda din Faza 4 ii foloseste. */
export const furnizor = pgTable("furnizor", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenant.id, { onDelete: "restrict" }),
  denumire: text("denumire").notNull(),
  /** Ce vinde, cum a spus firma. */
  vinde: text("vinde").notNull(),
  email: text("email"),
  telefon: text("telefon"),
}, (t) => [
  uniqueIndex("furnizor_tenant_denumire_idx").on(t.tenantId, t.denumire),
  doarTenantul("furnizor_tenant"),
]);

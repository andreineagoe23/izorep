/**
 * Datele comune, citite si scrise in contextul unui tenant. Fiecare functie
 * primeste tranzactia deschisa de `caTenant`: aici nu exista `where tenant_id`
 * (RLS il pune), doar `tenantId` la INSERT, pe care politica il verifica.
 *
 * Formele sunt cele ale browserului (`contract.ts`). Cantitatile si preturile
 * vin din `numeric` ca text si trec in `number` aici, la granita: logica din
 * `src/stoc/` si ecranele lucreaza deja cu numere rotunjite la bani. Totalul
 * ofertei se verifica pe server din liniile ei (`salveazaOferta`).
 */
import { and, asc, desc, eq, inArray, isNotNull, max, sql } from "drizzle-orm";
import type { Baza } from "../db/client.js";
import {
  ambalaj, articol, cerere, comanda, depozit, documentFurnizor, firma, masuratoare, miscare, necesar, oferta, santier,
  situatie,
} from "../db/schema.js";
import type { Situatie, PlanSantier } from "../lucrari/situatii.js";
import { valideazaMiscare, type Ambalaj, type Miscare } from "../stoc/registru.js";
import type { Categorie } from "../stoc/necesar.js";
import { anuleazaConsumSituatie, consumDinSituatie } from "../stoc/consum.js";
import {
  LOCURI_PORNIRE, ajustariInventar, estePornire, intrareDePornire, valideazaInventar, valideazaPornire,
  type Inventar, type Pornire,
} from "../stoc/inventar.js";
import {
  inlocuiesteCuFactura, intrariDinReceptie, returLaFurnizor, valideazaReceptie, valideazaRetur,
  type Comanda, type DocumentAtasat, type Factura, type Receptie, type Retur,
} from "../stoc/comenzi.js";
import { valoareOferta } from "../../web/oferta.js";
import type { NecesarLucrare, StareDepozit } from "../../web/depozit-local.js";
import type { OfertaEmisa } from "../../web/oferte-local.js";
import type { IntrareIstoric } from "../../web/istoric.js";
import type {
  CererePeFir, Context, DateComune, MasuratoareDeSalvat, Mutare, OfertaDeSalvat, OfertaSalvata, RezultatMutare,
} from "./contract.js";

/** O cerere care nu se poate face; mesajul ajunge pe ecran, deci e in romana. */
export class Refuz extends Error {
  constructor(public cod: 400 | 404 | 409, mesaj: string) { super(mesaj); }
}

const nr = (v: string | null): number | null => (v === null ? null : Number(v));
const iso = (d: Date): string => d.toISOString();

/* ------------------------------------------------------------- citirea */

export async function dateComune(tx: Baza): Promise<DateComune> {
  return { planuri: await planuri(tx), depozit: await stareDepozit(tx), oferte: await ultimeleOferte(tx) };
}

async function planuri(tx: Baza): Promise<PlanSantier[]> {
  const sant = await tx.select().from(santier).orderBy(desc(santier.creat));
  const sit = await tx.select().from(situatie).orderBy(asc(situatie.nr));
  return sant.map((s) => ({
    ...(s.plan as Omit<PlanSantier, "situatii">),
    ...(s.inchisLa ? { inchis: iso(s.inchisLa) } : {}),
    situatii: sit.filter((x) => x.santierId === s.id).map((x): Situatie => ({
      id: x.id, nr: x.nr, data: iso(x.data), cantitati: x.cantitati as Record<number, number>,
      ...(x.nota ? { nota: x.nota } : {}),
    })),
  }));
}

export async function stareDepozit(tx: Baza): Promise<StareDepozit> {
  const rows = await tx.select({ m: miscare, a: articol }).from(miscare)
    .innerJoin(articol, and(eq(articol.tenantId, miscare.tenantId), eq(articol.cheie, miscare.articolCheie)))
    .orderBy(asc(miscare.data), asc(miscare.creatLa));
  const miscari: Miscare[] = rows.map(({ m, a }) => ({
    id: m.id, data: iso(m.data), tip: m.tip as Miscare["tip"],
    articol: {
      cheie: a.cheie, sistem: a.sistem, grosime_mm: nr(a.grosimeMm), rand: nr(a.rand), um: a.um as "ml" | "m2",
      ...(a.forma ? { forma: a.forma as Categorie } : {}),
      ...(a.marca ? { marca: a.marca } : {}),
    },
    cantitate: Number(m.cantitate),
    ...(m.din ? { din: m.din } : {}),
    ...(m.spre ? { spre: m.spre } : {}),
    ...(m.lucrareId ? { lucrareId: m.lucrareId } : {}),
    ...(m.nota ? { nota: m.nota } : {}),
    ...(m.motiv ? { motiv: m.motiv } : {}),
    ...(m.situatieId ? { situatieId: m.situatieId } : {}),
    ...(m.anuleaza ? { anuleaza: m.anuleaza } : {}),
    ...(m.pret !== null ? {
      pret: { valoare: Number(m.pret), ...(m.pretLei !== null ? { lei: Number(m.pretLei) } : {}), ...(m.curs !== null ? { curs: Number(m.curs) } : {}) },
    } : {}),
    ...(m.comandaId && m.comandaLinie ? { comanda: { id: m.comandaId, linie: m.comandaLinie } } : {}),
    ...(m.document ? { document: m.document as NonNullable<Miscare["document"]> } : {}),
    ...(m.furnizor ? { furnizor: m.furnizor } : {}),
  }));
  const nec = await tx.select().from(necesar).orderBy(desc(sql`${necesar.continut}->>'creat'`));
  const amb = await tx.select().from(ambalaj);
  return {
    miscari,
    necesare: nec.map((n) => n.continut as NecesarLucrare),
    ambalaje: Object.fromEntries(amb.map((a) => [a.cheieBaza, { unitate: a.unitate, continut: Number(a.continut) }])),
    comenzi: await comenzi(tx),
    documente: await documente(tx),
    responsabili: Object.fromEntries((await tx.select({ id: depozit.id, r: depozit.responsabil }).from(depozit))
      .filter((d) => d.r).map((d) => [d.id, d.r!])),
  };
}

/**
 * Cine răspunde de un loc (S34). Centralul și atelierul se fac la nevoie (o
 * bază de dinainte de Faza 5 n-are atelier); depozitul unui șantier există
 * doar cu șantierul lui.
 */
export async function puneResponsabil(tx: Baza, ctx: Context, id: string, responsabil: string): Promise<void> {
  const r = responsabil || null;
  if (id === "central" || id === "atelier") {
    const firmaId = await firmaDupa(tx, "denumire", "RADOIA ISOLIRUNG SRL");
    await tx.insert(depozit).values({
      tenantId: ctx.tenantId, id, denumire: id === "central" ? "Depozit central" : "Atelier București", tip: id, firmaId, responsabil: r,
    }).onConflictDoUpdate({ target: [depozit.tenantId, depozit.id], set: { responsabil: r } });
    return;
  }
  const gasite = await tx.update(depozit).set({ responsabil: r }).where(eq(depozit.id, id)).returning({ id: depozit.id });
  if (gasite.length === 0) throw new Refuz(404, "Depozitul nu e pe server: șantierul nu a fost creat din ofertă.");
}

/** Lista documentelor atasate, fara fisiere: ecranul le cere unul cate unul. */
async function documente(tx: Baza): Promise<DocumentAtasat[]> {
  const rows = await tx.select({
    id: documentFurnizor.id, comanda: documentFurnizor.comandaId, tip: documentFurnizor.tip,
    numar: documentFurnizor.numar, nume: documentFurnizor.nume,
  }).from(documentFurnizor).orderBy(asc(documentFurnizor.creatLa));
  return rows.map((r) => ({ ...r, tip: r.tip as DocumentAtasat["tip"] }));
}

async function comenzi(tx: Baza): Promise<Comanda[]> {
  const rows = await tx.select().from(comanda).orderBy(desc(comanda.creatLa));
  return rows.map((r) => ({
    ...(r.continut as Comanda),
    ...(r.trimisaLa ? { trimisa: iso(r.trimisaLa) } : {}),
    ...(r.anulataLa ? { anulata: iso(r.anulataLa) } : {}),
  }));
}

async function ultimeleOferte(tx: Baza): Promise<Record<string, OfertaEmisa>> {
  // Fara `continut`: se cere la fiecare schimbare de ecran, iar liniile tuturor
  // versiunilor n-au ce cauta acolo (le da `versiuniOferta`).
  const rows = await tx.select({
    cerereId: oferta.cerereId, numar: oferta.numar, data: oferta.data, client: oferta.client,
    obiectiv: oferta.obiectiv, valoare: oferta.valoare, pozitii: oferta.pozitii, creatLa: oferta.creatLa,
  }).from(oferta).orderBy(asc(oferta.versiune));
  // In ordinea versiunilor: ultima o inlocuieste pe cea dinainte, ca `noteazaOferta`.
  return Object.fromEntries(rows.map((o) => [o.cerereId, {
    numar: o.numar, data: o.data, client: o.client, obiectiv: o.obiectiv, valoare: Number(o.valoare),
    pozitii: o.pozitii, cand: iso(o.creatLa),
  }]));
}

/* -------------------------------------------------------- cererile */

const meta = (c: typeof cerere.$inferSelect): IntrareIstoric => ({
  id: c.id, nume: c.nume, marime: c.marime, cand: iso(c.cand), model: c.model,
  pozitii: c.pozitii, tarifate: c.tarifate, valoare: Number(c.valoare),
  ...(c.destinatie ? { destinatie: c.destinatie as NonNullable<IntrareIstoric["destinatie"]> } : {}),
});

export async function listaCereri(tx: Baza): Promise<IntrareIstoric[]> {
  const rows = await tx.select({
    id: cerere.id, nume: cerere.nume, marime: cerere.marime, cand: cerere.cand, model: cerere.model,
    pozitii: cerere.pozitii, tarifate: cerere.tarifate, valoare: cerere.valoare, destinatie: cerere.destinatie,
  }).from(cerere).orderBy(desc(cerere.cand));
  return rows.map((r) => meta({ ...r, tenantId: "", fisier: Buffer.alloc(0), lucru: {}, creatDe: null, actualizatLa: r.cand }));
}

export async function citesteCerere(tx: Baza, id: string): Promise<CererePeFir | null> {
  const [c] = await tx.select().from(cerere).where(eq(cerere.id, id));
  if (!c) return null;
  return { ...meta(c), ...(c.lucru as object), fisier: c.fisier.toString("base64") } as CererePeFir;
}

/** Lucrul omului pe cerere: tot ce nu e metadata sau fisier. */
function lucruDin(c: CererePeFir): Record<string, unknown> {
  const { id: _i, nume: _n, marime: _m, cand: _c, model: _mo, pozitii: _p, tarifate: _t, valoare: _v, destinatie: _d, fisier: _f, ...lucru } = c;
  return lucru;
}

export async function salveazaCerere(tx: Baza, ctx: Context, c: CererePeFir): Promise<void> {
  const val = {
    nume: c.nume, marime: c.marime, cand: new Date(c.cand), model: c.model, destinatie: c.destinatie ?? null,
    pozitii: c.pozitii, tarifate: c.tarifate, valoare: c.valoare.toFixed(2), lucru: lucruDin(c), actualizatLa: new Date(),
  };
  if (c.fisier !== undefined) {
    await tx.insert(cerere).values({ tenantId: ctx.tenantId, id: c.id, fisier: Buffer.from(c.fisier, "base64"), creatDe: ctx.utilizatorId, ...val })
      .onConflictDoUpdate({ target: [cerere.tenantId, cerere.id], set: val });
    return;
  }
  const gasite = await tx.update(cerere).set(val).where(eq(cerere.id, c.id)).returning({ id: cerere.id });
  if (gasite.length === 0) throw new Refuz(400, "Cererea nu e pe server: trimite-o cu tot cu fișier.");
}

export async function stergeCerere(tx: Baza, id: string): Promise<void> {
  const [are] = await tx.select({ n: sql<number>`count(*)` }).from(oferta).where(eq(oferta.cerereId, id));
  if (Number(are?.n ?? 0) > 0) {
    throw new Refuz(409, "Cererea are o ofertă salvată și nu se mai șterge: oferta trimisă clientului rămâne în evidență.");
  }
  await tx.delete(cerere).where(eq(cerere.id, id));
}

/* --------------------------------------------------------- ofertele */

async function firmaDupa(tx: Baza, col: "cod" | "denumire", v: string): Promise<string | null> {
  const [f] = await tx.select({ id: firma.id }).from(firma).where(eq(col === "cod" ? firma.cod : firma.denumire, v));
  return f?.id ?? null;
}

/**
 * O versiune noua a ofertei, la „Descarca oferta”. Valoarea se socoteste aici,
 * din liniile salvate (`valoareOferta`), nu se crede din browser: suma din
 * evidenta e suma care iese din document.
 */
export async function salveazaOferta(tx: Baza, ctx: Context, cerereId: string, o: OfertaDeSalvat): Promise<OfertaSalvata> {
  const [c] = await tx.select({ id: cerere.id }).from(cerere).where(eq(cerere.id, cerereId));
  if (!c) throw new Refuz(404, "Cererea ofertei nu e pe server.");
  const { valoare, pozitii } = valoareOferta(o.continut);
  const [ultima] = await tx.select({ v: max(oferta.versiune) }).from(oferta).where(eq(oferta.cerereId, cerereId));
  const versiune = (ultima?.v ?? 0) + 1;
  const a = o.continut.antet;
  await tx.insert(oferta).values({
    tenantId: ctx.tenantId, cerereId, versiune, firmaId: await firmaDupa(tx, "cod", o.firma),
    numar: a.numar ? `${a.serie}${a.numar}` : "", data: a.data, client: a.client, obiectiv: a.obiectiv,
    valoare: valoare.toFixed(2), pozitii, continut: o.continut, creatDe: ctx.utilizatorId,
  });
  return { versiune, valoare };
}

export async function versiuniOferta(tx: Baza, cerereId: string): Promise<unknown[]> {
  return tx.select({
    versiune: oferta.versiune, numar: oferta.numar, data: oferta.data, valoare: oferta.valoare,
    mutata: oferta.mutata, creatLa: oferta.creatLa, continut: oferta.continut,
  }).from(oferta).where(eq(oferta.cerereId, cerereId)).orderBy(desc(oferta.versiune));
}

/* -------------------------------------------------------- santierele */

const planFara = (p: PlanSantier): Omit<PlanSantier, "situatii" | "inchis"> => {
  // Inchiderea sta in `santier.inchis_la` (Faza 7), nu in plan.
  const { situatii: _s, inchis: _i, ...rest } = p;
  return rest;
};

/** Santierul inchis dintre cei dati, daca e vreunul (Faza 7): nu mai primeste nimic. */
export async function santierInchis(tx: Baza, ids: readonly (string | undefined)[]): Promise<string | null> {
  const cauta = ids.filter((x): x is string => Boolean(x));
  if (cauta.length === 0) return null;
  const [s] = await tx.select({ denumire: santier.denumire }).from(santier)
    .where(and(inArray(santier.id, cauta), isNotNull(santier.inchisLa))).limit(1);
  return s?.denumire ?? null;
}

/** Santierul si depozitul lui. Planul se schimba doar cat n-are situatii (trigger). */
export async function puneSantier(tx: Baza, ctx: Context, p: PlanSantier): Promise<void> {
  const firmaId = await firmaDupa(tx, "denumire", p.firma);
  let ofertaId: string | null = null;
  if (p.cerere) {
    const [o] = await tx.select({ id: oferta.id }).from(oferta).where(eq(oferta.cerereId, p.cerere))
      .orderBy(desc(oferta.versiune)).limit(1);
    ofertaId = o?.id ?? null;
  }
  const val = { denumire: p.denumire, fisier: p.fisier, plan: planFara(p), firmaId, ofertaId };
  await tx.insert(santier).values({ tenantId: ctx.tenantId, id: p.id, creat: new Date(p.creat), ...val })
    .onConflictDoUpdate({ target: [santier.tenantId, santier.id], set: val });
  const dep = { denumire: `Șantier ${p.denumire}`, tip: "santier", firmaId, santierId: p.id };
  await tx.insert(depozit).values({ tenantId: ctx.tenantId, id: p.id, ...dep })
    .onConflictDoUpdate({ target: [depozit.tenantId, depozit.id], set: dep });
}

export async function stergeSantier(tx: Baza, id: string): Promise<void> {
  const [are] = await tx.select({ n: sql<number>`count(*)` }).from(situatie).where(eq(situatie.santierId, id));
  if (Number(are?.n ?? 0) > 0) throw new Refuz(409, "Șantierul are situații de lucrări și nu se mai șterge.");
  await tx.delete(santier).where(eq(santier.id, id));
  await tx.delete(depozit).where(and(eq(depozit.id, id), eq(depozit.tip, "santier")));
}

/**
 * Situatia noua si, in aceeasi tranzactie, consumul ei (Faza 6): calculat aici,
 * din planul, necesarul si miscarile din baza (`consumDinSituatie`), cu id-uri
 * facute din situatie, deci aceleasi ca in browser. Intoarce cate miscari de
 * consum s-au scris. La mutarea din browser (`consum: false`) consumul se
 * completeaza la final, dupa miscari (`muta`).
 */
export async function adaugaSituatie(
  tx: Baza, ctx: Context, santierId: string, s: Situatie, o: { consum: boolean } = { consum: true },
): Promise<number> {
  const inchis = await santierInchis(tx, [santierId]);
  if (inchis) throw new Refuz(409, `Șantierul ${inchis} e închis: nu mai primește situații.`);
  const [ultima] = await tx.select({ v: max(situatie.nr) }).from(situatie).where(eq(situatie.santierId, santierId));
  if (s.nr !== (ultima?.v ?? 0) + 1) {
    throw new Refuz(409, `Situația ${s.nr} nu urmează după ultima de pe server (${ultima?.v ?? 0}): a scris-o cineva între timp. Ecranul arată acum ce e pe server.`);
  }
  await tx.insert(situatie).values({
    tenantId: ctx.tenantId, santierId, nr: s.nr, id: s.id, data: new Date(s.data), cantitati: s.cantitati,
    nota: s.nota ?? null, creatDe: ctx.utilizatorId,
  });
  return o.consum ? scrieConsum(tx, ctx, santierId, s) : 0;
}

/** Consumul situatiei `s` (deja in baza): diferenta fata de ce au scris situatiile de dinainte. */
async function scrieConsum(tx: Baza, ctx: Context, santierId: string, s: Situatie): Promise<number> {
  const plan = (await planuri(tx)).find((p) => p.id === santierId);
  const [n] = await tx.select({ c: necesar.continut }).from(necesar).where(eq(necesar.santierId, santierId)).limit(1);
  if (!plan || !n) return 0;
  const { miscari } = await stareDepozit(tx);
  let scrise = 0;
  for (const m of consumDinSituatie(plan, (n.c as NecesarLucrare).materiale, miscari, s)) {
    if (await adaugaMiscare(tx, ctx, m)) scrise++;
  }
  return scrise;
}

/** Se sterge doar ultima situatie; consumul ei se anuleaza cu storno, in aceeasi tranzactie. */
export async function stergeSituatie(tx: Baza, ctx: Context, santierId: string, nrSit: number, id: string, cand: string): Promise<void> {
  const sterse = await tx.delete(situatie)
    .where(and(eq(situatie.santierId, santierId), eq(situatie.nr, nrSit), eq(situatie.id, id)))
    .returning({ nr: situatie.nr });
  if (sterse.length === 0) throw new Refuz(409, `Situația ${nrSit} s-a schimbat pe server între timp. Ecranul arată acum ce e pe server.`);
  const { miscari } = await stareDepozit(tx);
  for (const m of anuleazaConsumSituatie({ id, nr: nrSit }, miscari, cand)) await adaugaMiscare(tx, ctx, m);
}

/* ------------------------------------------------------------- stocul */

/** Miscarea, cu articolul ei. Una cu acelasi id deja scrisa nu se dubleaza. */
export async function adaugaMiscare(tx: Baza, ctx: Context, m: Miscare): Promise<boolean> {
  if (m.exemplu) throw new Refuz(400, "Datele de exemplu nu se scriu pe server.");
  const gresit = valideazaMiscare(m) ?? (estePornire(m) ? valideazaPornire({ depozit: m.spre ?? "", cantitate: m.cantitate }) : null);
  if (gresit) throw new Refuz(400, gresit);
  const inchis = await santierInchis(tx, [m.din, m.spre]);
  if (inchis) {
    // Retrimisa (aceeasi miscare, scrisa inainte de inchidere) nu e o miscare noua.
    const [exista] = await tx.select({ id: miscare.id }).from(miscare).where(eq(miscare.id, m.id));
    if (exista) return false;
    throw new Refuz(409, `Șantierul ${inchis} e închis: nu mai primește mișcări.`);
  }
  const a = m.articol;
  await tx.insert(articol).values({
    tenantId: ctx.tenantId, cheie: a.cheie, sistem: a.sistem, um: a.um, marca: a.marca ?? null, forma: a.forma ?? null,
    grosimeMm: a.grosime_mm === null ? null : String(a.grosime_mm), rand: a.rand === null ? null : String(a.rand),
  }).onConflictDoNothing();
  const nou = await tx.insert(miscare).values({
    tenantId: ctx.tenantId, id: m.id, data: new Date(m.data), tip: m.tip, articolCheie: a.cheie,
    cantitate: String(m.cantitate), din: m.din ?? null, spre: m.spre ?? null, lucrareId: m.lucrareId ?? null,
    nota: m.nota ?? null, motiv: m.motiv ?? null, situatieId: m.situatieId ?? null, anuleaza: m.anuleaza ?? null, pret: m.pret ? String(m.pret.valoare) : null,
    pretLei: m.pret?.lei !== undefined ? String(m.pret.lei) : null, curs: m.pret?.curs !== undefined ? String(m.pret.curs) : null,
    comandaId: m.comanda?.id ?? null, comandaLinie: m.comanda?.linie ?? null,
    document: m.document ?? null, furnizor: m.furnizor ?? null,
    creatDe: ctx.utilizatorId,
  }).onConflictDoNothing().returning({ id: miscare.id });
  return nou.length > 0;
}

export async function puneNecesar(tx: Baza, ctx: Context, n: NecesarLucrare): Promise<void> {
  const val = { continut: n, santierId: n.santier ?? null, actualizatLa: new Date() };
  await tx.insert(necesar).values({ tenantId: ctx.tenantId, id: n.id, ...val })
    .onConflictDoUpdate({ target: [necesar.tenantId, necesar.id], set: val });
}

export async function stergeNecesar(tx: Baza, id: string): Promise<void> {
  await tx.delete(necesar).where(eq(necesar.id, id));
}

export async function puneAmbalaj(tx: Baza, ctx: Context, cheie: string, a: Ambalaj | null): Promise<void> {
  if (!a) {
    await tx.delete(ambalaj).where(eq(ambalaj.cheieBaza, cheie));
    return;
  }
  const val = { unitate: a.unitate, continut: String(a.continut) };
  await tx.insert(ambalaj).values({ tenantId: ctx.tenantId, cheieBaza: cheie, ...val })
    .onConflictDoUpdate({ target: [ambalaj.tenantId, ambalaj.cheieBaza], set: val });
}

/* ------------------------------------------- pornirea si inventarul (Faza 8) */

/** Locul exista: centralul si atelierul mereu, un santier doar creat din oferta. */
async function locCunoscut(tx: Baza, id: string): Promise<void> {
  if (id === "central" || id === "atelier") return;
  const [d] = await tx.select({ id: depozit.id }).from(depozit).where(eq(depozit.id, id));
  if (!d) throw new Refuz(404, "Locul nu e pe server: șantierul nu a fost creat din ofertă.");
}

/**
 * Stocul de pornire: intrarea marcata, calculata aici (pretul din ultima
 * cumparare, din miscarile din baza). Retrimisa, nu se dubleaza.
 */
export async function treceStocDePornire(
  tx: Baza, ctx: Context, depozitId: string, p: Omit<Pornire, "depozit">, id: string, data: string,
): Promise<number> {
  if (!LOCURI_PORNIRE.includes(depozitId)) throw new Refuz(400, valideazaPornire({ ...p, depozit: depozitId })!);
  const { miscari } = await stareDepozit(tx);
  if (miscari.some((m) => m.id === id)) return 0;
  let m: Miscare;
  try { m = intrareDePornire({ ...p, depozit: depozitId }, miscari, id, data); } catch (e) { throw new Refuz(400, (e as Error).message); }
  return (await adaugaMiscare(tx, ctx, m)) ? 1 : 0;
}

/**
 * Inventarul unui loc: ajustarile se socotesc aici, fata de soldul din baza,
 * deci aduc locul la ce s-a numarat chiar daca un coleg a miscat ceva intre
 * timp. `ids[i]` e id-ul ajustarii liniei `i`: un inventar retrimis (id-urile
 * deja scrise) nu mai scrie nimic.
 */
export async function inventariaza(
  tx: Baza, ctx: Context, depozitId: string, inv: Omit<Inventar, "depozit">, ids: string[], data: string,
): Promise<number> {
  const tot: Inventar = { ...inv, depozit: depozitId };
  const gresit = valideazaInventar(tot);
  if (gresit) throw new Refuz(400, gresit);
  if (ids.length !== inv.numarat.length) throw new Refuz(400, "Câte un id pe fiecare material numărat.");
  await locCunoscut(tx, depozitId);
  const { miscari } = await stareDepozit(tx);
  const scrise = new Set(miscari.map((m) => m.id));
  if (ids.some((x) => scrise.has(x))) return 0;
  let n = 0;
  for (const m of ajustariInventar(miscari, tot, (i) => ids[i]!, data)) if (await adaugaMiscare(tx, ctx, m)) n++;
  return n;
}

/* ------------------------------------------------------- masuratorile */

export async function adaugaMasuratoare(tx: Baza, ctx: Context, m: MasuratoareDeSalvat): Promise<void> {
  const poza = m.poza?.match(/^data:([^;]+);base64,(.*)$/s);
  await tx.insert(masuratoare).values({
    tenantId: ctx.tenantId, scop: m.scop, santierId: m.santierId ?? null,
    poza: poza ? Buffer.from(poza[2]!, "base64") : null, tipPoza: poza?.[1] ?? null,
    randuri: m.randuri ?? [], creatDe: ctx.utilizatorId,
  });
}

/* ------------------------------------------------------------ mutarea */

/**
 * Ce era in browser, mutat o data. Ce exista deja pe server (acelasi id) nu se
 * atinge si nu se numara, deci butonul apasat de doua ori nu dubleaza nimic.
 * Datele de exemplu nu pleaca.
 */
export async function muta(tx: Baza, ctx: Context, d: Mutare): Promise<RezultatMutare> {
  const r: RezultatMutare = {
    cereri: 0, oferte: 0, santiere: 0, situatii: 0, miscari: 0, necesare: 0, ambalaje: 0, comenzi: 0, oferteFaraCerere: 0,
  };

  for (const c of d.cereri) {
    if (!c.fisier) continue;
    const nou = await tx.insert(cerere).values({
      tenantId: ctx.tenantId, id: c.id, nume: c.nume, marime: c.marime, cand: new Date(c.cand), model: c.model,
      destinatie: c.destinatie ?? null, pozitii: c.pozitii, tarifate: c.tarifate, valoare: c.valoare.toFixed(2),
      fisier: Buffer.from(c.fisier, "base64"), lucru: lucruDin(c), creatDe: ctx.utilizatorId,
    }).onConflictDoNothing().returning({ id: cerere.id });
    r.cereri += nou.length;
  }

  // Browserul tinea doar sumarul ofertei: intra ca versiune „mutata”, fara
  // linii. Liniile se refac din cerere, mutata intreaga.
  for (const [cerereId, o] of Object.entries(d.oferte)) {
    const [c] = await tx.select({ id: cerere.id }).from(cerere).where(eq(cerere.id, cerereId));
    if (!c) { r.oferteFaraCerere++; continue; }
    const [are] = await tx.select({ id: oferta.id }).from(oferta).where(eq(oferta.cerereId, cerereId)).limit(1);
    if (are) continue;
    await tx.insert(oferta).values({
      tenantId: ctx.tenantId, cerereId, versiune: 1, numar: o.numar, data: o.data, client: o.client,
      obiectiv: o.obiectiv, valoare: o.valoare.toFixed(2), pozitii: o.pozitii, mutata: true,
      creatDe: ctx.utilizatorId, creatLa: new Date(o.cand),
    });
    r.oferte++;
  }

  for (const p of d.planuri) {
    const [are] = await tx.select({ id: santier.id }).from(santier).where(eq(santier.id, p.id));
    if (!are) {
      await puneSantier(tx, ctx, p);
      r.santiere++;
    }
    const [ultima] = await tx.select({ v: max(situatie.nr) }).from(situatie).where(eq(situatie.santierId, p.id));
    for (const s of p.situatii.filter((x) => x.nr > (ultima?.v ?? 0))) {
      await adaugaSituatie(tx, ctx, p.id, s, { consum: false });
      r.situatii++;
    }
  }

  // Stornourile datelor de exemplu pleaca odata cu ele.
  const exemple = new Set(d.depozit.miscari.filter((m) => m.exemplu).map((m) => m.id));
  for (const m of d.depozit.miscari) {
    if (m.exemplu || (m.anuleaza && exemple.has(m.anuleaza))) continue;
    if (await adaugaMiscare(tx, ctx, m)) r.miscari++;
  }

  for (const n of d.depozit.necesare) {
    const nou = await tx.insert(necesar).values({ tenantId: ctx.tenantId, id: n.id, santierId: n.santier ?? null, continut: n })
      .onConflictDoNothing().returning({ id: necesar.id });
    r.necesare += nou.length;
  }

  for (const c of d.depozit.comenzi ?? []) {
    const { trimisa, anulata, ...continut } = c;
    const nou = await tx.insert(comanda).values({
      tenantId: ctx.tenantId, id: c.id, continut, creatDe: ctx.utilizatorId,
      trimisaLa: trimisa ? new Date(trimisa) : null, anulataLa: anulata ? new Date(anulata) : null,
    }).onConflictDoNothing().returning({ id: comanda.id });
    r.comenzi += nou.length;
  }
  for (const [cheie, a] of Object.entries(d.depozit.ambalaje ?? {})) {
    const nou = await tx.insert(ambalaj).values({ tenantId: ctx.tenantId, cheieBaza: cheie, unitate: a.unitate, continut: String(a.continut) })
      .onConflictDoNothing().returning({ c: ambalaj.cheieBaza });
    r.ambalaje += nou.length;
  }

  // Consumul din situatii (Faza 6), dupa ce au intrat miscarile: cel scris deja
  // in browser are aceleasi id-uri si nu se dubleaza; o situatie de dinainte de
  // Faza 6 isi primeste consumul acum, pe stocul mutat.
  for (const p of d.planuri) {
    const ultima = p.situatii.at(-1);
    if (ultima) await scrieConsum(tx, ctx, p.id, ultima);
  }
  return r;
}

/* ------------------------------------------------------------- comenzile */

async function comandaDinBaza(tx: Baza, id: string): Promise<Comanda> {
  const [r] = await tx.select().from(comanda).where(eq(comanda.id, id));
  if (!r) throw new Refuz(404, "Comanda nu există.");
  return {
    ...(r.continut as Comanda),
    ...(r.trimisaLa ? { trimisa: iso(r.trimisaLa) } : {}),
    ...(r.anulataLa ? { anulata: iso(r.anulataLa) } : {}),
  };
}

/** Ciorna: se scrie sau se rescrie cat nu e trimisa (trigger-ul o tine si el). */
export async function puneComanda(tx: Baza, ctx: Context, c: Comanda): Promise<void> {
  const [exista] = await tx.select({ t: comanda.trimisaLa, a: comanda.anulataLa }).from(comanda).where(eq(comanda.id, c.id));
  if (exista?.t || exista?.a) throw new Refuz(409, "Comanda a fost trimisă: nu se mai modifică. Fă o comandă suplimentară.");
  if (c.linii.length === 0) throw new Refuz(400, "Comanda nu are nicio linie.");
  if (c.linii.some((l) => !(l.cantitate > 0))) throw new Refuz(400, "Cantitățile de pe comandă trebuie să fie pozitive.");
  const { trimisa: _t, anulata: _a, ...continut } = c;
  await tx.insert(comanda).values({ tenantId: ctx.tenantId, id: c.id, continut, creatDe: ctx.utilizatorId })
    .onConflictDoUpdate({ target: [comanda.tenantId, comanda.id], set: { continut } });
}

export async function stergeComanda(tx: Baza, id: string): Promise<void> {
  const c = await comandaDinBaza(tx, id);
  if (c.trimisa) throw new Refuz(409, "Comanda a fost trimisă: nu se șterge, se anulează.");
  await tx.delete(comanda).where(eq(comanda.id, id));
}

export async function trimiteComanda(tx: Baza, id: string, cand: string): Promise<void> {
  const c = await comandaDinBaza(tx, id);
  if (c.anulata) throw new Refuz(409, "Comanda e anulată.");
  if (c.trimisa) return; // a doua apasare nu schimba nimic
  await tx.update(comanda).set({ trimisaLa: new Date(cand) }).where(eq(comanda.id, id));
}

export async function anuleazaComanda(tx: Baza, id: string, cand: string): Promise<void> {
  const c = await comandaDinBaza(tx, id);
  if (c.anulata) return;
  await tx.update(comanda).set({ anulataLa: new Date(cand) }).where(eq(comanda.id, id));
}

/** Id-urile vin de la browser: aceeasi receptie trimisa de doua ori nu se dubleaza. */
const dinLista = (ids: readonly string[]): (() => string) => {
  let i = 0;
  return () => {
    const id = ids[i++];
    if (!id) throw new Refuz(400, "Lipsesc id-urile mișcărilor.");
    return id;
  };
};

/**
 * Receptia: intrarile se calculeaza aici, din comanda din baza (nu din ce
 * crede browserul ca e pe ea), si se scriu toate sau niciuna.
 */
export async function receptioneaza(
  tx: Baza, ctx: Context, id: string, r: Omit<Receptie, "comanda">, ids: string[], data: string,
): Promise<number> {
  const c = await comandaDinBaza(tx, id);
  const receptie: Receptie = { ...r, comanda: c };
  const gresit = valideazaReceptie(receptie);
  if (gresit) throw new Refuz(400, gresit);
  let scrise = 0;
  for (const m of intrariDinReceptie(receptie, dinLista(ids), data)) if (await adaugaMiscare(tx, ctx, m)) scrise++;
  return scrise;
}

/** Factura venita dupa aviz: storno pe intrarile avizului si intrari noi, cu pretul ei. */
export async function treceFactura(
  tx: Baza, ctx: Context, id: string, aviz: string, f: Factura, ids: string[], data: string,
): Promise<number> {
  const c = await comandaDinBaza(tx, id);
  if (!f.document.numar.trim()) throw new Refuz(400, "Scrie numărul facturii.");
  const { miscari } = await stareDepozit(tx);
  const noi = inlocuiesteCuFactura(c, miscari, aviz, f, dinLista(ids), data);
  if (noi.length === 0) throw new Refuz(409, `Avizul ${aviz} nu are intrări pe comanda asta (sau a fost deja înlocuit).`);
  if (Object.values(f.preturi).some((p) => p.moneda === "RON") && !(f.curs && f.curs > 0)) {
    throw new Refuz(400, "Prețul e în lei: scrie cursul de pe factură.");
  }
  let scrise = 0;
  for (const m of noi) if (await adaugaMiscare(tx, ctx, m)) scrise++;
  return scrise;
}

/** Returul la furnizor: calculat aici, din comanda si miscarile din baza. */
export async function returneaza(
  tx: Baza, ctx: Context, id: string, r: Omit<Retur, "comanda">, idMiscare: string, data: string,
): Promise<number> {
  const c = await comandaDinBaza(tx, id);
  const { miscari } = await stareDepozit(tx);
  // Retrimis (aceeasi miscare deja scrisa), nu se mai valideaza: s-ar socoti cu el inclus.
  if (miscari.some((m) => m.id === idMiscare)) return 0;
  const gresit = valideazaRetur({ ...r, comanda: c }, miscari);
  if (gresit) throw new Refuz(400, gresit);
  return (await adaugaMiscare(tx, ctx, returLaFurnizor({ ...r, comanda: c }, miscari, () => idMiscare, data))) ? 1 : 0;
}

/** Poza sau PDF-ul avizului, atasat la comanda trimisa. Retrimis, nu se dubleaza. */
export async function ataseazaDocument(
  tx: Baza, ctx: Context, d: DocumentAtasat & { fisier: string },
): Promise<void> {
  const c = await comandaDinBaza(tx, d.comanda);
  if (!c.trimisa) throw new Refuz(409, "Documentul se atașează după ce comanda a fost trimisă.");
  const f = d.fisier.match(/^data:([^;]+);base64,(.*)$/s);
  if (!f) throw new Refuz(400, "Fișierul nu are forma așteptată.");
  await tx.insert(documentFurnizor).values({
    tenantId: ctx.tenantId, id: d.id, comandaId: d.comanda, tip: d.tip, numar: d.numar, nume: d.nume,
    tipFisier: f[1]!, fisier: Buffer.from(f[2]!, "base64"), creatDe: ctx.utilizatorId,
  }).onConflictDoNothing();
}

export async function fisierDocument(tx: Baza, id: string): Promise<{ nume: string; tip: string; fisier: Buffer } | null> {
  const [r] = await tx.select({ nume: documentFurnizor.nume, tip: documentFurnizor.tipFisier, fisier: documentFurnizor.fisier })
    .from(documentFurnizor).where(eq(documentFurnizor.id, id));
  return r ?? null;
}

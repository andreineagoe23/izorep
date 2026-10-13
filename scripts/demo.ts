/**
 * `npm run demo -- [adresa bazei, ca proprietar]` — starea de demo
 * (docs/plan-demo.md, direcția 2; docs/plan-pana-la-render.md, R3).
 *
 * Întâi golește datele firmei (nu și listele de prețuri, furnizorii, clienții
 * și cele două depozite din seed), deci e și resetarea. Apoi scrie, prin
 * stratul de date al browserului (`web/date.ts`) legat de serverul pornit aici,
 * în proces (`creeazaServer`), tot ce ar face un om din ecrane:
 *
 * - cererile TRANSAVIA, Matari și NISAL, importate fără model, cu ofertele lor
 *   (Oferta 284, 118.1, 118), la valorile semnate;
 * - șantierul TRANSAVIA: comanda ISOLINE de cochilii ø140 × 50, recepționată
 *   cu avizul CS 20261262 și factura CS 202627295 (documentele reale, atașate),
 *   tabla pentru zona 1 mutată din central, o situație cu consumul ei, restul
 *   tablei comandat de 9 zile și nevenit;
 * - șantierul NISAL (XXXLutz + Momax), închis: comandat, primit, executat tot,
 *   restul întors în central, costul materialului față de ofertă;
 * - stocul de pornire în central și o bucată de tablă pusă deoparte în atelier
 *   pentru TRANSAVIA.
 *
 * Trece prin aceleași verificări ca serverul (Zod, trigger-e, RLS), cu aceleași
 * id-uri și sume pe care le-ar face ecranele. Datele sunt pe o cronologie
 * relativă la ziua rulării (comanda nevenită are mereu 9 zile), cu ceasul
 * fixat pe fiecare pas (`la`).
 *
 * Fișierele clienților se citesc din `../attachments` (sau `IZOREP_ATTACHMENTS`):
 * nu sunt în repo, deci scriptul rulează de pe laptopul nostru. Adresa bazei e
 * a proprietarului (golirea cere `app.purjare`); fără ea, baza locală. Pe
 * Render: adresa externă a bazei, din pagina ei.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { sql } from "drizzle-orm";
import { alegeAplicatia, conecteaza, URL_PROPRIETAR, type Baza } from "../src/db/client.js";
import { tenant } from "../src/db/schema.js";
import { creeazaServer } from "../src/server/app.js";
import { parseFoiBuffer } from "../src/import/parse-workbook.js";
import { proceseazaRegistru, reevalueaza, type OptiuniNucleu, type Rezultat } from "../src/import/nucleu.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { mapariStatice } from "../src/import/mapari-statice.js";
import { PIERDERI_IMPLICITE, PRAG_TUB_MM, necesarDinLinii } from "../src/stoc/necesar.js";
import { articolDin, cantitateNecesara, solduri, type Articol } from "../src/stoc/registru.js";
import { ciorneDinRamas, type Comanda } from "../src/stoc/comenzi.js";
import { kgPeMp } from "../src/stoc/produse.js";
import { ultimulPretCumparat } from "../src/stoc/inventar.js";
import { pretPropus } from "../src/stoc/preturi-furnizori.js";
import { situatieNoua, valoareOferta as valoarePlan, type PlanSantier } from "../src/lucrari/situatii.js";
import type { Destinatie } from "../src/pricing/lists.js";
import { confirma } from "../web/validare.js";
import { imparte, planDinOferta, valoareOferta, type AntetOferta, type CerereOferta } from "../web/oferta.js";
import { randuriInchidere, restulPeSantier } from "../web/inchidere-vizual.js";
import type { SesiuneImport } from "../web/istoric.js";

const RADOIA = "RADOIA ISOLIRUNG SRL";
const DIR = process.env["IZOREP_ATTACHMENTS"] ?? join(import.meta.dirname, "../../attachments");
const CLIENTI = join(DIR, "clienti");
const ACHIZITII = join(DIR, "achizitii/transavia-alba-iulia");

/* ------------------------------------------------------------ baza */

const urlProprietar = process.argv[2] ?? URL_PROPRIETAR;
if (!existsSync(CLIENTI)) {
  console.error(`Lipsesc fișierele clienților: ${CLIENTI}. Scriptul rulează de pe laptopul cu ../attachments (sau IZOREP_ATTACHMENTS).`);
  process.exit(1);
}

const prop = conecteaza(urlProprietar);
const toate = await prop.db.select({ id: tenant.id, denumire: tenant.denumire }).from(tenant);
const cerut = process.env["TENANT_ID"];
const firma = cerut ? toate.find((t) => t.id === cerut) : toate.length === 1 ? toate[0] : undefined;
if (!firma) {
  console.error(toate.length === 0 ? "Baza n-are nicio firmă: rulează întâi npm run db:seed." : "Alege firma cu TENANT_ID.");
  process.exit(1);
}

/**
 * Datele firmei, fără ce pune seed-ul: listele de prețuri, furnizorii,
 * clienții, oamenii și cele două firme rămân, ca și centralul și atelierul.
 * Ca proprietar, cu `app.purjare`: singura cale pe care trigger-ele lasă
 * ștergerea în tabelele care nu se modifică (0006).
 */
async function golesteFirma(db: Baza, tenantId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.purjare', ${tenantId}, true)`);
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    // Copiii inaintea parintilor, ca in `purjeazaTenant`.
    for (const tabel of ["situatie", "anexa_santier", "masuratoare", "miscare", "document_furnizor", "comanda", "articol", "ambalaj", "necesar"]) {
      await tx.execute(sql.raw(`delete from "${tabel}" where tenant_id = '${tenantId}'`));
    }
    await tx.execute(sql`delete from depozit where tenant_id = ${tenantId} and tip = 'santier'`);
    await tx.execute(sql`update depozit set responsabil = null where tenant_id = ${tenantId}`);
    for (const tabel of ["santier", "oferta", "cerere"]) {
      await tx.execute(sql.raw(`delete from "${tabel}" where tenant_id = '${tenantId}'`));
    }
  });
}

await golesteFirma(prop.db, firma.id);
await prop.inchide();
console.log(`Golit: ${firma.denumire} (listele de prețuri au rămas).`);

// Aplicatia scrie cu rolul ei, ca serverul; fara parola lui (pe Render n-o
// avem pe laptop), cu proprietarul, supus si el RLS-ului.
const aplicatia = process.argv[2]
  ? await alegeAplicatia({ ...process.env, DATABASE_URL_PROPRIETAR: urlProprietar })
  : { url: undefined, cuProprietarul: false };
const app$ = conecteaza(aplicatia.url);
const server = creeazaServer({ db: app$.db, tenantId: firma.id });
// Stratul de date al browserului cheama `fetch("/api/...")`: aici raspunde serverul din proces.
// Un refuz are detaliile in corp; ecranul arata doar mesajul, aici se vad toate.
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const r = await server.request(input instanceof Request ? input : String(input), init);
  if (!r.ok) erori.push(`${init?.method ?? "GET"} ${String(input)}: ${r.status} ${await r.clone().text()}`);
  return r;
}) as typeof fetch;

const D = await import("../web/date.js");
const erori: string[] = [];
D.laEroare((m) => erori.push(m));
if ((await D.porneste()) !== "server") throw new Error("Serverul din proces nu a răspuns.");

/* ------------------------------------------------------------ ceasul */

const ZI = 86_400_000;
const azi = new Date();
azi.setUTCHours(0, 0, 0, 0);
/** ISO pe ziua `zile` față de azi (negativ = în urmă), la ora dată (UTC). */
const zi = (zile: number, ora = 8): string => new Date(azi.getTime() + zile * ZI + ora * 3_600_000).toISOString();
/** „27.05.2026” */
const ro = (iso: string): string => iso.slice(0, 10).split("-").reverse().join(".");

const DataReala = Date;
/**
 * Un pas pe ziua lui: funcțiile din `web/date.ts` iau data de acum (recepția,
 * închiderea, id-urile), deci ceasul se fixează pe durata pasului, până pleacă
 * toate scrierile la server.
 */
async function la(iso: string, pas: () => unknown): Promise<void> {
  const t = DataReala.parse(iso);
  class DataFixa extends DataReala {
    constructor(...a: [] | [string | number | Date]) {
      if (a.length === 0) super(t);
      else super(a[0]);
    }
    static override now(): number { return t; }
  }
  globalThis.Date = DataFixa as DateConstructor;
  try {
    const r = await pas();
    if (typeof r === "string") erori.push(r);
    await D.reimprospateaza();
  } finally {
    globalThis.Date = DataReala;
  }
  if (erori.length) throw new Error(`Pasul din ${ro(iso)} a fost refuzat:\n${erori.join("\n")}`);
}

/* ------------------------------------------------------------ importul, ca din ecran */

interface Import { ses: SesiuneImport; rez: Rezultat; destinatie: Destinatie }

/**
 * Fișierul trece prin același import ca în ecran, fără model (ca pe un
 * server fără cheie); „Confirmă toate” pune `sursa: "om"` pe pozițiile cu preț
 * de verificat, ca butonul. Cererea se salvează cu lucrul omului, deci se
 * redeschide în Import exact așa.
 */
async function importa(fisier: string, id: string, confirmaToate: boolean, destinatie: Destinatie = "rezidential"): Promise<Import> {
  const b = readFileSync(join(CLIENTI, fisier));
  const buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  const optiuni: OptiuniNucleu = {
    stoc: stocInMemorie(), mapari: mapariStatice(), destinatie,
    grosimiPropuse: new Map(), descrieriSchimbate: new Set(), preturiManuale: new Map(),
  };
  const rez = await proceseazaRegistru(await parseFoiBuffer(buf.slice(0)), optiuni);
  if (confirmaToate) {
    confirma(rez.linii.filter((l) => l.pret && l.necesitaValidare).map((l) => l.bruta.index), rez.rezolvate);
    reevalueaza(rez, optiuni);
  }
  const ses: SesiuneImport = {
    id, nume: fisier, marime: b.length, cand: new Date().toISOString(), model: null,
    pozitii: rez.statistici.liniiIzolatie, tarifate: rez.statistici.tarifate, valoare: rez.statistici.valoareTotala,
    fisier: buf,
    extrase: [...rez.rezolvate].map(([index, r]) => ({ index, extras: r.extras, sursa: r.sursa, ...(r.text !== undefined ? { text: r.text } : {}) })),
    editari: [], destinatie, grosimiPropuse: [], descrieriSchimbate: [], preturiManuale: [],
  };
  await D.salveaza(ses);
  return { ses, rez, destinatie };
}

function cerereOferta(i: Import, antet: Omit<AntetOferta, "firma" | "serie">): CerereOferta {
  return {
    linii: i.rez.linii, antet: { ...antet, serie: "RAD", firma: RADOIA },
    provenienta: { generatLa: new Date().toISOString(), destinatie: i.destinatie, model: null, sesiune: i.ses.id, fisierSursa: i.ses.nume },
  };
}

/** „Descarcă oferta”: o versiune nouă pe server, cu valoarea socotită acolo. */
async function oferta(i: Import, c: CerereOferta, asteptat: number): Promise<void> {
  const { valoare, pozitii } = valoareOferta(c);
  if (valoare !== asteptat) throw new Error(`${i.ses.nume}: oferta iese ${valoare}, semnată ${asteptat}.`);
  const a = c.antet;
  await D.salveazaOferta(i.ses.id, "radoia", c, {
    numar: `${a.serie}${a.numar}`, data: a.data, client: a.client, obiectiv: a.obiectiv, valoare, pozitii, cand: new Date().toISOString(),
  });
}

/** „Creează șantierul”: planul din ofertă și necesarul lui, pe depozitul șantierului. */
function santier(i: Import, oferta: CerereOferta, id: string, tuburiPeste: number[] = []): PlanSantier {
  // Ca formularul din ecran: oferta e refacuta acum, deci planul e „creat” azi.
  const c = { ...oferta, provenienta: { ...oferta.provenienta, generatLa: new Date().toISOString() } };
  const plan = planDinOferta(c, id, new Map(i.rez.brute.map((b) => [b.index, b.sectiune ?? ""])));
  D.scriePlanuri([plan, ...D.citestePlanuri()]);
  const n = necesarDinLinii(imparte(i.rez.linii).oferta, {
    pierderi: PIERDERI_IMPLICITE, pragTub: PRAG_TUB_MM, tuburiPeste, discountProcent: c.antet.discountProcent ?? 0,
  });
  const st = D.citesteDepozit();
  D.scrieDepozit({ ...st, necesare: [{
    id: `N-${id}`, creat: new Date().toISOString(), fisier: i.ses.nume, obiectiv: plan.denumire,
    pierderi: n.pierderi, pragTub: n.pragTub, tuburiPeste: n.tuburiPeste, materiale: n.materiale,
    faraNecesar: n.faraNecesar.length, santier: plan.id,
  }, ...st.necesare] });
  return plan;
}

const necesarul = (planId: string) => {
  const n = D.citesteDepozit().necesare.find((x) => x.santier === planId);
  if (!n) throw new Error(`Șantierul ${planId} n-are necesar.`);
  return n;
};
const planul = (id: string): PlanSantier => D.citestePlanuri().find((p) => p.id === id)!;

/** Fișierul atașat comenzii (avizul, factura), ca din zona „Citește avizul”. */
function ataseaza(comanda: string, tip: "aviz" | "factura", numar: string, fisier: string): void {
  const cale = join(ACHIZITII, fisier);
  if (!existsSync(cale)) return;
  D.ataseazaDocument({ id: `doc-${numar}`, comanda, tip, numar, nume: fisier, fisier: `data:application/pdf;base64,${readFileSync(cale).toString("base64")}` });
}

/* ------------------------------------------------------------ starea */

const cochilie140 = articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 140 });
const tabla08 = articolDin({ sistem: "tabla", grosime_mm: 0.8, rand: null });

// Cererile, cu numărul și data ofertelor semnate pe antet (118 și 118.1 din 27.04, 284 din 27.05.2026).
let nisal!: Import, matari!: Import, transavia!: Import;
let cNisal!: CerereOferta, cMatari!: CerereOferta, cTransavia!: CerereOferta;

await la(zi(-70), async () => { nisal = await importa("oferta-118-nisal.xlsx", "demo-nisal", false); });
await la(zi(-70, 11), async () => {
  cNisal = cerereOferta(nisal, { numar: "118", data: "27.04.2026", persoana: "Alina Matieș", client: "NISAL SRL", obiectiv: "XXXLutz + Momax Balotești", localitate: "BALOTESTI" });
  await oferta(nisal, cNisal, 163979.93);
});
await la(zi(-69), async () => { matari = await importa("oferta-118-1-matari-goluri-foc.xlsx", "demo-matari", false); });
await la(zi(-69, 11), async () => {
  cMatari = cerereOferta(matari, { numar: "118.1", data: "27.04.2026", persoana: "Alina Matieș", client: "NISAL SRL", obiectiv: "Mătari: închideri goluri la foc", localitate: "MATARI" });
  await oferta(matari, cMatari, 12692.04);
});
await la(zi(-40), async () => { transavia = await importa("cerere-de-oferta-transavia-abur.xlsx", "demo-transavia", true); });
await la(zi(-40, 11), async () => {
  cTransavia = cerereOferta(transavia, { numar: "284", data: "27.05.2026", persoana: "Vlad Emil", client: "Grup Energoinstal SA", obiectiv: "TRANSAVIA ALBA-IULIA", localitate: "PALTINIS" });
  // Oferta 284: 94.575,06 € lucrările, apoi discountul de 3 % pentru plata în termen.
  if (valoareOferta(cTransavia).valoare !== 94575.06) throw new Error(`TRANSAVIA iese ${valoareOferta(cTransavia).valoare}, nu 94.575,06.`);
  cTransavia = { ...cTransavia, antet: { ...cTransavia.antet, discountProcent: 3,
    discountConditie: "PENTRU PLATA FACTURII FISCALE IN TERMEN DE 5-7 ZILE CALENDARISTICE DE LA DATA EMITERII" } };
  await oferta(transavia, cTransavia, 91737.81);
});

// Stocul de pornire: ce era deja în central când a pornit aplicația.
await la(zi(-30), () => {
  for (const [articol, cantitate] of [
    [tabla08, 400], [articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 114 }), 40],
    [articolDin({ sistem: "elastomer", grosime_mm: 19, rand: 22 }), 30],
  ] as [Articol, number][]) {
    const r = D.treceStocDePornire({ depozit: "central", articol, cantitate, nota: "numărat la pornire" });
    if (r) return r;
  }
  return null;
});

/**
 * EUR pe unitatea articolului, din evidența de cumpărări. Unde firma n-a
 * cumpărat chiar articolul (tabla de 0,6, cochilia ø114 × 40), cel mai
 * apropiat: tabla are același preț pe kg la altă grosime, cochilia aceeași
 * țeavă la altă grosime. Doar pentru demo: în lucru, prețul e cel de pe factură.
 */
function pretDinEvidenta(a: Articol): number | undefined {
  const direct = ultimulPretCumparat(a)?.pret.valoare;
  if (direct) return direct;
  const kg = kgPeMp(a);
  if (kg) {
    const alta = { ...a, grosime_mm: 0.8 };
    const p = ultimulPretCumparat(alta)?.pret.valoare;
    return p ? Math.round((p / kgPeMp(alta)!) * kg * 10000) / 10000 : undefined;
  }
  for (const g of [50, 30, 60, 40, 80, 100]) {
    const p = ultimulPretCumparat({ ...a, grosime_mm: g })?.pret.valoare;
    if (p) return p;
  }
  return undefined;
}

/* NISAL: șantierul închis. Comandat tot, primit pe facturi, executat tot, restul înapoi în central. */
await la(zi(-60), () => { santier(nisal, cNisal, "S-NISAL-LUTZ"); });
let comenziNisal: Comanda[] = [];
await la(zi(-58, 10), async () => {
  const st = D.citesteDepozit();
  const { ramasPeNecesar } = await import("../web/ecrane/stoc.js");
  comenziNisal = ciorneDinRamas(ramasPeNecesar(st, necesarul("S-NISAL-LUTZ")),
    { firma: RADOIA, spre: "S-NISAL-LUTZ", santier: "S-NISAL-LUTZ" }, D.idNou, new Date().toISOString(),
    (a, f) => pretPropus(a, f, st.miscari));
  for (const c of comenziNisal) { const r = D.puneComanda(c); if (r) return r; }
  for (const c of comenziNisal) D.trimiteComanda(c.id);
  return null;
});
await la(zi(-52, 9), () => {
  let n = 0;
  for (const c of comenziNisal) {
    const linii = c.linii.map((l) => {
      // Factura e pe unitatea documentului: tabla la kg. Rotunjit in sus, ca
      // inapoi in m² sa nu iasa sub cat s-a comandat (comanda ar ramane „in parte”).
      const kg = kgPeMp(l.articol);
      // Unde furnizorul n-are pret (Banda Tech nu vinde tabla), ultimul pret
      // cumparat din evidenta firmei, ca la stocul de pornire.
      const dinEvidenta = pretDinEvidenta(l.articol);
      const pret = l.pret ? { valoare: l.pret.valoare, moneda: l.pret.moneda }
        : dinEvidenta ? { valoare: Math.round((kg ? dinEvidenta / kg : dinEvidenta) * 10000) / 10000, moneda: "EUR" as const } : undefined;
      return { linie: l.id, cantitate: kg ? Math.ceil(l.cantitate * kg * 100) / 100 : l.cantitate, ...(pret ? { pret } : {}) };
    });
    const curs = c.linii.find((l) => l.pret?.moneda === "RON")?.pret?.curs ?? 5.05;
    const r = D.receptioneaza(c.id, { document: { tip: "factura", numar: `F-NISAL-${++n}`, data: zi(-52).slice(0, 10) }, curs, linii });
    if (r) return `${c.furnizor}: ${r}`;
  }
  return null;
});
await la(zi(-9), () => {
  const p = planul("S-NISAL-LUTZ");
  const s = situatieNoua(p, D.idNou(), new Date().toISOString());
  const r = D.salveazaSituatie(p.id, { ...s, cantitati: Object.fromEntries(p.pozitii.map((x) => [x.nr, x.cantitate])), nota: "Tot restul" });
  return "eroare" in r ? r.eroare : null;
});
await la(zi(-6, 15), () => {
  const p = planul("S-NISAL-LUTZ");
  const { stoc } = restulPeSantier(p, D.citestePlanuri(), D.citesteDepozit());
  // Seful de lucrare numara ce a ramas si il trimite inapoi in central (implicit).
  return D.inchideSantier(p.id, randuriInchidere(stoc, {}), (k) => stoc.find((r) => r.cheie === k)?.nume ?? k);
});

/* TRANSAVIA: șantierul în lucru. */
await la(zi(-30, 10), () => { santier(transavia, cTransavia, "S-TRANSAVIA", [114, 140, 168]); });
const COMANDA_ISOLINE = "C-ISOLINE-140";
await la(zi(-14, 10), () => {
  // Comanda reală din emailul firmei: cochilii caserate ø140 × 50, 350 m, pe RADOIA.
  const r = D.puneComanda({
    id: COMANDA_ISOLINE, creat: new Date().toISOString(), furnizor: "Isoline", firma: RADOIA,
    santier: "S-TRANSAVIA", spre: "S-TRANSAVIA", linii: [{ id: "L1", articol: cochilie140, cantitate: 350 }],
  });
  if (r) return r;
  D.trimiteComanda(COMANDA_ISOLINE);
  return null;
});
await la(zi(-10, 9), () => {
  const r = D.receptioneaza(COMANDA_ISOLINE, { document: { tip: "aviz", serie: "CS", numar: "20261262", data: zi(-10).slice(0, 10) }, linii: [{ linie: "L1", cantitate: 350 }] });
  if (r) return r;
  ataseaza(COMANDA_ISOLINE, "aviz", "20261262", "aviz-isoline-cs-20261262.pdf");
  return null;
});
await la(zi(-7, 9), () => {
  const r = D.treceFactura(COMANDA_ISOLINE, "20261262", {
    document: { tip: "factura", serie: "CS", numar: "202627295", data: zi(-7).slice(0, 10) }, curs: 5.31,
    preturi: { L1: { valoare: 39.7719, moneda: "RON" } },
  });
  if (r) return r;
  ataseaza(COMANDA_ISOLINE, "factura", "202627295", "factura-isoline-cs-202627295.pdf");
  return null;
});
// Tabla pentru zona 1 vine din central („Mută … pe șantier” din Depozit), cât era în stoc.
const TABLA_DIN_CENTRAL = 260;
await la(zi(-12, 10), () => {
  const st = D.citesteDepozit();
  return D.scrieDepozit({ ...st, miscari: [...st.miscari, {
    id: D.idNou(), data: new Date().toISOString(), tip: "transfer", articol: tabla08, cantitate: TABLA_DIN_CENTRAL,
    din: "central", spre: "S-TRANSAVIA", nota: "pentru TRANSAVIA ALBA-IULIA",
  }] }) ? null : "Transferul pe șantier nu s-a scris.";
});
// Restul tablei: comandat de 9 zile, nevenit — alerta de pe tablou.
await la(zi(-9, 11), () => {
  const m = necesarul("S-TRANSAVIA").materiale.find((x) => articolDin(x).cheie === tabla08.cheie);
  const cantitate = Math.ceil(((m ? cantitateNecesara(m) : 900) - TABLA_DIN_CENTRAL) / 10) * 10;
  const r = D.puneComanda({
    id: "C-TABLA-TRANSAVIA", creat: new Date().toISOString(), furnizor: "Banda Tech", firma: RADOIA,
    santier: "S-TRANSAVIA", spre: "S-TRANSAVIA", linii: [{ id: "L1", articol: tabla08, cantitate }],
  });
  if (r) return r;
  D.trimiteComanda("C-TABLA-TRANSAVIA");
  return null;
});
// Prima situație: o parte din conductele ø140 × 50, cât acoperă cochiliile venite.
await la(zi(-2, 16), () => {
  const p = planul("S-TRANSAVIA");
  const m = necesarul("S-TRANSAVIA").materiale.find((x) => articolDin(x).cheie === cochilie140.cheie);
  if (!m) return "Necesarul TRANSAVIA n-are cochilii ø140 × 50.";
  const pe = m.pePozitie.map((x) => [x.pozitie, x.peUnitate] as const);
  const total = pe.reduce((s, [nr, q]) => s + q * (p.pozitii.find((x) => x.nr === nr)?.cantitate ?? 0), 0);
  const parte = Math.min(0.8, 300 / total);
  const cantitati = Object.fromEntries(pe.map(([nr]) => {
    const poz = p.pozitii.find((x) => x.nr === nr)!;
    return [nr, Math.floor(poz.cantitate * parte)];
  }).filter(([, q]) => (q as number) > 0));
  const s = situatieNoua(p, D.idNou(), new Date().toISOString());
  const r = D.salveazaSituatie(p.id, { ...s, cantitati, nota: "Conductele ø140, zona 1" });
  return "eroare" in r ? r.eroare : null;
});
// Tabla pusă deoparte în atelier pentru TRANSAVIA, cu ce a cerut șeful de șantier.
await la(zi(-1, 10), () => {
  const st = D.citesteDepozit();
  return D.scrieDepozit({ ...st, miscari: [...st.miscari, {
    id: D.idNou(), data: new Date().toISOString(), tip: "transfer", articol: tabla08, cantitate: 12,
    din: "central", spre: "atelier", lucrareId: "S-TRANSAVIA", nota: "10 ml ø140, 3 coturi, 10 carcase",
  }] }) ? null : "Transferul în atelier nu s-a scris.";
});

/* ------------------------------------------------------------ ce a ieșit */

const date = await (await server.request("/api/date")).json() as {
  planuri: PlanSantier[]; oferte: Record<string, { numar: string; valoare: number }>;
  depozit: { miscari: Parameters<typeof solduri>[0]; comenzi?: Comanda[] };
};
const eur = (n: number): string => `${n.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
console.log("Starea de demo:");
for (const o of Object.values(date.oferte)) console.log(`  oferta ${o.numar}: ${eur(o.valoare)}`);
for (const p of date.planuri) console.log(`  șantierul ${p.denumire}: ${eur(valoarePlan(p).total)}, ${p.situatii.length} situații${p.inchis ? ", închis" : ""}`);
console.log(`  ${date.depozit.miscari.length} mișcări de stoc, ${date.depozit.comenzi?.length ?? 0} comenzi`);
console.log(`Cererile au fost citite din ${basename(DIR)}/clienti.`);
await app$.inchide();

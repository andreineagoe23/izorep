/**
 * Faza 8, pornirea (`src/stoc/inventar.ts`, `web/evidenta-santier.ts`, rutele
 * `/api/depozite/:id/pornire` și `/api/depozite/:id/inventar`).
 *
 * Gata când:
 * 1. Pe depozitul central: stocul de pornire se trece fără inventar complet,
 *    marcat (jurnal, drum, nu e în evidența cumpărărilor), iar inventarul
 *    numărat aduce, prin ajustări cu motiv, soldul la ce s-a numărat; ce nu
 *    s-a numărat rămâne neatins.
 * 2. Pe șantierul TRANSAVIA: Excelul evidenței se descarcă, iar cifrele lui ies
 *    din mișcări: rândul facturii ISOLINE e cel din evidența firmei, iar
 *    „Sold pe material” e soldul aplicației.
 * 3. Doar șantierele noi (S48): stocul de pornire nu intră pe un șantier, nici
 *    pe server, iar ce e calculat pe server nu se dublează la retrimitere.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import {
  MOTIV_PORNIRE, ajustariInventar, estePornire, intrareDePornire, rezumatInventar, ultimulPretCumparat,
  valideazaInventar, type Inventar,
} from "../src/stoc/inventar.js";
import { inlocuiesteCuFactura, intrariDinReceptie, type Comanda } from "../src/stoc/comenzi.js";
import { articolDin, solduri, storno, type Miscare } from "../src/stoc/registru.js";
import { drumul } from "../src/stoc/locuri.js";
import { randuriEvidenta } from "../web/comanda-excel.js";
import {
  CAPETE_EVIDENTA_SANTIER, evidentaSantier, registruEvidentaSantier, valoareEur,
} from "../web/evidenta-santier.js";
import type { PreturiFurnizori } from "../src/stoc/preturi-furnizori.js";
import { caTenant, conecteaza, purjeazaTenant, URL_PROPRIETAR } from "../src/db/client.js";
import { firma, tenant } from "../src/db/schema.js";
import { creeazaServer, ANTET_CSRF } from "../src/server/app.js";
import type { DateComune } from "../src/server/contract.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";

let n = 0;
const id = (): string => `p${++n}`;
const cochilie = articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 140 });
const tabla = articolDin({ sistem: "tabla", grosime_mm: 0.8, rand: null });
const elastomer = articolDin({ sistem: "elastomer", grosime_mm: 19, rand: 22 });
const ZI = "2026-10-12T08:00:00.000Z";
const sold = (m: readonly Miscare[], depozit: string, cheie: string): number =>
  solduri(m).find((s) => s.depozit === depozit && s.articol.cheie === cheie)?.cantitate ?? 0;

describe("stocul de pornire, pe depozitul central (S48)", () => {
  it("intrare marcată, cu prețul ultimei cumpărări: Isoline 47,4544 lei / 5,32 = 8,92 €/ml", () => {
    const m = intrareDePornire({ depozit: "central", articol: cochilie, cantitate: 120 }, [], "a", ZI);
    expect(m).toMatchObject({ tip: "intrare", spre: "central", cantitate: 120, motiv: MOTIV_PORNIRE });
    expect(m.pret).toEqual({ valoare: 8.92, lei: 47.4544, curs: 5.32 });
    expect(m.nota).toBe("preț din ultima cumpărare: Isoline, factura 202627580 din 03.09.2026");
    expect(estePornire(m)).toBe(true);
    expect(m.furnizor).toBeUndefined();
  });

  it("tabla: prețul evidenței e pe kg, stocul pe m² (0,8 mm = 2,16 kg/m²)", () => {
    // STEELMET, 23,63 lei/kg, curs 5,2508 → 51,0408 lei/m² → 9,7206 €/m².
    const p = ultimulPretCumparat(tabla)!;
    expect(p.pret.lei).toBe(51.0408);
    expect(p.pret.valoare).toBeCloseTo(9.7206, 4);
    // Un rând în lei fără curs pe document nu se trece în euro cu un curs inventat.
    const surse: PreturiFurnizori = { generat: "", surse: [], preturi: {
      [cochilie.cheie]: [{ furnizor: "X", valoare: 50, moneda: "RON", data: "2026-10-01", sursa: "factura 1" }],
    } };
    expect(ultimulPretCumparat(cochilie, [], surse)).toBeNull();
  });

  it("o factură trecută în aplicație, mai nouă decât evidența, dă prețul; alt stoc de pornire nu", () => {
    const factura: Miscare = { id: "f", data: "2026-10-01T08:00:00.000Z", tip: "intrare", articol: cochilie, cantitate: 10, spre: "S-X",
      furnizor: "Isoline", pret: { valoare: 9.1 }, document: { tip: "factura", serie: "CS", numar: "1", data: "2026-10-01" } };
    const pornire = intrareDePornire({ depozit: "central", articol: cochilie, cantitate: 5, pret: 99 }, [], "z", "2026-10-05T08:00:00.000Z");
    expect(ultimulPretCumparat(cochilie, [factura, pornire])).toMatchObject({ pret: { valoare: 9.1 }, sursa: "Isoline, factura CS 1 din 01.10.2026" });
  });

  it("prețul scris de om bate evidența; fără nicio cumpărare, fără preț", () => {
    expect(intrareDePornire({ depozit: "central", articol: cochilie, cantitate: 1, pret: 7 }, [], "b", ZI).pret).toEqual({ valoare: 7 });
    const nou = articolDin({ sistem: "elastomer", grosime_mm: 32, rand: 219 });
    expect(intrareDePornire({ depozit: "atelier", articol: nou, cantitate: 1 }, [], "c", ZI, { generat: "", surse: [], preturi: {} }).pret)
      .toBeUndefined();
  });

  it("nu se trece pe un șantier: șantierele noi pornesc fără material", () => {
    expect(() => intrareDePornire({ depozit: "S-TRANSAVIA", articol: cochilie, cantitate: 5 }, [], "d", ZI))
      .toThrow("Stocul de pornire se trece doar în depozitul central sau în atelier");
    expect(() => intrareDePornire({ depozit: "central", articol: cochilie, cantitate: 0 }, [], "e", ZI)).toThrow("pozitiv");
  });

  it("nu e o cumpărare: nu intră în evidența cumpărărilor; în drum se vede ca stoc de pornire", () => {
    const p = intrareDePornire({ depozit: "central", articol: cochilie, cantitate: 120 }, [], "g", "2026-10-12T08:00:00.000Z");
    const t: Miscare = { id: "t", data: "2026-10-13T08:00:00.000Z", tip: "transfer", articol: cochilie, cantitate: 60, din: "central", spre: "S-TRANSAVIA" };
    expect(randuriEvidenta([p, t], () => "DEPOZIT")).toEqual([]);
    expect(drumul([p, t], cochilie.cheie, "S-TRANSAVIA").map((x) => [x.din, x.spre, x.cantitate]))
      .toEqual([["stoc de pornire", "central", 120], ["central", "S-TRANSAVIA", 60]]);
  });
});

describe("inventarul pe depozit: ajustări cu motiv (S45)", () => {
  // Pornirea: cochilii și tablă trecute ca stoc de pornire, elastomer de la furnizor. Fără inventar complet.
  const pornire: Miscare[] = [
    intrareDePornire({ depozit: "central", articol: cochilie, cantitate: 120 }, [], "i1", ZI),
    intrareDePornire({ depozit: "central", articol: tabla, cantitate: 50 }, [], "i2", ZI),
    { id: "i3", data: ZI, tip: "intrare", articol: elastomer, cantitate: 30, spre: "central", furnizor: "Banda Tech" },
  ];
  const numarat: Inventar = {
    depozit: "central", motiv: "furat", nota: "numărat de Ion",
    numarat: [{ articol: cochilie, cantitate: 112 }, { articol: tabla, cantitate: 50 }],
  };

  it("Gata când: ajustările aduc soldul la numărat; ce nu s-a numărat rămâne neatins", () => {
    const aj = ajustariInventar(pornire, numarat, (i) => `aj${i}`, "2026-10-20T08:00:00.000Z");
    expect(aj).toEqual([{
      id: "aj0", data: "2026-10-20T08:00:00.000Z", tip: "ajustare", articol: cochilie, cantitate: -8, spre: "central",
      motiv: "furat", nota: "inventar: numărat 112, aplicația arăta 120 · numărat de Ion",
    }]);
    const dupa = [...pornire, ...aj];
    expect(sold(dupa, "central", cochilie.cheie)).toBe(112);
    expect(sold(dupa, "central", tabla.cheie)).toBe(50);
    expect(sold(dupa, "central", elastomer.cheie)).toBe(30);
    expect(rezumatInventar(pornire, numarat, aj)).toEqual({ ajustate: 1, laFel: 1, nenumarate: 1 });
    // Numărat din nou, la fel: nimic de ajustat (un inventar retrimis nu dublează).
    expect(ajustariInventar(dupa, numarat, id, ZI)).toEqual([]);
  });

  it("material găsit, pe care aplicația nu-l arăta: ajustare în plus; motivul poate fi pe linie", () => {
    const aj = ajustariInventar(pornire, {
      depozit: "central", motiv: "furat",
      numarat: [{ articol: articolDin({ sistem: "vata_minerala", grosime_mm: 30, rand: 60 }), cantitate: 5.5, motiv: "găsit în plus" }],
    }, (i) => `g${i}`, ZI);
    expect(aj.map((m) => [m.cantitate, m.motiv])).toEqual([[5.5, "găsit în plus"]]);
  });

  it("pe orice loc, și pe un șantier (inventarul de la închidere, Faza 7): numărat zero = tot restul", () => {
    const pe: Miscare[] = [{ id: "s1", data: ZI, tip: "transfer", articol: cochilie, cantitate: 40, din: "central", spre: "S-TRANSAVIA" }];
    const aj = ajustariInventar(pe, { depozit: "S-TRANSAVIA", motiv: "dus la reciclat", numarat: [{ articol: cochilie, cantitate: 0 }] }, id, ZI);
    expect(aj.map((m) => [m.spre, m.cantitate, m.motiv])).toEqual([["S-TRANSAVIA", -40, "dus la reciclat"]]);
    expect(sold([...pe, ...aj], "S-TRANSAVIA", cochilie.cheie)).toBe(0);
  });

  it("o ajustare greșită se anulează cu mișcarea inversă, nu se șterge", () => {
    const aj = ajustariInventar(pornire, numarat, id, ZI);
    const inv = storno(aj[0]!, [...pornire, ...aj], "st", ZI)!;
    expect(sold([...pornire, ...aj, inv], "central", cochilie.cheie)).toBe(120);
  });

  it("fără motiv, cu cifre negative sau cu același material de două ori: nu se trece", () => {
    expect(valideazaInventar({ ...numarat, motiv: " " })).toMatch(/motivul/);
    expect(valideazaInventar({ ...numarat, numarat: [{ articol: cochilie, cantitate: -1 }] })).toMatch(/zero sau mai mare/);
    expect(valideazaInventar({ ...numarat, numarat: [{ articol: cochilie, cantitate: 1 }, { articol: cochilie, cantitate: 2 }] }))
      .toMatch(/de două ori/);
    expect(valideazaInventar({ ...numarat, numarat: [] })).toMatch(/cel puțin/);
    expect(() => ajustariInventar(pornire, { ...numarat, motiv: "" }, id, ZI)).toThrow();
  });
});

describe("evidența materialului pe șantierul TRANSAVIA, în Excel", () => {
  // Lanțul real ISOLINE (Faza 4): aviz CS 20261262, apoi factura CS 202627295, 350 ml pe șantier.
  const c: Comanda = {
    id: "C1", creat: "2026-07-13T10:37:00.000Z", trimisa: "2026-07-13T10:40:00.000Z", furnizor: "ISOLINE SRL",
    firma: "RADOIA ISOLIRUNG SRL", santier: "S-TRANSAVIA", spre: "S-TRANSAVIA", linii: [{ id: "L1", articol: cochilie, cantitate: 350 }],
  };
  const aviz = intrariDinReceptie({ comanda: c, document: { tip: "aviz", serie: "CS", numar: "20261262", data: "2026-07-17" },
    linii: [{ linie: "L1", cantitate: 350 }] }, id, "2026-07-17T08:00:00.000Z");
  const factura = inlocuiesteCuFactura(c, aviz, "20261262", { document: { tip: "factura", serie: "CS", numar: "202627295", data: "2026-07-20" },
    curs: 5.31, preturi: { L1: { valoare: 39.7719, moneda: "RON" } } }, id, "2026-07-20T08:00:00.000Z");
  const pornire = intrareDePornire({ depozit: "central", articol: cochilie, cantitate: 120 }, [], "pc", "2026-07-21T08:00:00.000Z");
  const tablaPornire = intrareDePornire({ depozit: "central", articol: tabla, cantitate: 30, pret: 9.72 }, [], "pt", "2026-07-21T08:00:00.000Z");
  const restul: Miscare[] = [
    { id: "tr", data: "2026-07-22T08:00:00.000Z", tip: "transfer", articol: cochilie, cantitate: 60, din: "central", spre: "S-TRANSAVIA" },
    { id: "tt", data: "2026-07-22T09:00:00.000Z", tip: "transfer", articol: tabla, cantitate: 12, din: "central", spre: "S-TRANSAVIA" },
    { id: "co", data: "2026-08-10T08:00:00.000Z", tip: "consum", articol: cochilie, cantitate: 300, din: "S-TRANSAVIA", nota: "situația 1" },
    { id: "re", data: "2026-08-20T08:00:00.000Z", tip: "retur", articol: cochilie, cantitate: 20, din: "S-TRANSAVIA", spre: "central" },
    // O mișcare pe alt șantier nu are ce căuta în evidența TRANSAVIA.
    { id: "alt", data: "2026-08-21T08:00:00.000Z", tip: "transfer", articol: cochilie, cantitate: 10, din: "central", spre: "S-ALT" },
  ];
  const inainte = [...aviz, ...factura, pornire, tablaPornire, ...restul];
  const inventar = ajustariInventar(inainte, { depozit: "S-TRANSAVIA", motiv: "pierdut", numarat: [{ articol: cochilie, cantitate: 85 }] },
    () => "inv", "2026-09-01T08:00:00.000Z");
  const toate = [...inainte, ...inventar];
  const nume = (x: string): string => ({ central: "Depozit central", "S-TRANSAVIA": "Șantier TRANSAVIA" }[x] ?? x);
  const e = evidentaSantier(toate, "S-TRANSAVIA", "TRANSAVIA ALBA IULIA", nume);

  it("intrarea de la furnizor iese exact ca în evidența cumpărărilor (13 coloane), cu avizul înlocuit de factură", () => {
    expect(e.miscari[0]!.slice(0, 13)).toEqual(randuriEvidenta(toate, () => "TRANSAVIA ALBA IULIA")[0]);
    expect(e.miscari[0]).toEqual(["ISOLINE SRL", "TRANSAVIA ALBA IULIA", "202627295", "20.07.2026", "COCHILII CASERATE Ø140 X 50 MM",
      350, "ML", 39.7719, 5.31, 7.49, 13920.17, 2621.5, "20261262", "intrare de la furnizor", "ISOLINE SRL", "factura CS 202627295 (aviz 20261262)"]);
    expect(e.miscari).toHaveLength(6);
  });

  it("transferul, consumul, returul și ajustarea: cu semn, la prețul mediu (S44), cu de unde și motiv", () => {
    // Prețul mediu al cochiliei: factura 7,49 × 350 și stocul de pornire 8,92 × 120 → 7,8551 €/ml.
    const pm = (7.49 * 350 + 8.92 * 120) / 470;
    const [, tr, tt, co, re, aj] = e.miscari;
    expect(tr!.slice(5, 7)).toEqual([60, "ML"]);
    expect(tr![9]).toBeCloseTo(pm, 4);
    expect(tr![11]).toBe(Math.round(Math.round(pm * 10000) / 10000 * 60 * 100) / 100);
    expect(tr!.slice(13)).toEqual(["transfer pe șantier", "din Depozit central", null]);
    // Tabla vine la kg, ca în evidența lor: 12 m² × 2,16 = 25,92 kg; 9,72 €/m² = 4,5 €/kg.
    expect(tt!.slice(5, 10)).toEqual([25.92, "KG", null, null, 4.5]);
    expect(co!.slice(5, 7)).toEqual([-300, "ML"]);
    expect(co!.slice(13)).toEqual(["consum", null, "situația 1"]);
    expect(re!.slice(13)).toEqual(["retur de pe șantier", "spre Depozit central", null]);
    expect(aj!.slice(5, 7)).toEqual([-5, "ML"]);
    expect(aj!.slice(13)).toEqual(["ajustare la inventar", null, "pierdut"]);
  });

  it("Gata când: „Sold pe material” e soldul din aplicație, iar cantitățile cu semn se adună la el", () => {
    expect(sold(toate, "S-TRANSAVIA", cochilie.cheie)).toBe(85);
    expect(e.sold).toEqual([
      ["COCHILII CASERATE Ø140 X 50 MM", "ML", 410, 300, 20, -5, 85],
      ["TABLĂ ALUMINIU 0,8 MM", "MP", 12, 0, 0, 0, 12],
    ]);
    const cochilii = e.miscari.filter((r) => r[6] === "ML").reduce((t, r) => t + (r[5] as number), 0);
    expect(cochilii).toBe(85);
    expect(valoareEur(e)).toBeGreaterThan(0);
  });

  it("registrul are cele două foi, cu capetele evidenței firmei în față", async () => {
    const buf = await registruEvidentaSantier(e, "TRANSAVIA ALBA IULIA");
    const { default: ExcelJS } = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet("Evidenta santier")!;
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual([...CAPETE_EVIDENTA_SANTIER]);
    expect(ws.getRow(2).getCell(10).value).toBe(7.49);
    expect(ws.rowCount).toBe(7);
    const s = wb.getWorksheet("Sold pe material")!;
    expect(s.getRow(3).getCell(7).value).toBe(85);
  });
});

/* -------------------------------------------------------------- serverul */

const app$ = conecteaza();
const prop = conecteaza(URL_PROPRIETAR);
const disponibila = await app$.db.execute(sql`select 1`).then(() => true, () => false);
const daca = () => (disponibila ? it : it.skip);
let tenantId = "";
let server: ReturnType<typeof creeazaServer>;

async function cere(cale: string, metoda = "GET", corp?: unknown) {
  const r = await server.request(cale, {
    method: metoda, headers: { "content-type": "application/json", [ANTET_CSRF]: "1" },
    ...(corp !== undefined ? { body: JSON.stringify(corp) } : {}),
  });
  const text = await r.text();
  return { status: r.status, corp: text ? JSON.parse(text) as Record<string, unknown> : null };
}
const miscari = async (): Promise<Miscare[]> => ((await cere("/api/date")).corp as unknown as DateComune).depozit.miscari;

beforeAll(async () => {
  if (!disponibila) return;
  const [t] = await prop.db.insert(tenant).values({ denumire: `pornire-${Date.now()}` }).returning();
  tenantId = t!.id;
  await caTenant(prop.db, tenantId, async (tx) => {
    await tx.insert(firma).values({ tenantId, cod: "radoia", denumire: "RADOIA ISOLIRUNG SRL", serieOferta: "RAD" });
  });
  server = creeazaServer({ db: app$.db, tenantId });
});

afterAll(async () => {
  if (disponibila && tenantId) await purjeazaTenant(prop.db, tenantId);
  await app$.inchide();
  await prop.inchide();
});

describe("pe server: pornirea și inventarul, calculate din baza", () => {
  daca()("stocul de pornire în central, cu prețul ultimei cumpărări; retrimis, nu se dublează", async () => {
    const corp = { id: "sp-1", data: ZI, articol: cochilie, cantitate: 120 };
    expect((await cere("/api/depozite/central/pornire", "POST", corp)).corp).toEqual({ scrise: 1 });
    expect((await cere("/api/depozite/central/pornire", "POST", corp)).corp).toEqual({ scrise: 0 });
    const m = (await miscari()).find((x) => x.id === "sp-1")!;
    expect(m).toMatchObject({ tip: "intrare", spre: "central", motiv: MOTIV_PORNIRE, pret: { valoare: 8.92, lei: 47.4544, curs: 5.32 } });
  });

  daca()("doar șantierele noi: pe un șantier, stocul de pornire e refuzat, și pe ruta lui, și ca mișcare oarecare", async () => {
    const plan: PlanSantier = {
      id: "S-NOU", creat: ZI, denumire: "Hala nouă", client: "C", firma: "RADOIA ISOLIRUNG SRL", oferta: "", fisier: "x.xlsx",
      destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0,
      pozitii: [{ nr: 1, denumire: "p", um: "ml", cantitate: 10, pretUnitar: 5, foc: false }], situatii: [],
    };
    expect((await cere("/api/santiere/S-NOU", "PUT", plan)).status).toBe(200);
    const r = await cere("/api/depozite/S-NOU/pornire", "POST", { id: "sp-2", data: ZI, articol: cochilie, cantitate: 5 });
    expect(r.status).toBe(400);
    expect(r.corp!["eroare"]).toMatch(/șantierele noi pornesc fără material/);
    const ocolit = await cere("/api/miscari", "POST", {
      id: "sp-3", data: ZI, tip: "intrare", articol: cochilie, cantitate: 5, spre: "S-NOU", motiv: MOTIV_PORNIRE,
    });
    expect(ocolit.status).toBe(400);
  });

  daca()("inventarul: serverul socotește față de baza lui, chiar dacă un coleg a mutat ceva între timp", async () => {
    // Browserul a văzut 120 în central; între timp un coleg a trimis 10 pe șantier.
    expect((await cere("/api/miscari", "POST", {
      id: "tr-1", data: ZI, tip: "transfer", articol: cochilie, cantitate: 10, din: "central", spre: "S-NOU",
    })).status).toBe(200);
    const corp = { numarat: [{ articol: cochilie, cantitate: 100 }], motiv: "pierdut", ids: ["inv-1"], data: ZI };
    expect((await cere("/api/depozite/central/inventar", "POST", corp)).corp).toEqual({ scrise: 1 });
    expect((await cere("/api/depozite/central/inventar", "POST", corp)).corp).toEqual({ scrise: 0 });
    const toate = await miscari();
    expect(toate.find((m) => m.id === "inv-1")).toMatchObject({ tip: "ajustare", cantitate: -10, spre: "central", motiv: "pierdut" });
    expect(sold(toate, "central", cochilie.cheie)).toBe(100);
  });

  daca()("inventarul cere motiv, câte un id pe linie și un loc cunoscut", async () => {
    const corp = { numarat: [{ articol: cochilie, cantitate: 1 }], motiv: "", ids: ["x-1"], data: ZI };
    expect((await cere("/api/depozite/central/inventar", "POST", corp)).status).toBe(400);
    expect((await cere("/api/depozite/central/inventar", "POST", { ...corp, motiv: "furat", ids: ["a", "b"] })).status).toBe(400);
    expect((await cere("/api/depozite/S-NICIUNUL/inventar", "POST", { ...corp, motiv: "furat" })).status).toBe(404);
  });
});

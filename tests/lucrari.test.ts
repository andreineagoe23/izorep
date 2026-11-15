/**
 * Fluxul de după ofertă, spus de firmă pe 29 septembrie 2026: oferta → șantierul
 * (planul) → situațiile de lucrări, cu istoric. Plus cele două reguli de preț
 * din același apel: tehnicul ajustează toate prețurile cu un procent, iar pe
 * industrial închiderile la foc primesc +20 % pe TOTAL, nu pe fiecare produs.
 *
 * Ce se apără: o situație cu tot executat dă exact valoarea ofertei trimise
 * (Oferta 284: 91.737,81 după discount), iar istoricul nu se rescrie.
 */
import { describe, it, expect } from "vitest";
import { CLIENTI, cuClienti } from "./conditii.js";
import ExcelJS from "exceljs";
import { registruOferta } from "../web/registru-oferta.js";
import { citesteOferta, totalul } from "./registru-citit.js";
import {
  adaosFocIndustrial, cuAjustare, imparte, planDinOferta, totalCuAdaos, totalOferta,
  type AntetOferta, type Provenienta,
} from "../web/oferta.js";
import { registruSituatie } from "../web/situatie.js";
import { importaFisier } from "../src/import/pipeline.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { bani } from "../src/pricing/engine.js";
import {
  faraUltimaSituatie, normalizeazaCautarea, progresPlan, randuriSituatie, situatieNoua, totalSituatie, valideazaSituatie,
  valoareOferta, vedereSituatie, type PlanSantier,
} from "../src/lucrari/situatii.js";

const DIR = CLIENTI;

const ANTET: AntetOferta = {
  serie: "RAD", numar: "284", data: "27.05.2026", persoana: "Vlad Emil", client: "Grup Energoinstal SA",
  obiectiv: "TRANSAVIA ALBA-IULIA", firma: "RADOIA ISOLIRUNG SRL", localitate: "PALTINIS",
};
const prov = (destinatie: string, fisierSursa = "test.xlsx"): Provenienta => ({
  generatLa: "2026-09-29T10:00:00.000Z", destinatie, model: null, sesiune: "s", fisierSursa,
});

const plan = (p: Partial<PlanSantier> = {}): PlanSantier => ({
  id: "S-1", creat: "2026-09-29T10:00:00.000Z", denumire: "Test", client: "Client", firma: "RADOIA ISOLIRUNG SRL",
  oferta: "RAD1 / 29.09.2026", fisier: "test.xlsx", destinatie: "rezidential",
  ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0,
  pozitii: [
    { nr: 1, denumire: "Vată 50 Di114", um: "ml", cantitate: 100, pretUnitar: 25.68, foc: false },
    { nr: 2, denumire: "Cot Di114", um: "buc", cantitate: 10, pretUnitar: 76.43, foc: false },
  ],
  situatii: [],
  ...p,
});

describe("situația nouă scurtă (planul UX, Faza 4)", () => {
  const cuZone = plan({
    pozitii: [
      { nr: 1, denumire: "Vată 50 Di114", um: "ml", cantitate: 100, pretUnitar: 25.68, foc: false, zona: "Sala cazanelor" },
      { nr: 2, denumire: "Cot Di114", um: "buc", cantitate: 10, pretUnitar: 76.43, foc: false, zona: "Sala cazanelor" },
      { nr: 3, denumire: "Țeavă oțel DN50, elastomer 19 mm", um: "ml", cantitate: 40, pretUnitar: 8.84, foc: false, zona: "Etaj 1" },
      { nr: 4, denumire: "Teu DN50", um: "buc", cantitate: 4, pretUnitar: 17.68, foc: false, zona: "Etaj 1" },
      { nr: 5, denumire: "Robinet", um: "buc", cantitate: 2, pretUnitar: 30, foc: false },
    ],
    situatii: [{ id: "a", nr: 1, data: "2026-10-01T10:00:00.000Z", cantitati: { 2: 10, 3: 15, 4: 4 } }],
  });
  const noua = situatieNoua(cuZone, "b", "2026-10-15T10:00:00.000Z");
  const nr = (v: ReturnType<typeof vedereSituatie>): (number | string | null)[][] =>
    v.grupuri.map((g) => [g.titlu, ...g.randuri.map((r) => r.poz.nr)]);

  it("doar ce mai are de executat, pe capitolele ofertei, în ordinea planului", () => {
    const v = vedereSituatie(cuZone, noua);
    expect(nr(v)).toEqual([["Sala cazanelor", 1], ["Etaj 1", 3], [null, 5]]);
    expect(v.terminate).toBe(2);
    expect(v.faraPotrivire).toBe(0);
  });

  it("cele terminate se pot desface; una terminată cu ceva scris acum nu se ascunde", () => {
    expect(nr(vedereSituatie(cuZone, noua, { terminate: true }))).toEqual([["Sala cazanelor", 1, 2], ["Etaj 1", 3, 4], [null, 5]]);
    const peste = { ...noua, cantitati: { 4: 1 } };
    const v = vedereSituatie(cuZone, peste);
    expect(nr(v)).toEqual([["Sala cazanelor", 1], ["Etaj 1", 3, 4], [null, 5]]);
    expect(v.terminate).toBe(1);
  });

  it("căutarea filtrează pe cuvinte, fără diacritice și majuscule, și pe capitol", () => {
    expect(nr(vedereSituatie(cuZone, noua, { cauta: "teava dn50" }))).toEqual([["Etaj 1", 3]]);
    expect(nr(vedereSituatie(cuZone, noua, { cauta: "  ȚEAVĂ  " }))).toEqual([["Etaj 1", 3]]);
    expect(nr(vedereSituatie(cuZone, noua, { cauta: "cazanelor" }))).toEqual([["Sala cazanelor", 1]]);
    expect(nr(vedereSituatie(cuZone, noua, { cauta: "5" }))).toEqual([["Sala cazanelor", 1], ["Etaj 1", 3], [null, 5]]);
    const nimic = vedereSituatie(cuZone, noua, { cauta: "pompa" });
    expect(nimic.grupuri).toEqual([]);
    expect(nimic.faraPotrivire).toBe(3);
    expect(normalizeazaCautarea("Ş ș Ț ţ")).toBe("s s t t");
  });

  it("fără situații înainte, toate pozițiile sunt de executat", () => {
    const v = vedereSituatie(plan(), situatieNoua(plan(), "x", "2026-10-01T10:00:00.000Z"));
    expect(nr(v)).toEqual([[null, 1, 2]]);
    expect(v.terminate).toBe(0);
  });
});

describe("situațiile de lucrări", () => {
  it("cumulatul unei situații e suma celor de dinainte plus perioada", () => {
    let p = plan();
    const s1 = { ...situatieNoua(p, "a", "2026-10-01T00:00:00.000Z"), cantitati: { 1: 40 } };
    p = { ...p, situatii: [s1] };
    const s2 = { ...situatieNoua(p, "b", "2026-10-15T00:00:00.000Z"), cantitati: { 1: 30, 2: 4 } };
    expect(s2.nr).toBe(2);
    p = { ...p, situatii: [s1, s2] };
    const r = randuriSituatie(p, s2);
    expect(r.map((x) => [x.anterior, x.curent, x.cumulat, x.rest])).toEqual([[40, 30, 70, 30], [0, 4, 4, 6]]);
    const t = totalSituatie(p, s2);
    expect(t.curent.total).toBe(bani(30 * 25.68 + 4 * 76.43));
    expect(t.cumulat.total).toBe(bani(70 * 25.68 + 4 * 76.43));
    // Situația 1 rămâne cum a fost emisă, oricâte vin după ea.
    expect(totalSituatie(p, s1).cumulat.total).toBe(bani(40 * 25.68));
    expect(progresPlan(p)).toBe(Math.round(((70 * 25.68 + 4 * 76.43) / (100 * 25.68 + 10 * 76.43)) * 100));
  });

  it("peste cantitatea ofertată se poate, dar se vede", () => {
    const p = plan();
    const s = { ...situatieNoua(p, "a", "x"), cantitati: { 2: 12 } };
    expect(randuriSituatie(p, s)[1]!.pesteOferta).toBe(true);
    expect(valideazaSituatie(p, s)).toBeNull();
  });

  it("nu se salvează o situație goală, negativă sau pe o poziție care nu e în plan", () => {
    const p = plan();
    expect(valideazaSituatie(p, situatieNoua(p, "a", "x"))).toMatch(/cel puțin/);
    expect(valideazaSituatie(p, { ...situatieNoua(p, "a", "x"), cantitati: { 1: -1 } })).toMatch(/pozitive/);
    expect(valideazaSituatie(p, { ...situatieNoua(p, "a", "x"), cantitati: { 9: 1 } })).toMatch(/nu e în plan/);
  });

  it("se șterge doar ultima situație", () => {
    const p = plan();
    const s1 = { ...situatieNoua(p, "a", "x"), cantitati: { 1: 1 } };
    const s2 = { ...situatieNoua({ ...p, situatii: [s1] }, "b", "x"), cantitati: { 1: 2 } };
    expect(faraUltimaSituatie({ ...p, situatii: [s1, s2] }).situatii).toEqual([s1]);
  });

  it("adaosul de foc și discountul se aplică la fel ca în ofertă", () => {
    const p = plan({
      discountProcent: 3, adaosFocProcent: 20,
      pozitii: [
        { nr: 1, denumire: "Gol", um: "buc", cantitate: 10, pretUnitar: 23.05, foc: true },
        { nr: 2, denumire: "Vată", um: "ml", cantitate: 10, pretUnitar: 10, foc: false },
      ],
    });
    const v = valoareOferta(p);
    expect(v.adaosFoc).toBe(46.1);
    expect(v.discount).toBe(bani((230.5 + 100 + 46.1) * 0.03));
    expect(v.total).toBe(bani(376.6 - v.discount));
  });

  it("situația descărcată are pozițiile și totalurile", async () => {
    const p0 = plan();
    const s = { ...situatieNoua(p0, "a", "2026-10-01T12:00:00.000Z"), cantitati: { 1: 50 } };
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await registruSituatie({ ...p0, situatii: [s] }, s));
    const ws = wb.worksheets[0]!;
    expect(String(ws.getCell("A1").value)).toContain("SITUATIE DE LUCRARI NR. 1");
    expect(ws.getCell("G9").value).toBe(50);
    expect(ws.getCell("I9").value).toBe(1284);
  });
});

describe("ajustarea tehnicului și închiderile la foc pe industrial", () => {
  cuClienti("ajustarea mută fiecare preț unitar, rotunjit la bani", async () => {
    const cale = `${DIR}/cerere-de-oferta-transavia-abur.xlsx`;
    const l = (await importaFisier(cale, { faraModel: true, stoc: stocInMemorie() })).linii;
    const [a, b] = [imparte(l).oferta, imparte(cuAjustare(l, 10)).oferta];
    expect(b.length).toBe(a.length);
    b.forEach((x, i) => expect(x.pret!.pret_unitar).toBe(bani(a[i]!.pret!.pret_unitar * 1.1)));
    // Sesiunea rămâne pe prețurile din liste.
    expect(imparte(l).oferta[0]!.pret!.pret_unitar).toBe(a[0]!.pret!.pret_unitar);
  });

  cuClienti("Matari pe industrial: prețul rezidențial pe produs, +20 % pe totalul închiderilor, rând separat", async () => {
    const cale = `${DIR}/oferta-118-1-matari-goluri-foc.xlsx`;
    const l = (await importaFisier(cale, { faraModel: true, stoc: stocInMemorie(), destinatie: "industrial" })).linii;
    const { oferta } = imparte(l);
    expect(totalOferta(oferta)).toBe(12692.04);
    expect(adaosFocIndustrial(oferta, "industrial")).toBe(2538.41);
    expect(adaosFocIndustrial(oferta, "rezidential")).toBe(0);
    expect(totalCuAdaos(oferta, "industrial")).toBe(15230.45);

    const o = await citesteOferta(await registruOferta({ linii: l, antet: ANTET, provenienta: prov("industrial") }));
    expect(totalul(o, "ADAOS INCHIDERI")).toBe(2538.41);
    expect(totalul(o, "TOTAL LUCRARI")).toBe(15230.45);
  });
});

describe("șantierul din Oferta 284", () => {
  cuClienti("planul are pozițiile ofertei; o situație cu tot executat dă exact oferta trimisă, 91.737,81", async () => {
    const cale = `${DIR}/cerere-de-oferta-transavia-abur.xlsx`;
    const f = await importaFisier(cale, { faraModel: true, stoc: stocInMemorie() });
    const distribuitor = f.linii.find((l) => /DISTRIBUITOR ABUR/.test(l.bruta.text))!;
    const cerere = await importaFisier(cale, {
      faraModel: true, stoc: stocInMemorie(), preturiManuale: new Map([[distribuitor.extras.index, 2296.70]]),
    });
    const confirmate = cerere.linii.map((l) => (l.pret ? { ...l, necesitaValidare: false } : l));
    const p = planDinOferta({
      linii: confirmate, antet: { ...ANTET, discountProcent: 3 }, provenienta: prov("rezidential", "transavia.xlsx"),
    }, "S-284");
    expect(p.pozitii).toHaveLength(99);
    expect(valoareOferta(p).lucrari).toBe(94575.06);
    expect(valoareOferta(p).total).toBe(91737.81);

    const toata = { ...situatieNoua(p, "a", "x"), cantitati: Object.fromEntries(p.pozitii.map((x) => [x.nr, x.cantitate])) };
    expect(totalSituatie({ ...p, situatii: [toata] }, toata).cumulat.total).toBe(91737.81);
  });
});

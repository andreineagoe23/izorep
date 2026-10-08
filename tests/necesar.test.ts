/**
 * Necesarul de materiale dintr-o oferta importata (`src/stoc/necesar.ts`).
 *
 * Registrul se construieste in test, ca in `nucleu.test.ts`; pe cererea
 * TRANSAVIA reala doar daca fisierul exista (nu e in repo).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { parseFoi } from "../src/import/parse-workbook.js";
import { proceseazaRegistru } from "../src/import/nucleu.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { importaFisier } from "../src/import/pipeline.js";
import { PIERDERI_IMPLICITE, m2PeMetru, necesarDinLinii, piesePeMetru } from "../src/stoc/necesar.js";

/** Fără pierderi la croit: geometria curată, ca în exemplele firmei. */
const FARA = { pierderi: { tub: 0, placa: 0, tabla: 0 } };
import { articolDin } from "../src/stoc/registru.js";
import { cuAjustare, imparte, planDinOferta, totalOferta } from "../web/oferta.js";
import type { RezultatTarifare } from "../src/pricing/types.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "izorep-necesar-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

async function linii(randuri: (string | number | null)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lista");
  ws.addRow(["Nr. crt.", "Denumire articol", "UM", "Cantitate"]);
  for (const r of randuri) ws.addRow(r);
  const cale = join(dir, "test.xlsx");
  await wb.xlsx.writeFile(cale);
  return (await proceseazaRegistru(await parseFoi(cale), { stoc: stocInMemorie() })).linii;
}

describe("necesarul de materiale", () => {
  it("m²/ml e formula firmei: (ø + 2 × grosime) / 1000 × 3,14, rotunjit la două zecimale", () => {
    // Exemplul din apelul cu firma: 0,114 + 2 × 0,03 = 0,174 × 3,14 = 0,5463… → 0,55.
    expect(m2PeMetru(114, 30)).toBe(0.55);
    expect(m2PeMetru(114.3, 30)).toBe(0.55);
    expect(m2PeMetru(33.7, 0)).toBe(0.11);
  });

  it("peste 3 țoli: plăci pe m², nu tuburi — ø114 cu vată 30, 100 m → 55 m²", async () => {
    const l = await linii([[1, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g30 - ML", "ml", 100]]);
    const n = necesarDinLinii(l, FARA);
    const vata = n.materiale.find((m) => m.sistem === "vata_minerala")!;
    expect(vata.rand).toBeNull();
    expect(vata.m2).toBe(55);
    expect(vata.ml).toBe(100);
    expect(articolDin(vata).um).toBe("m2");
    expect(n.materiale.find((m) => m.sistem === "tabla")!.rand).toBeNull();
  });

  it("până la 3 țoli: tub pe diametru și grosime, în metri", async () => {
    const l = await linii([[1, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di60, g40 - ML", "ml", 20]]);
    const vata = necesarDinLinii(l).materiale.find((m) => m.sistem === "vata_minerala")!;
    expect([vata.rand, vata.ml]).toEqual([60, 20]);
    expect(articolDin(vata).um).toBe("ml");
  });

  it("coturile și teurile peste 3 țoli intră în m²: 3 pe metru la ø114, 2 la ø169, 1 de la ø219", async () => {
    expect([114.3, 139.7, 168.3, 219.1, 273].map(piesePeMetru)).toEqual([3, 3, 2, 1, 1]);
    const l = await linii([
      [1, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g30 - COT", "buc", 6],
      [2, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di169, g30 - TEU", "buc", 4],
    ]);
    const vata = necesarDinLinii(l, FARA).materiale.find((m) => m.sistem === "vata_minerala")!;
    // 6 coturi / 3 = 2 m × 0,55 + 4 teuri / 2 = 2 m × 0,72 (168,3 + 60 → 0,7169)
    expect(vata.m2).toBe(Math.round((2 * 0.55 + 2 * 0.72) * 100) / 100);
    expect(vata.piese).toBe(10);
    expect(vata.piesePresupuse).toBe(0);
  });

  it("piesele sub 3 țoli se taie din tub: 3 pe metru, pe regulă presupusă", async () => {
    const l = await linii([
      [1, "Caseta izolatie armaturi cu flanse DN50 din tabla aluminiu si vata minerala gr. 40 mm", "buc", 3],
      [2, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di60, g40 - ML", "ml", 10],
    ]);
    const vata = necesarDinLinii(l, FARA).materiale.find((m) => m.sistem === "vata_minerala")!;
    expect(vata.ml).toBe(11);
    expect(vata.piese).toBe(3);
    expect(vata.piesePresupuse).toBe(3);
  });

  it("fără rezervă; pierderile la croit sunt pe categorie: tablă și plăci 10 %, tuburi 0 (S15, S16)", async () => {
    const l = await linii([
      [1, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g30 - ML", "ml", 100],
      [2, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di60, g40 - ML", "ml", 20],
    ]);
    const n = necesarDinLinii(l);
    expect(n.pierderi).toEqual(PIERDERI_IMPLICITE);
    const placa = n.materiale.find((m) => m.sistem === "vata_minerala" && m.rand === null)!;
    const tub = n.materiale.find((m) => m.sistem === "vata_minerala" && m.rand === 60)!;
    expect([placa.categorie, placa.m2]).toEqual(["placa", 60.5]);
    expect([tub.categorie, tub.ml]).toEqual(["tub", 20]);
    expect(n.materiale.find((m) => m.sistem === "tabla")!.pierdere).toBe(0.1);
  });

  it("tabla are și kg: densitate × grosime, 2,70 la aluminiu (0,6 mm = 1,62 kg/m²; S13: se cumpără la kg)", async () => {
    const l = await linii([[1, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g30 - ML", "ml", 100]]);
    const tabla = necesarDinLinii(l, FARA).materiale.find((m) => m.sistem === "tabla")!;
    expect(tabla.grosime_mm).toBe(0.6);
    expect(tabla.kg).toBeCloseTo(tabla.m2 * 1.62, 1);
  });

  it("tuburi și peste 3 țoli, când șantierul o cere (S12): pragul se mută", async () => {
    const l = await linii([[1, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g30 - ML", "ml", 100]]);
    const vata = necesarDinLinii(l, { ...FARA, pragTub: 114 }).materiale.find((m) => m.sistem === "vata_minerala")!;
    expect([vata.rand, vata.ml, vata.categorie]).toEqual([114, 100, "tub"]);
  });

  it("necesarul pe poziție: cât material intră într-o unitate a fiecărei poziții din plan", async () => {
    const l = await linii([
      [1, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g30 - ML", "ml", 100],
      [2, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g30 - COT", "buc", 6],
    ]);
    const vata = necesarDinLinii(l, FARA).materiale.find((m) => m.sistem === "vata_minerala")!;
    // Poziția 1: 0,55 m² pe metru; poziția 2: un cot = 1/3 m × 0,55.
    expect(vata.pePozitie).toEqual([{ pozitie: 1, peUnitate: 0.55 }, { pozitie: 2, peUnitate: 0.1833 }]);
  });

  it("fiecare material știe cât valorează în ofertă (lista, cu manoperă)", async () => {
    const l = await linii([[1, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g30 - ML", "ml", 10]]);
    const p = l.find((x) => x.pret)!.pret as RezultatTarifare;
    const n = necesarDinLinii(l);
    const suma = n.materiale.reduce((t, m) => t + m.valoareOferta, 0);
    expect(suma).toBeCloseTo(p.pret_unitar * 10, 2);
    // Pe straturi, după prețul lor din listă: vata și tabla își păstrează partea.
    const [vata, tabla] = p.straturi.map((s) => s.pret_unitar * s.multiplicator * 10);
    expect(n.materiale.find((m) => m.sistem === "vata_minerala")!.valoareOferta).toBeCloseTo(vata!, 2);
    expect(n.materiale.find((m) => m.sistem === "tabla")!.valoareOferta).toBeCloseTo(tabla!, 2);
  });

  it("valoarea în ofertă e cât plătește clientul: cu ajustarea tehnicului și discountul", async () => {
    const l = await linii([
      [1, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g30 - ML", "ml", 10],
      [2, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di60, g40 - COT", "buc", 4],
    ]);
    const oferta = imparte(cuAjustare(l, 10)).oferta;
    expect(oferta).toHaveLength(2);
    const n = necesarDinLinii(oferta, { discountProcent: 3 });
    const suma = n.materiale.reduce((t, m) => t + m.valoareOferta, 0);
    expect(suma).toBeCloseTo(totalOferta(oferta) * 0.97, 1);
  });

  it("ce nu are preț din liste apare separat, cu motivul", async () => {
    // Un echipament fără D și L: singura izolație care mai rămâne fără preț.
    const l = await linii([[1, "Izolare echipament schimbator de caldura cu vata minerala 100 mm", "buc", 1]]);
    const n = necesarDinLinii(l);
    expect(n.materiale).toEqual([]);
    expect(n.faraNecesar).toHaveLength(1);
  });

  it("cererea TRANSAVIA: toți metrii de vată din ofertă ajung în necesar, distribuitorul pe suprafața lui", async () => {
    const cale = "../attachments/clienti/cerere-de-oferta-transavia-abur.xlsx";
    if (!existsSync(cale)) return;
    const l = (await importaFisier(cale, { faraModel: true, stoc: stocInMemorie() })).linii;
    const n = necesarDinLinii(l, FARA);
    expect(n.faraNecesar).toEqual([]);
    // Distribuitorul: g100, D=500, L=4500 → 10,66 m² de vată 100 mm, pe plăci (peste 3 țoli).
    const vata100 = n.materiale.find((m) => m.sistem === "vata_minerala" && m.grosime_mm === 100 && m.rand === null)!;
    expect(vata100.m2).toBeGreaterThanOrEqual(10.66);
    // Metrii din ofertă, plus piesele trecute în metri (n / piese pe metru).
    const mlOferta = l.filter((x) => x.pret && x.extras.sistem === "vata_minerala" && x.extras.forma !== "mp"
        && !(x.pret as RezultatTarifare).suprafata_mp)
      .reduce((s, x) => s + (x.extras.forma === "ml" ? (x.bruta.cantitate ?? 0)
        : (x.bruta.cantitate ?? 0) / piesePeMetru((x.pret as RezultatTarifare).straturi[0]!.diametru_geometric)), 0);
    const mlNecesar = n.materiale.filter((m) => m.sistem === "vata_minerala").reduce((s, m) => s + m.ml, 0);
    // Fiecare material se rotunjește la bani; suma lor poate fugi cu câțiva cenți.
    expect(mlNecesar).toBeCloseTo(mlOferta, 1);
  });

  it("cererea TRANSAVIA: necesarul pe poziție × cantitatea din planul șantierului = necesarul total", async () => {
    const cale = "../attachments/clienti/cerere-de-oferta-transavia-abur.xlsx";
    if (!existsSync(cale)) return;
    const l = (await importaFisier(cale, { faraModel: true, stoc: stocInMemorie() })).linii
      .map((x) => (x.pret ? { ...x, necesitaValidare: false } : x));
    const oferta = imparte(l).oferta;
    const plan = planDinOferta({
      linii: l,
      antet: { serie: "RAD", numar: "1", data: "09.10.2026", persoana: "", client: "C", obiectiv: "O", firma: "RADOIA ISOLIRUNG SRL", localitate: "P" },
      provenienta: { generatLa: "2026-10-09T00:00:00.000Z", destinatie: "rezidential", model: null, sesiune: "s", fisierSursa: "c.xlsx" },
    }, "S-1");
    const n = necesarDinLinii(oferta, FARA);
    for (const m of n.materiale) {
      const dinPlan = m.pePozitie.reduce((t, p) => t + p.peUnitate * plan.pozitii[p.pozitie - 1]!.cantitate, 0);
      const total = m.rand === null ? m.m2 : m.ml;
      expect(dinPlan, `${m.cheie}`).toBeCloseTo(total, 0);
    }
  });
});

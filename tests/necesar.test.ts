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
import { m2PeMetru, necesarDinLinii } from "../src/stoc/necesar.js";
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
  it("m²/ml e formula registrului firmei, cu π întreg: φ33,7 → 0,105871672…", () => {
    expect(m2PeMetru(33.7, 0)).toBeCloseTo(0.105871672425976, 12);
  });

  it("vată + tablă pe Di114: fiecare strat pe rândul lui, metri și m² cu adaosul de 10%", async () => {
    const l = await linii([[1, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g50 - ML", "ml", 20]]);
    const n = necesarDinLinii(l);
    const straturi = (l.find((x) => x.pret)!.pret as RezultatTarifare).straturi;
    expect(n.materiale.map((m) => [m.sistem, m.grosime_mm, m.rand])).toEqual([
      ["vata_minerala", 50, 114], ["tabla", 0.8, 220],
    ]);
    const vata = n.materiale[0]!;
    expect(vata.ml).toBe(22);
    expect(vata.m2).toBe(Math.round(20 * m2PeMetru(straturi[0]!.diametru_geometric, 50) * 1.1 * 100) / 100);
    expect(vata.bucati).toBe(0);
  });

  it("piesele se numără în bucăți, fără m² inventat", async () => {
    const l = await linii([
      [1, "Caseta izolatie armaturi cu flanse DN100 din tabla aluminiu si vata minerala", "buc", 3],
      [2, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g50 - ML", "ml", 10],
    ]);
    const vata = necesarDinLinii(l).materiale.find((m) => m.sistem === "vata_minerala")!;
    expect(vata.bucati).toBe(3);
    expect(vata.ml).toBe(11);
  });

  it("adaosul e un parametru: 0 dă exact metrii din ofertă", async () => {
    const l = await linii([[1, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g50 - ML", "ml", 20]]);
    expect(necesarDinLinii(l, 0).materiale[0]!.ml).toBe(20);
  });

  it("ce nu are preț din liste apare separat, cu motivul", async () => {
    const l = await linii([[1, "Izolatii cu vata minerala 48 mm Di60 - ML", "ml", 5]]);
    const n = necesarDinLinii(l);
    expect(n.materiale).toEqual([]);
    expect(n.faraNecesar).toHaveLength(1);
  });

  it("cererea TRANSAVIA: toată vata pe metru din ofertă ajunge în necesar, doar distribuitorul rămâne afară", async () => {
    const cale = "../attachments/clienti/cerere-de-oferta-transavia-abur.xlsx";
    if (!existsSync(cale)) return;
    const l = (await importaFisier(cale, { faraModel: true, stoc: stocInMemorie() })).linii;
    const n = necesarDinLinii(l, 0);
    expect(n.faraNecesar.map((f) => f.text)).toEqual([expect.stringContaining("DISTRIBUITOR ABUR")]);
    const mlOferta = l.filter((x) => x.pret && x.extras.sistem === "vata_minerala" && x.extras.forma === "ml")
      .reduce((s, x) => s + (x.bruta.cantitate ?? 0), 0);
    const mlNecesar = n.materiale.filter((m) => m.sistem === "vata_minerala").reduce((s, m) => s + m.ml, 0);
    expect(mlNecesar).toBeCloseTo(mlOferta, 2);
  });
});

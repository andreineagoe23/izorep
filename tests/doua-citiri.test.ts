/**
 * Două citiri (planul UX, Faza 6, punctul 4): rândurile citite de model se
 * citesc de două ori; unde citirile diferă la un câmp care intră în preț,
 * rândul merge la om cu motivul lui, oricâtă încredere ar raporta modelul.
 */
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseFoiBuffer } from "../src/import/parse-workbook.js";
import { diferenteCitiri, proceseazaRegistru, type Extractor } from "../src/import/nucleu.js";
import { stocInMemorie } from "../src/import/memorie.js";
import type { LinieExtrasa } from "../src/import/schema.js";

const extrasa = (p: Partial<LinieExtrasa>): LinieExtrasa => ({
  index: 0, sistem: "elastomer", diametru_valoare: 22, diametru_tip: "exterior", grosime_mm: 19,
  forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [], incredere: 0.97, motiv: "model", ...p,
});

/** Rânduri pe care regulile nu le citesc (fără material cunoscut): pleacă la model. */
async function foi(texte: string[]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lista");
  ws.addRow(["Nr. crt.", "Denumire articol", "UM", "Cantitate"]);
  texte.forEach((t, i) => ws.addRow([i + 1, t, "ml", 10]));
  return parseFoiBuffer((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

describe("două citiri ale modelului", () => {
  it("compară doar câmpurile care intră în preț", () => {
    expect(diferenteCitiri(extrasa({}), extrasa({ incredere: 0.5, motiv: "altul" }))).toEqual([]);
    expect(diferenteCitiri(extrasa({}), extrasa({ grosime_mm: 13 }))).toEqual(["grosime"]);
    expect(diferenteCitiri(extrasa({ straturi_extra: [{ sistem: "tabla", grosime_mm: null }] }), extrasa({}))).toEqual(["straturi"]);
    expect(diferenteCitiri(extrasa({}), undefined)).toEqual(["a doua citire lipsește"]);
  });

  it("citit diferit a doua oară: „De verificat”, cu motivul lui, chiar cu încredere 0,97; la fel: neatins", async () => {
    const f = await foi(["Spuma armacell perete 19 tub 22 rece", "Spuma kaiflex rece tub 28 perete 13"]);
    let apel = 0;
    const citiri: number[] = [];
    const extrage: Extractor = async (linii, ctx) => {
      apel++;
      citiri.push(ctx.citire ?? 0);
      return linii.map((l, k) => extrasa({
        index: l.index, diametru_valoare: k === 0 ? 22 : 28, grosime_mm: k === 0 ? 19 : 13,
        // A doua citire vede altă grosime pe primul rând.
        ...(ctx.citire === 2 && k === 0 ? { grosime_mm: 13 } : {}),
      }));
    };
    const rez = await proceseazaRegistru(f, { stoc: stocInMemorie(), extrage });
    expect(apel).toBe(2);
    expect(citiri.sort()).toEqual([1, 2]);
    const [unu, doi] = rez.linii.filter((l) => l.extras.sistem !== null);
    expect(unu!.necesitaValidare).toBe(true);
    expect(unu!.avertismente?.map((a) => a.cod)).toContain("citit_diferit");
    expect(unu!.extras.grosime_mm).toBe(19);
    expect(doi!.avertismente?.some((a) => a.cod === "citit_diferit") ?? false).toBe(false);
  });

  it("fără a doua citire (`douaCitiri: false`), un singur apel", async () => {
    const f = await foi(["Spuma armacell perete 19 tub 22 rece"]);
    let apel = 0;
    await proceseazaRegistru(f, {
      stoc: stocInMemorie(), douaCitiri: false,
      extrage: async (linii) => { apel++; return linii.map((l) => extrasa({ index: l.index })); },
    });
    expect(apel).toBe(1);
  });

  it("proiecțiile pe șablon moștenesc verdictul reprezentantului", async () => {
    const f = await foi(["Spuma armacell perete 19 tub 22 rece", "Spuma armacell perete 19 tub 28 rece"]);
    const extrage: Extractor = async (linii, ctx) => linii.map((l) => extrasa({
      index: l.index, diametru_valoare: Number(/tub (\d+)/.exec(l.text)?.[1] ?? 22), grosime_mm: ctx.citire === 2 ? 13 : 19,
    }));
    const rez = await proceseazaRegistru(f, { stoc: stocInMemorie(), extrage });
    const poz = rez.linii.filter((l) => l.extras.sistem !== null);
    expect(poz).toHaveLength(2);
    expect(poz.every((l) => l.necesitaValidare && l.avertismente?.some((a) => a.cod === "citit_diferit"))).toBe(true);
    expect(poz.map((l) => l.sursa).sort()).toEqual(["model", "sablon"]);
  });
});

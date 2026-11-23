/**
 * Motivul de la „De verificat”, ca propoziție cu valoarea și unde se schimbă
 * (planul UX, Faza 6, punctul 9). Pur: rândurile vin din nucleu, cu un model
 * fals, sau scrise de mână pe forma lui `LinieProcesata`.
 */
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseFoiBuffer } from "../src/import/parse-workbook.js";
import { proceseazaRegistru, type Extractor, type LinieProcesata } from "../src/import/nucleu.js";
import { stocInMemorie } from "../src/import/memorie.js";
import type { LinieExtrasa } from "../src/import/schema.js";
import { explicaRand } from "../web/import/explica.js";
import { verificarePeEcran } from "../web/import/verificare-vizual.js";

const extrasa = (p: Partial<LinieExtrasa>): LinieExtrasa => ({
  index: 0, sistem: "elastomer", diametru_valoare: 22, diametru_tip: "exterior", grosime_mm: 19,
  forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [], incredere: 0.97, motiv: "model", ...p,
});

async function import1(texte: string[], extrage: Extractor) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lista");
  ws.addRow(["Nr. crt.", "Denumire articol", "UM", "Cantitate"]);
  texte.forEach((t, i) => ws.addRow([i + 1, t, "ml", 10]));
  const rez = await proceseazaRegistru(await parseFoiBuffer((await wb.xlsx.writeBuffer()) as ArrayBuffer), { stoc: stocInMemorie(), extrage });
  return rez.linii.filter((l) => l.extras.sistem !== null);
}

/** Un rând „De verificat” scris de mână, pe forma nucleului. */
const rand = (p: Partial<LinieProcesata> & { extras: LinieExtrasa }, text = "rand"): LinieProcesata => ({
  bruta: { index: 0, foaie: "F", rand: 7, text, um: "ml", cantitate: 10 } as LinieProcesata["bruta"],
  sursa: "regex", necesitaValidare: true,
  pret: { straturi: [], pret_unitar: 25.5, multiplicator: 1, cantitate: 10, total: 255, moneda: "EUR" } as unknown as NonNullable<LinieProcesata["pret"]>,
  ...p,
});

describe("propoziția de la „De verificat”", () => {
  it("citit de două ori, diferit: cele două valori, ce s-a luat, cursorul pe grosime", async () => {
    const [l] = await import1(["Spuma armacell perete 19 tub 22 rece"],
      async (linii, ctx) => linii.map((x) => extrasa({ index: x.index, grosime_mm: ctx.citire === 2 ? 13 : 19 })));
    expect(explicaRand(l!)).toEqual({ text: "Citit de două ori, diferit: o dată 19 mm, o dată 13 mm. Am luat 19 mm.", camp: "gros" });
  });

  it("două diametre: amândouă, în ordinea din text, și cel luat; cursorul pe diametru", async () => {
    const [l] = await import1(["Spuma armacell perete 13 DN80 | Dimensiuni Ø100"],
      async (linii) => linii.map((x) => extrasa({ index: x.index, diametru_valoare: 80, diametru_tip: "DN", grosime_mm: 13 })));
    expect(explicaRand(l!)).toEqual({ text: "Pe rând sunt două diametre: DN80 și Ø100. Am luat DN80.", camp: "diam" });
  });

  // Auditul din 15 noiembrie: modelul a citit bine tabla, codul a scos-o fiindcă
  // textul n-o numește („tb. Al”); omul trebuie să afle că prețul e fără ea.
  it("jacheta scoasă (strat_necitat): spune întâi că prețul e fără tablă", async () => {
    // „vată min. + tb. Al” îl citesc din 23 noiembrie 2026 regulile, cu tablă cu tot;
    // aici modelul pune o tablă pe care rândul n-o numește.
    const [l] = await import1(["Izolatii cu fata caserata Al, d27 g40 ML"],
      async (linii) => linii.map((x) => extrasa({ index: x.index, sistem: "vata_minerala", diametru_valoare: 27,
        diametru_tip: "interior", grosime_mm: 40, straturi_extra: [{ sistem: "tabla", grosime_mm: null }] })));
    expect(l!.avertismente?.map((a) => a.cod)).toContain("strat_necitat");
    const t = explicaRand(l!)!;
    expect(t.text).toMatch(/^Prețul e fără tablă: \d+,\d\d €\./);
    expect(t.camp).toBe("prot");
  });

  it("grosimea de la țeava de același diametru, sau cea obișnuită a firmei", () => {
    const conducta = rand({
      extras: extrasa({ grosime_mm: 50, sistem: "vata_minerala" }),
      pret: { straturi: [], pret_unitar: 30, multiplicator: 1, cantitate: 1, total: 30, moneda: "EUR",
        note: ["grosime 50 mm luata de la conducta de acelasi diametru din lista (randul 12); clientul n-a scris-o pe randul asta"],
        motiveDeVerificat: ["grosime_propusa", "peste_lista"] } as unknown as NonNullable<LinieProcesata["pret"]>,
    });
    // Din 23 noiembrie 2026 și grosimea propusă e nedovedită: ordinea e a motivelor.
    expect(explicaRand(conducta)!.text).toBe(
      "Am pus 50 mm, ca la țeava de același diametru. Diametrul e peste listă: prețul e din formula pe m² a firmei, 30,00 €.");
    expect(explicaRand(conducta)!.camp).toBe("gros");
  });

  it("protecția la foc: prețul e doar pentru EI60, iar rândul spune altă clasă", () => {
    const l = rand({
      extras: extrasa({ sistem: "vata_minerala", diametru_valoare: null, diametru_tip: null }),
      pret: { straturi: [], pret_unitar: 48, multiplicator: 1, cantitate: 1, total: 48, moneda: "EUR",
        motiveDeVerificat: ["protectie_foc"] } as unknown as NonNullable<LinieProcesata["pret"]>,
    }, "Protectie la foc EI120 a tubulaturii din tabla zincata");
    expect(explicaRand(l)).toEqual({ text: "Preț de mână: 48 €/m² e doar pentru EI60, aici scrie EI120. Am pus 48,00 €.", camp: "pret" });
  });

  it("rândul necitit: fără „Schimb”, trimite la „Încearcă din nou”", () => {
    const l = rand({ extras: extrasa({}), avertismente: [{ cod: "necitit", mesaj: "x" }] });
    expect(explicaRand(l)).toEqual({ text: expect.stringContaining("„Încearcă din nou”"), camp: null });
  });

  it("pe rândul gata, nimic; textul din date e escapat pe ecran, cu „E bine” și „Schimb”", async () => {
    expect(explicaRand(rand({ extras: extrasa({}), necesitaValidare: false }))).toBeNull();
    const linii = await import1(["Spuma armacell <b>perete</b> 13 DN80 | Ø100"],
      async (x) => x.map((y) => extrasa({ index: y.index, diametru_valoare: 80, diametru_tip: "DN", grosime_mm: 13 })));
    const l = linii[0]!;
    const html = verificarePeEcran({ capitole: [{ titlu: "", pozitii: [{
      linie: l.extras.index, nr: null, stare: "de_validat", textClient: l.bruta.text, cod: "", um: "ml", cantitate: 10,
      pretUnitar: l.pret?.pret_unitar ?? null, sursa: { foaie: "Lista", rand: l.bruta.rand },
    }] }] } as never, { linii: new Map([[l.extras.index, l]]), vizibile: null, editIdx: null, propunere: () => null, cuFoaie: false } as never);
    expect(html).toContain('data-act="schimb"');
    expect(html).toContain('data-camp="diam"');
    expect(html).toContain(">E bine<");
    expect(html).not.toContain("<b>perete");
  });
});

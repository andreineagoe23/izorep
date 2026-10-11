/**
 * Cele două cereri primite pe 5 octombrie 2026, prin Adrian: SRU Craiova (HVAC)
 * și CET Constanța (motoare termice). Textele de aici sunt scurtate din ele;
 * fișierele firmei nu sunt în repo.
 *
 * Pe SRU, importul ieșea 9,6 milioane €: tubulatura din tablă zincată primea
 * jacheta, tubulatura neizolată ieșea cu preț, cele 45 de rânduri de țeavă
 * izolată nu se citeau deloc, iar cantitatea era prima din trei coloane. Pe
 * CET, o listă de țevi și fitinguri fără izolație pe rând, 31 de piese ieșeau
 * tablă de inox sau PVC, cu prețul unitar (5 lei) drept cantitate.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { extrageDeterminist } from "../src/import/extract-regex.js";
import { parseFoi } from "../src/import/parse-workbook.js";
import { proceseazaRegistru } from "../src/import/nucleu.js";
import { stocInMemorie } from "../src/import/memorie.js";

const extrage = (text: string, um?: string, cant?: number) =>
  extrageDeterminist(0, text, um, undefined, cant).linie;

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "izorep-cereri-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

async function registru(randuri: (string | number | null)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1");
  for (const r of randuri) ws.addRow(r);
  const cale = join(dir, "cerere.xlsx");
  await wb.xlsx.writeFile(cale);
  return proceseazaRegistru(await parseFoi(cale), { stoc: stocInMemorie() });
}

const TUB = "Tubulatura rectangulara din tabla zincata , dreapta ( clasa de etanseitate C) , inclusiv garnituri "
  + "de etansare la imbinare, accesorii de sustinere (tija reglabila filetata, console metalice , saibe, piulite etc)";
const TEAVA = "Teava din otel neagra, Pn10, prevazuta cu izolatie elastomerica cu grosimea de 19mm, montata in "
  + "distributie interioara, inclusiv fitinguri de imbinare si suporti de montaj. Sunt incluse toate costurile "
  + "necesare montajului (material marunt, pierderi de material, material de etansare vopsire , grunduire etc).Diametru DN 15";

describe("SRU Craiova: tubulatura din tablă zincată", () => {
  it("tabla e materialul tubulaturii, nu jacheta: doar elastomerul", () => {
    const l = extrage(`${TUB} si izloatie elastomerica cu folie de aluminiu 13 mm`, "mp", 100);
    expect([l.sistem, l.grosime_mm, l.straturi_extra]).toEqual(["elastomer", 13, []]);
  });

  it("jacketing-ul scris rămâne jachetă", () => {
    const l = extrage(`${TUB}, izloatie din vata minerala de 50 mm si jacketing din tabla de 1 mm, pentru montaj la exterior`, "mp", 100);
    expect(l.sistem).toBe("vata_minerala");
    expect(l.straturi_extra.map((s) => s.sistem)).toEqual(["tabla"]);
  });

  it("tubulatura fără izolație nu e poziție", () => {
    expect(extrage(`${TUB} fara izolatie`, "mp", 100).sistem).toBeNull();
    expect(extrage("Tubulatura circulara din tabla zincata , fittinguri (coturi , teuri) neizolate", "mp", 100).sistem).toBeNull();
  });

  it("protecția mecanică din tablă zincată e jachetă, chiar fără izolație numită", () => {
    expect(extrage("Protectie mecanica din tabla zincata pentru tubulatura de aer introdus si evacuat montata in "
      + "exteriorul cladirii; inclusiv piese speciale pentru introducere / evacuare aer", "mp", 851).sistem).toBe("tabla");
  });
});

describe("SRU Craiova: țeava izolată cu „grunduire” printre costuri", () => {
  it("grunduirea din lista costurilor nu face din rând altă meserie", () => {
    const l = extrage(TEAVA, "m", 100);
    expect([l.sistem, l.grosime_mm, l.diametru_tip, l.diametru_valoare]).toEqual(["elastomer", 19, "DN", 15]);
  });

  it("dar aparatul de aer condiționat rămâne altă meserie", () => {
    // Book15 r274: „insulated with elastomeric tube” e despre țeava aparatului.
    expect(extrage("Air conditioning unit, direct expansion type, with wall-mounted indoor unit, -insulated copper "
      + "refrigerant piping Ø6.35 / Ø12.7, insulated with elastomeric tube 13 mm", "buc", 4).sistem).toBeNull();
    // Grunduirea fără material de izolație rămâne respinsă.
    expect(extrage("Grunduire si vopsire conducte DN50", "m", 10).sistem).toBeNull();
  });

  it("„idem DN20” moștenește descrierea și cantitatea totală", async () => {
    const r = await registru([
      [null, "Denumire", "Name (En)", "U.M.", "Cantitate", "Cantitate AT ", "CANTITATE TOTALA"],
      [1, TEAVA, null, "m", 34122, 45291, 79413],
      [2, "idem DN20", null, "m", 30561, 17799, 48360],
      [14, "idem DN300", null, "m", 3613, null, null],
      [15, "idem DN350", null, "m", 0, null, null],
    ]);
    const poz = r.linii.filter((l) => l.extras.sistem !== null)
      .map((l) => [l.extras.diametru_valoare, l.extras.grosime_mm, l.bruta.cantitate]);
    // Totalul gol se completează din coloanele lui (verificat pe foaie: 34122 +
    // 45291 = 79413); un 0 scris rămâne 0, nu numărul curent al rândului.
    expect(poz).toEqual([[15, 19, 79413], [20, 19, 48360], [300, 19, 3613], [350, 19, 0]]);
  });
});

describe("CET Constanța: lista de țevi a instalatorului", () => {
  it("materialul țevii sau al piesei nu e jachetă", () => {
    expect(extrage("Hexagonal nipple EN 10241, with external taper thread acc. EN 10226 - DN15 | stainless steel 1.4571", "pcs.", 5).sistem).toBeNull();
    expect(extrage("Pipe PVC-C grey, Series S4 SDR9, PN25 - 25x2.8 | PVC-C", "m", 2.79).sistem).toBeNull();
  });

  it("jacheta de inox sau PVC scrisă ca jachetă rămâne", () => {
    expect(extrage("Protectie cu tabla de inox 0,5 mm pentru conducte DN100", "mp", 10).sistem).toBe("tabla_inox");
    expect(extrage("Manta PVC peste izolatia existenta DN50", "m", 10).sistem).toBe("pvc");
  });

  it("cantitatea vine din coloana QTY., nu din prețul unitar de după UM", async () => {
    const r = await registru([
      ["Description", null, "DN", "Material", "QTY.", "Unit", "Pcs. in Set", "Price Unit (lei)", "Value (lei)"],
      ["Izolatie vata minerala 50 mm cu tabla aluminiu, teava DN50", null, "50", "P235GH", 61.25, "m", null, 5, 306.25],
    ]);
    expect(r.linii.find((l) => l.extras.sistem !== null)!.bruta.cantitate).toBe(61.25);
  });
});

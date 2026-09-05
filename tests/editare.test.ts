/**
 * Corectia unei celule din grila trebuie sa ajunga la extragere si la pret,
 * nu doar pe ecran.
 *
 * Inainte de `editare.ts`, corectia se scria doar in `RandBrut.celule[i].v`
 * (forma pe care o randeaza ecranul), in timp ce `LinieBruta.text/um/
 * cantitate/celule` — pe care le citesc `extrageDeterminist` si tarifarea —
 * ramaneau inghetate la ce iesise din parsare. Testele de aici verifica
 * exact drumul care s-ar rupe daca `scrieCelula`/`reconstruieste` ar reveni
 * sa scrie doar intr-un singur array.
 *
 * Registrul se construieste in memorie cu ExcelJS, ca in `tests/foi.test.ts`
 * si `tests/pipeline.test.ts`: fisierele clientilor nu sunt in repo, iar o
 * suita care le-ar citi din `../attachments/` ar deveni saritoare in CI.
 */
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseFoiBuffer } from "../src/import/parse-workbook.js";
import type { FoaieBruta, RandBrut } from "../src/import/parse-workbook.js";
import { offsetColoana, scrieCelula, reconstruieste } from "../src/import/editare.js";
import { aplicaMapareRand } from "../src/import/mapare.js";
import type { MapareFoaie } from "../src/import/mapare.js";
import { extrageDeterminist } from "../src/import/extract-regex.js";
import { tarifeazaSimplu } from "../src/pricing/engine.js";

type Celula = string | number | null;

/** Un registru cu un singur rand de antet si randurile date, ca in foi.test.ts. */
async function registru(
  randuri: Celula[][],
  imbinari: string[] = [],
): Promise<FoaieBruta> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lista");
  randuri.forEach((r, i) => { ws.getRow(i + 1).values = r as ExcelJS.CellValue[]; });
  for (const m of imbinari) ws.mergeCells(m);
  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
  const [foaie] = await parseFoiBuffer(buf);
  return foaie!;
}

describe("corectarea cantitatii ajunge la pret", () => {
  it("scrieCelula + reconstruieste schimba linie.cantitate si linie.celule, nu doar celule", async () => {
    const foaie = await registru([
      ["Nr", "Denumire articol", "UM", "Cantitate"],
      [1, "Izolatie elastomer 13 mm pe teava DN25 apa rece", "ml", 100],
    ]);
    const rand: RandBrut = foaie.randuri[1]!;
    expect(rand.linie?.cantitate).toBe(100);

    const cCantitate = 3; // coloana "Cantitate" in RandBrut.celule, fara imbinari
    scrieCelula(rand, cCantitate, 250);

    // RandBrut.celule s-a schimbat (asta functiona si inainte de bug).
    expect(rand.celule[cCantitate]?.v).toBe(250);
    // LinieBruta.celule (vectorul citit de extragere) trebuie sa se fi
    // schimbat SI el, la offsetul corect — asta e bug-ul reparat.
    const offset = offsetColoana(rand.celule, cCantitate);
    expect(rand.linie?.celule[offset]).toBe(250);

    reconstruieste(rand);
    expect(rand.linie?.cantitate).toBe(250);

    const inainte = tarifeazaSimplu("elastomer", 25, 13, "ml", 100).total;
    const dupa = tarifeazaSimplu("elastomer", 25, 13, "ml", rand.linie!.cantitate!).total;
    expect(dupa).not.toBeCloseTo(inainte, 2);
    expect(dupa).toBeCloseTo(tarifeazaSimplu("elastomer", 25, 13, "ml", 250).total, 2);
  });
});

describe("corectarea descrierii schimba sistemul extras", () => {
  it("editand denumirea, extrageDeterminist da alt sistem decat inainte", async () => {
    const foaie = await registru([
      ["Nr", "Denumire articol", "UM", "Cantitate"],
      [1, "Izolatie elastomer 13 mm pe teava DN25 apa rece", "ml", 100],
    ]);
    const rand: RandBrut = foaie.randuri[1]!;
    const linieVeche = rand.linie!;

    const inainte = extrageDeterminist(
      linieVeche.index, linieVeche.text, linieVeche.um, undefined, linieVeche.cantitate,
    ).linie.sistem;
    expect(inainte).toBe("elastomer");

    const cDenumire = 1;
    scrieCelula(rand, cDenumire, "Izolatie vata minerala 13 mm pe teava DN25 apa rece");
    reconstruieste(rand);

    expect(rand.linie!.text).toBe("Izolatie vata minerala 13 mm pe teava DN25 apa rece");

    const dupa = extrageDeterminist(
      rand.linie!.index, rand.linie!.text, rand.linie!.um, undefined, rand.linie!.cantitate,
    ).linie.sistem;
    expect(dupa).toBe("vata_minerala");
    expect(dupa).not.toBe(inainte);
  });
});

describe("celula imbinata pe mai multe coloane", () => {
  it("valoarea noua apare pe toate pozitiile span-ului in linie.celule", async () => {
    // Coloana de denumire e imbinata pe doua coloane Excel (B:C), deci in
    // RandBrut.celule ajunge o singura celula cu span 2, dar in
    // LinieBruta.celule (brute) valoarea trebuie sa apara de doua ori.
    const foaie = await registru(
      [
        ["Nr", "Denumire", "", "UM", "Cantitate"],
        [1, "Izolatie elastomer DN25 grosime 13", null, "ml", 100],
      ],
      ["B2:C2"],
    );
    const rand: RandBrut = foaie.randuri[1]!;
    // Confirma forma asteptata inainte de editare, ca sa nu testam pe o
    // presupunere gresita despre cum a imbinat ExcelJS randul.
    expect(rand.celule[1]).toEqual({ v: "Izolatie elastomer DN25 grosime 13", span: 2 });
    expect(rand.linie?.celule.slice(1, 3)).toEqual([
      "Izolatie elastomer DN25 grosime 13", "Izolatie elastomer DN25 grosime 13",
    ]);

    scrieCelula(rand, 1, "Izolatie noua descriere pentru pozitia asta");

    expect(rand.linie?.celule[1]).toBe("Izolatie noua descriere pentru pozitia asta");
    expect(rand.linie?.celule[2]).toBe("Izolatie noua descriere pentru pozitia asta");
  });
});

describe("golirea descrierii scoate randul din pozitii", () => {
  it("text devine gol, fara um/cantitate, iar extragerea determinista da sistem null", async () => {
    const foaie = await registru([
      ["Nr", "Denumire articol", "UM", "Cantitate"],
      [1, "Izolatie elastomer 13 mm pe teava DN25 apa rece", "ml", 100],
    ]);
    const rand: RandBrut = foaie.randuri[1]!;
    expect(rand.linie).toBeDefined();

    scrieCelula(rand, 1, null);
    reconstruieste(rand);

    expect(rand.linie?.text).toBe("");
    expect(rand.linie?.um).toBeUndefined();
    expect(rand.linie?.cantitate).toBeUndefined();

    const rezultat = extrageDeterminist(
      rand.linie!.index, rand.linie!.text, rand.linie!.um, undefined, rand.linie!.cantitate,
    );
    expect(rezultat.linie.sistem).toBeNull();
  });
});

describe("maparea trebuie reaplicata pe rand dupa o editare", () => {
  it("aplicaMapareRand bate euristica de cantitate dupa reconstructie", async () => {
    // Reproduce bug-ul documentat in mapare.ts: euristica "primul numar lipit
    // de UM" citeste pretul unitar (5,99) drept cantitate, pentru ca sta chiar
    // dupa coloana "UM". Cantitatea reala e mai departe, in ultima coloana.
    const foaie = await registru([
      ["Nr", "Denumire", "UM", "Pret unitar", "Cantitate"],
      [1, "Izolatie elastomer 13 mm pe teava DN25 apa rece", "ml", 5.99, 187],
    ]);
    const mapare: MapareFoaie = {
      rand_antet: 0, rand_start: 1,
      roluri: ["nr", "denumire", "um", "pret_unitar", "cantitate"],
      motiv: "test",
    };
    const rand: RandBrut = foaie.randuri[1]!;

    // Euristica de la parsare a picat exact in capcana descrisa mai sus.
    expect(rand.linie?.cantitate).toBe(5.99);

    aplicaMapareRand(rand, mapare);
    expect(rand.linie?.cantitate).toBe(187);

    // O corectie de celula (aici pe denumire) trece prin `reconstruieste`,
    // care nu stie nimic despre mapare si recade pe euristica gresita.
    scrieCelula(rand, 1, "Izolatie elastomer 13 mm pe teava DN25 apa rece, corectat");
    reconstruieste(rand);
    expect(rand.linie?.cantitate).toBe(5.99);

    // Reaplicarea mapatii pe ACEST rand restaureaza cantitatea corecta —
    // motivul pentru care `aplicaMapareRand` exista separat de `aplicaMapare`.
    aplicaMapareRand(rand, mapare);
    expect(rand.linie?.cantitate).toBe(187);
  });
});

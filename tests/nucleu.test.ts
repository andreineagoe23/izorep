/**
 * Nucleul comun de import: acelasi drum L0-L4 pe care il parcurg si CLI-ul, si
 * ecranul. Testele de aici verifica exact cele trei bug-uri masurate ale
 * driftului ecran/pipeline (guardrails, `modelFaraRaspuns`, plafonul per
 * import) si `reevalueaza`, drumul de recalcul dupa o corectie in grila.
 *
 * Registrul se construieste in test cu ExcelJS, ca in `tests/pipeline.test.ts`:
 * fisierele clientilor nu sunt in repo, iar o suita care le-ar citi din
 * `../attachments/` ar deveni saritoare in CI. Fara retea: `Extractor`-ul e o
 * functie falsa, definita local.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { parseFoi } from "../src/import/parse-workbook.js";
import { scrieCelula, reconstruieste } from "../src/import/editare.js";
import { proceseazaRegistru, reevalueaza, type Extractor, type Rezultat } from "../src/import/nucleu.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { tarifeazaSimplu } from "../src/pricing/engine.js";
import type { LinieExtrasa } from "../src/import/schema.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "izorep-nucleu-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

async function registru(randuri: (string | number | null)[][]): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lista");
  for (const r of randuri) ws.addRow(r);
  const cale = join(dir, "test.xlsx");
  await wb.xlsx.writeFile(cale);
  return cale;
}

const ANTET: (string | number | null)[] = ["Nr. crt.", "Denumire articol", "UM", "Cantitate"];

/** O linie extrasa completa, gata de tarifat, cu campurile date suprascrise. */
const extrasa = (p: Partial<LinieExtrasa> & { index: number }): LinieExtrasa => ({
  sistem: "elastomer", diametru_valoare: 50, diametru_tip: "DN", grosime_mm: 13,
  forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [],
  incredere: 0.9, motiv: "test",
  ...p,
});

describe("proceseazaRegistru cu un extractor fals", () => {
  it("da aceleasi statistici ca drumul determinist, pe liniile pe care le rezolva amandoua", async () => {
    const RANDURI = [
      ANTET,
      [1, "Izolatie elastomer 13 mm pe teava DN25 apa rece", "ml", 100],
      [2, "Izolatie elastomer 19 mm pe teava DN80 apa rece", "ml", 50],
    ];
    const cale = await registru(RANDURI);

    // Fara extractor: totul se rezolva determinist (regex-ul le prinde pe
    // amandoua). Cu un extractor fals care n-ar trebui niciodata chemat (nu
    // exista nicio linie reziduala): rezultatul trebuie sa fie IDENTIC.
    const foiA = await parseFoi(cale);
    const rezFaraModel = await proceseazaRegistru(foiA, { stoc: stocInMemorie() });

    const nutrebuieChemat: Extractor = () => { throw new Error("nu trebuia chemat"); };
    const foiB = await parseFoi(cale);
    const rezCuExtractor = await proceseazaRegistru(foiB, { stoc: stocInMemorie(), extrage: nutrebuieChemat });

    expect(rezCuExtractor.statistici).toEqual(rezFaraModel.statistici);
    expect(rezCuExtractor.linii.map((l) => l.extras)).toEqual(rezFaraModel.linii.map((l) => l.extras));
  });
});

describe("bugetul de linii trimise la model e PER IMPORT", () => {
  it("cu maxLiniiModel: 2 si 5 linii reziduale, se trimit maximum 2, restul e trunchiat", async () => {
    // Cinci texte fara nicio cifra si fara niciun cuvant de sistem: regexul nu
    // gaseste sistem (reziduale), iar sabloanele lor sunt toate DISTINCTE
    // (fara cifre de mascat), deci fiecare e reprezentantul propriului grup —
    // niciunul nu se poate deduce din altul, toate cinci ar pleca la model.
    const RANDURI = [
      ANTET,
      [1, "Alfa unu doi trei fara sistem cunoscut", "buc", 1],
      [2, "Beta patru cinci sase fara sistem cunoscut", "buc", 1],
      [3, "Gama sapte opt noua fara sistem cunoscut", "buc", 1],
      [4, "Delta zece unsprezece fara sistem cunoscut", "buc", 1],
      [5, "Epsilon doisprezece treisprezece fara sistem", "buc", 1],
    ];
    const cale = await registru(RANDURI);
    const foi = await parseFoi(cale);

    const primite: string[] = [];
    const extractor: Extractor = async (linii) => {
      primite.push(...linii.map((l) => l.text));
      return linii.map((l) => extrasa({ index: l.index }));
    };

    const rez = await proceseazaRegistru(foi, {
      stoc: stocInMemorie(), extrage: extractor, maxLiniiModel: 2,
    });

    expect(rez.statistici.reziduale).toBe(5);
    expect(rez.statistici.trimiseLaModel).toBe(2);
    expect(rez.statistici.trunchiat).toBe(3);
    expect(primite.length).toBe(2);
  });
});

describe("modelFaraRaspuns", () => {
  it("extractorul care intoarce mai putine obiecte decat a primit: contorul e exact diferenta", async () => {
    const RANDURI = [
      ANTET,
      [1, "Alfa unu doi trei fara sistem cunoscut", "buc", 1],
      [2, "Beta patru cinci sase fara sistem cunoscut", "buc", 1],
      [3, "Gama sapte opt noua fara sistem cunoscut", "buc", 1],
    ];
    const cale = await registru(RANDURI);
    const foi = await parseFoi(cale);

    // Raspunde doar pentru primele doua din cele trei primite.
    const extractor: Extractor = async (linii) =>
      linii.slice(0, 2).map((l) => extrasa({ index: l.index }));

    const rez = await proceseazaRegistru(foi, { stoc: stocInMemorie(), extrage: extractor });

    expect(rez.statistici.trimiseLaModel).toBe(3);
    expect(rez.statistici.modelFaraRaspuns).toBe(1);
  });
});

describe("guardrails pe drumul ecranului", () => {
  it("un diametru necitat in text ajunge cu incredere 0, necesitaValidare true si avertisment", async () => {
    // Textul spune Di60, dar n-are nicio grosime plauzibila — regexul il lasa
    // deci incomplet (reziduala), desi gaseste sistemul si diametrul.
    // Extractorul falsifica diametrul la 76 la intoarcere — exact cazul
    // masurat pe cerere-de-oferta-transavia-inox.xlsx cu gpt-4.1-mini.
    const RANDURI = [
      ANTET,
      [1, "Izolatii cu vata minerala pentru teava Di60, fara alte detalii - COT", "buc", 2],
    ];
    const cale = await registru(RANDURI);
    const foi = await parseFoi(cale);

    const extractor: Extractor = async (linii) => linii.map((l) => extrasa({
      index: l.index, sistem: "vata_minerala", diametru_valoare: 76, diametru_tip: "interior",
      grosime_mm: 50, forma: "cot", incredere: 0.95,
    }));

    const rez = await proceseazaRegistru(foi, { stoc: stocInMemorie(), extrage: extractor });

    const linie = rez.linii.find((l) => l.extras.sistem === "vata_minerala");
    expect(linie).toBeDefined();
    expect(linie!.sursa).toBe("model");
    expect(linie!.extras.incredere).toBe(0);
    expect(linie!.necesitaValidare).toBe(true);
    expect(linie!.avertismente?.map((a) => a.cod)).toContain("diametru_necitat");
  });
});

describe("reevalueaza", () => {
  it("o corectie in grila (scrieCelula + reconstruieste) schimba pretul", async () => {
    const RANDURI = [
      ANTET,
      [1, "Izolatie elastomer 13 mm pe teava DN25 apa rece", "ml", 100],
    ];
    const cale = await registru(RANDURI);
    const foi = await parseFoi(cale);
    const opt = { stoc: stocInMemorie() };

    const rez: Rezultat = await proceseazaRegistru(foi, opt);
    // Randul de antet (index 0) e si el o "linie" (fara masura), asa ca
    // pozitia reala se cauta dupa text, nu se presupune primul index.
    const liniePret = rez.linii.find((l) => l.bruta.text.includes("DN25"))!;
    const inainte = liniePret.pret!.total;

    const rand = foi[0]!.randuri[1]!;
    const cCantitate = 3; // Nr | Denumire | UM | Cantitate, fara imbinari
    scrieCelula(rand, cCantitate, 250);
    reconstruieste(rand);

    reevalueaza(rez, opt);

    const dupa = rez.linii.find((l) => l.bruta.text.includes("DN25"))!.pret!.total;
    expect(dupa).not.toBeCloseTo(inainte, 2);
    expect(dupa).toBeCloseTo(tarifeazaSimplu("elastomer", 25, 13, "ml", 250).total, 2);
  });

  it("o linie cu sursa 'om' nu se re-extrage niciodata si isi pastreaza valorile", async () => {
    const RANDURI = [
      ANTET,
      [1, "Pozitie nerecunoscuta de regex, fara sistem in text", "ml", 10],
    ];
    const cale = await registru(RANDURI);
    const foi = await parseFoi(cale);
    const opt = { stoc: stocInMemorie() };

    const rez: Rezultat = await proceseazaRegistru(foi, opt);
    // Randul de antet (index 0) se rezolva singur ca "fara masura"; pozitia
    // noastra ramane reziduala, deci nerezolvata.
    const tinta = rez.brute.find((b) => b.text.includes("Pozitie nerecunoscuta"))!;
    expect(rez.rezolvate.has(tinta.index)).toBe(false);

    // Omul o corecteaza direct in coloanele extrase: sistem, diametru, grosime.
    const corectat = extrasa({ index: tinta.index, sistem: "elastomer", diametru_valoare: 25, grosime_mm: 13 });
    rez.rezolvate.set(tinta.index, { extras: corectat, sursa: "om" });

    reevalueaza(rez, opt);

    const linie = rez.linii.find((l) => l.extras.index === tinta.index);
    expect(linie).toBeDefined();
    expect(linie!.sursa).toBe("om");
    expect(linie!.extras).toEqual(corectat);
    expect(linie!.necesitaValidare).toBe(false);
    expect(linie!.avertismente).toBeUndefined();
    expect(linie!.pret!.total).toBeCloseTo(tarifeazaSimplu("elastomer", 25, 13, "ml", 10).total, 2);

    // O a doua reevaluare (ex: dupa alta editare in alta parte a fisierului)
    // nu se atinge de linia "om".
    reevalueaza(rez, opt);
    expect(rez.rezolvate.get(tinta.index)).toEqual({ extras: corectat, sursa: "om" });
  });
});

describe("grosimile propuse", () => {
  // Textul real de pe cererea Abur: clientul nu scrie grosimea vatei.
  const CASETA = "Caseta izolatie armaturi cu flanse DN50 din tabla aluminiu si vata minerala";

  it("intra in pret, dar linia ramane de validat si nu devine a omului", async () => {
    const rez = await proceseazaRegistru(await parseFoi(await registru([ANTET, [1, CASETA, "buc", 6]])), { stoc: stocInMemorie() });
    const fara = rez.linii.find((l) => l.bruta.text.includes("Caseta"))!;
    expect(fara.extras.grosime_mm).toBeNull();
    expect(fara.pret).toBeUndefined();

    reevalueaza(rez, { stoc: stocInMemorie(), grosimiPropuse: new Map([[fara.extras.index, 40]]) });
    const cu = rez.linii.find((l) => l.bruta.text.includes("Caseta"))!;
    expect(cu.extras.grosime_mm).toBe(40);
    expect(cu.pret).toBeDefined();
    expect(cu.sursa).not.toBe("om");
    expect(cu.necesitaValidare).toBe(true);
    expect(cu.pret!.noteDeVerificat?.join(" ")).toContain("propusa");
    // Nimic scris in `rezolvate`: grosimea nu se da drept extrasa din text.
    expect(rez.rezolvate.get(cu.extras.index)!.extras.grosime_mm).toBeNull();
  });

  it("confirmarea o scoate de la validare si pastreaza pretul", async () => {
    const rez = await proceseazaRegistru(await parseFoi(await registru([ANTET, [1, CASETA, "buc", 6]])), { stoc: stocInMemorie() });
    const idx = rez.linii.find((l) => l.bruta.text.includes("Caseta"))!.extras.index;
    const opt = { stoc: stocInMemorie(), grosimiPropuse: new Map([[idx, 40]]) };
    reevalueaza(rez, opt);
    const pret = rez.linii.find((l) => l.extras.index === idx)!.pret!.pret_unitar;

    // Exact ce face `confirma` din web/validare.ts.
    rez.rezolvate.set(idx, { extras: rez.rezolvate.get(idx)!.extras, sursa: "om" });
    reevalueaza(rez, opt);
    const dupa = rez.linii.find((l) => l.extras.index === idx)!;
    expect(dupa.necesitaValidare).toBe(false);
    expect(dupa.pret!.pret_unitar).toBe(pret);
  });
});

describe("o nota care cere ochi se stinge la confirmare", () => {
  it("PVC pe industrial: marcat inainte, nemarcat dupa confirmare", async () => {
    const opt = { stoc: stocInMemorie(), destinatie: "industrial" as const };
    const rez = await proceseazaRegistru(await parseFoi(await registru([
      ANTET, [1, "Izolatie vata minerala 50 mm DN50 cu protectie PVC", "ml", 10],
    ])), opt);
    const l = rez.linii.find((x) => x.extras.sistem !== null)!;
    expect(l.pret?.noteDeVerificat?.length).toBeGreaterThan(0);
    expect(l.necesitaValidare).toBe(true);

    rez.rezolvate.set(l.extras.index, { extras: l.extras, sursa: "om" });
    reevalueaza(rez, opt);
    const dupa = rez.linii.find((x) => x.extras.index === l.extras.index)!;
    // Inainte ramanea marcata la nesfarsit: confirmarea n-avea niciun efect,
    // iar pozitia nu ajungea niciodata pe foaia Ofertă.
    expect(dupa.necesitaValidare).toBe(false);
    expect(dupa.pret?.noteDeVerificat?.length).toBeGreaterThan(0);
  });
});

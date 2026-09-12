/**
 * Pipeline-ul cap-coada, fara model si fara retea.
 *
 * Registrul se construieste in test, nu se citeste din `../attachments/`:
 * fisierele clientilor nu sunt in repo, iar o suita care se sare arata exact
 * ca una care trece. Cu `--fara-model` drumul ramane integral determinist —
 * parsare, sectiuni, memorie, regex, tarifare — deci rezultatul e o valoare
 * fixa, nu o aproximare.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { importaFisier } from "../src/import/pipeline.js";
import { invata, stocInMemorie } from "../src/import/memorie.js";
import { tarifeazaSimplu } from "../src/pricing/engine.js";
import type { LinieExtrasa } from "../src/import/schema.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "izorep-pipe-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

/** Un registru mic, cu antet, o sectiune si trei pozitii. */
async function registru(randuri: (string | number | null)[][]): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lista");
  for (const r of randuri) ws.addRow(r);
  const cale = join(dir, "test.xlsx");
  await wb.xlsx.writeFile(cale);
  return cale;
}

const RANDURI: (string | number | null)[][] = [
  ["Nr. crt.", "Denumire articol", "UM", "Cantitate"],
  [1, "Izolatie elastomer 13 mm pe teava DN25 apa rece", "ml", 100],
  [2, "Izolatie elastomer 19 mm pe teava DN80 apa rece", "ml", 50],
  [3, "Grila de ventilatie 300x300 cu jaluzele reglabile", "buc", 4],
];

describe("importaFisier, doar stratul determinist", () => {
  it("tarifeaza pozitiile de izolatie si respinge alta meserie", async () => {
    const raport = await importaFisier(await registru(RANDURI), {
      faraModel: true, stoc: stocInMemorie(),
    });

    expect(raport.liniiIzolatie).toBe(2);
    expect(raport.prinRegex).toBe(2);
    expect(raport.prinModel).toBe(0);
    expect(raport.tarifate).toBe(2);
    expect(raport.netarifate).toBe(0);

    // Valoarea nu e o constanta scrisa de mana: vine din acelasi motor pe care
    // il verifica `pricing.test.ts` pe ofertele semnate.
    const asteptat =
      tarifeazaSimplu("elastomer", 25, 13, "ml", 100).total
      + tarifeazaSimplu("elastomer", 80, 19, "ml", 50).total;
    expect(raport.valoareTotala).toBeCloseTo(asteptat, 2);

    // Grila e alta meserie: se respinge explicit, nu se ghiceste.
    const grila = raport.linii.find((l) => l.bruta.text.includes("Grila"));
    expect(grila?.extras.sistem).toBeNull();
  });

  it("citeste cantitatea de pe rand, nu numarul curent al pozitiei", async () => {
    const raport = await importaFisier(await registru(RANDURI), {
      faraModel: true, stoc: stocInMemorie(),
    });
    expect(raport.linii.map((l) => l.bruta.cantitate)).toContain(100);
    expect(raport.linii.map((l) => l.bruta.cantitate)).not.toContain(1);
  });

  it("nu cheama modelul si nu raporteaza linii pierdute", async () => {
    const raport = await importaFisier(await registru(RANDURI), {
      faraModel: true, stoc: stocInMemorie(),
    });
    expect(raport.trimiseLaModel).toBe(0);
    expect(raport.modelFaraRaspuns).toBe(0);
    expect(raport.cuAvertisment).toBe(0);
  });
});

describe("memoria intra in pipeline inaintea modelului", () => {
  // O linie pe care regexul NU o rezolva: sistemul nu apare in text.
  const NECUNOSCUTA = "Pozitie speciala pentru teava DN50 cu strat de 13 mm";

  const corectat: LinieExtrasa = {
    index: 0, sistem: "elastomer", diametru_valoare: 50, diametru_tip: "DN",
    grosime_mm: 13, forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null,
    straturi_extra: [], incredere: 1, motiv: "corectat de om",
  };

  it("fara memorie linia ramane nerezolvata", async () => {
    const cale = await registru([RANDURI[0]!, [1, NECUNOSCUTA, "ml", 10]]);
    const raport = await importaFisier(cale, { faraModel: true, stoc: stocInMemorie() });
    expect(raport.liniiIzolatie).toBe(0);
  });

  it("cu sablonul invatat, aceeasi linie se rezolva si se tarifeaza", async () => {
    const stoc = stocInMemorie([invata(NECUNOSCUTA, corectat)!]);
    const cale = await registru([RANDURI[0]!, [1, NECUNOSCUTA, "ml", 10]]);
    const raport = await importaFisier(cale, { faraModel: true, stoc });

    expect(raport.prinMemorie).toBe(1);
    expect(raport.prinModel).toBe(0);
    expect(raport.tarifate).toBe(1);
    expect(raport.valoareTotala).toBeCloseTo(tarifeazaSimplu("elastomer", 50, 13, "ml", 10).total, 2);
  });

  it("sablonul invatat da VALORILE liniei noi, nu pe ale exemplului", async () => {
    // Miza intregului mecanism: se memoreaza rolul, nu valorile. Aceeasi
    // fraza cu DN100 si 19 mm trebuie sa iasa DN100 si 19 mm.
    const stoc = stocInMemorie([invata(NECUNOSCUTA, corectat)!]);
    const cale = await registru([
      RANDURI[0]!,
      [1, "Pozitie speciala pentru teava DN100 cu strat de 19 mm", "ml", 10],
    ]);
    const raport = await importaFisier(cale, { faraModel: true, stoc });

    const l = raport.linii.find((x) => x.sursa === "memorie");
    expect(l?.extras.diametru_valoare).toBe(100);
    expect(l?.extras.grosime_mm).toBe(19);
    expect(l?.extras.sistem).toBe("elastomer");
  });
});

describe("notele de la finalul ofertei nu sunt pozitii", () => {
  // Randurile de mai jos sunt copiate dintr-o oferta reala (Matari,
  // 27.04.2026). Contin exact cuvintele dupa care se recunoaste sistemul —
  // "inchideri goluri la foc", "banda wrap", "Armaflex" — dar sunt note, nu
  // pozitii. Fara regula "trebuie UM sau cantitate" intrau toate in raport.
  const NOTE: (string | number | null)[][] = [
    [null, "Nota:", null, null],
    [null, "Preturile sunt exprimate in Euro si nu contin TVA. Plata se face in Lei la cursul BNR din ziua facturarii.", null, null],
    [null, "Preturile se refera la inchideri goluri la foc EI60 si EI90 pentru conducte metalice", null, null],
    [null, "In pretul inchiderilor golurilor la foc nu sunt incluse colierele si banda wrap", null, null],
    [null, "Daca inchiderile golurilor la foc necesita banda wrap, pretul acestora va fi constituit din pretul", null, null],
    [null, "1. Izolatii conducte PPR cu Armaflex gr. 9 mm - manopera :", null, null],
    [null, "R&F ISORAD SYSTEM SRL", null, null],
  ];

  it("nicio nota nu devine pozitie", async () => {
    const raport = await importaFisier(await registru([RANDURI[0]!, ...NOTE]), {
      faraModel: true, stoc: stocInMemorie(),
    });
    expect(raport.liniiIzolatie).toBe(0);
    expect(raport.faraMasura).toBe(NOTE.length);
  });

  it("notele nu pleaca nici la model", async () => {
    // Nu e doar zgomot in raport: fiecare nota ar fi o linie reziduala, deci
    // tokeni cheltuiti ca modelul sa spuna ca nu e nimic acolo.
    const raport = await importaFisier(await registru([RANDURI[0]!, ...NOTE]), {
      faraModel: true, stoc: stocInMemorie(),
    });
    expect(raport.linii.every((l) => l.sursa === "regex")).toBe(true);
    expect(raport.trimiseLaModel).toBe(0);
  });

  it("pozitiile reale din acelasi fisier raman", async () => {
    const raport = await importaFisier(await registru([RANDURI[0]!, RANDURI[1]!, ...NOTE]), {
      faraModel: true, stoc: stocInMemorie(),
    });
    expect(raport.liniiIzolatie).toBe(1);
    expect(raport.tarifate).toBe(1);
  });

  it("o pozitie cu cantitate dar fara UM ramane pozitie", async () => {
    // Regula cere UNA din cele doua, nu amandoua: sunt fisiere fara coloana de
    // unitate, in care cantitatea e singurul semn ca randul e ofertabil.
    const raport = await importaFisier(await registru([
      RANDURI[0]!,
      [1, "Izolatie elastomer 13 mm pe teava DN25 apa rece", null, 100],
    ]), { faraModel: true, stoc: stocInMemorie() });
    expect(raport.liniiIzolatie).toBe(1);
    expect(raport.tarifate).toBe(1);
  });
});

describe("tubulatura spiro se citeste ca diametru exterior", () => {
  it("SPIRO DN160 se tarifeaza singur, dupa raspunsul firmei", async () => {
    // Testul asta a cerut exact opusul pana pe 11 septembrie 2026: pozitia
    // trebuia sa ramana NETARIFATA, fiindca nu stiam daca "DN 160" pe spiro e
    // DN de otel sau diametru exterior, iar un pret gresit tacut e mai scump
    // decat o pozitie marcata. Firma a raspuns — "la spiro este doar diametru
    // exterior" — deci nu mai e nimic de ghicit si linia trece singura.
    const raport = await importaFisier(await registru([
      RANDURI[0]!,
      [1, "Zuluft Wickelfalzrohr starr SPIRO DN 160, Armaflex 9mm", "ml", 12],
    ]), { faraModel: true, stoc: stocInMemorie() });

    expect(raport.tarifate).toBe(1);
    const l = raport.linii.find((x) => x.extras.sistem !== null)!;
    expect(l.extras.diametru_tip).toBe("exterior");
    expect(l.extras.diametru_valoare).toBe(160);
    expect(l.eroare).toBeUndefined();
    expect(l.necesitaValidare).toBe(false);
  });
});

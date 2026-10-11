/**
 * Faza 4: comanda și recepția (`src/stoc/comenzi.ts`, `src/stoc/produse.ts`).
 *
 * Lanțul real e cel primit de la firmă pe 5 octombrie 2026, pe TRANSAVIA ALBA
 * IULIA: comanda din 13 iulie 2026 (email), avizul ISOLINE CS 20261262 din 17
 * iulie (350 ML, fără preț, „urmează factura”) și factura CS 202627295 din 20
 * iulie (39,7719 lei/ml, curs 5,31, 16.843,40 lei cu TVA).
 */
import { describe, it, expect } from "vitest";
import {
  ciorneDinRamas, deComandatSantier, furnizorPropus, inlocuiesteCuFactura, intrariDinReceptie, primitPeLinii,
  stareComanda, textEmail, valideazaReceptie, type Comanda,
} from "../src/stoc/comenzi.js";
import { articolDinDenumire, denumireComanda } from "../src/stoc/produse.js";
import { articolDin, pretMediu, solduri, type Miscare } from "../src/stoc/registru.js";
import { materialManual } from "../src/stoc/necesar.js";

let n = 0;
const id = (): string => `x${++n}`;
const cochilie = articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 140 });

const comanda = (p: Partial<Comanda> = {}): Comanda => ({
  id: "C1", creat: "2026-07-13T10:37:00.000Z", furnizor: "Banda Tech", firma: "RADOIA ISOLIRUNG SRL",
  santier: "S-TRANSAVIA", spre: "S-TRANSAVIA", linii: [{ id: "L1", articol: cochilie, cantitate: 350 }], ...p,
});

describe("denumirile furnizorilor, din evidența firmei", () => {
  it.each([
    ["COCHILTECH AL. 140 X 50", "vata_minerala", "tub", 50, 140, "Cochiltech"],
    // DN100: producătorul scrie 116, necesarul are rândul 114 din lista de vată.
    ["COCHILTECH AL. 116X50", "vata_minerala", "tub", 50, 114, "Cochiltech"],
    ["ARMAFLEX ACE PLUS TUBES 09 X 60", "elastomer", "tub", 9, 60, "Armaflex"],
    ["TUBURI K-FLEX 25X89", "elastomer", "tub", 25, 89, "K-Flex"],
    ["NMC TUBURI 09 X 28", "elastomer", "tub", 9, 28, "NMC"],
    ["ST 9x22", "elastomer", "tub", 9, 22, "K-Flex"],
    ["ARMAFLEX ACE PLACA 25 MM", "elastomer", "placa", 25, null, "Armaflex"],
    ["PLACA NEADEZIVA K-FLEX ST 19 MM", "elastomer", "placa", 19, null, "K-Flex"],
    ["ARMAFLEX ACE PLACA 19-99/E", "elastomer", "placa", 19, null, "Armaflex"],
    ["LM ECO ALU M 50X1000X5000", "vata_minerala", "saltea", 50, null, "LM Eco"],
    ["LAROCK 32 KG/M³ ALS 030/08000/1000 1 ST/ROL", "vata_minerala", "saltea", 30, null, "Rockwool"],
    ["TECHROCK 80 ALS 040/01000/0600 10PAC/PAL", "vata_minerala", "placa", 40, null, "Rockwool"],
    ["TABLA AL. 0,8*1000", "tabla", "tabla", 0.8, null, undefined],
    ["BANDA ALUMINIU 0.8X1000 MM EN AW 1050 H24", "tabla", "tabla", 0.8, null, undefined],
    ["TABLA INOX 0.4 X 1000 X 2000", "tabla_inox", "tabla", 0.4, null, undefined],
  ])("%s", (den, sistem, forma, g, rand, marca) => {
    expect(articolDinDenumire(den)).toMatchObject({ sistem, forma, grosime_mm: g, rand, ...(marca ? { marca } : {}) });
  });

  it("accesoriile nu sunt articole de stoc (S18: cost general)", () => {
    for (const d of ["ADEZIV ARMAFLEX 520 2,5 L", "BANDA ALU COROPLAST 930SE 75X50", "TRANSPORT", "PALET"]) {
      expect(articolDinDenumire(d), d).toBeNull();
    }
  });

  it("pe comandă, ca în emailul firmei: „Cochilii caserate Ø140 x 50 mm”", () => {
    expect(denumireComanda(cochilie)).toBe("Cochilii caserate Ø140 x 50 mm");
    expect(denumireComanda(articolDin({ sistem: "vata_minerala", grosime_mm: 60, rand: null })))
      .toBe("Saltea vată minerală lamelară caserată Al 60 mm");
  });
});

describe("comanda TRANSAVIA, ca în emailul din 13 iulie 2026", () => {
  it("textul de email are forma comenzii reale", () => {
    expect(textEmail(comanda(), "TRANSAVIA ALBA-IULIA")).toBe([
      "Buna ziua,", "", "Dorim sa comandam pentru obiectivul TRANSAVIA ALBA-IULIA urmatoarele :",
      "* Cochilii caserate Ø140 x 50 mm = 350 m ;", "", "Factura pe RADOIA ISOLIRUNG SRL.", "", "Multumim !",
    ].join("\n"));
  });

  it("tabla se cere la kg (S13), cu m² alături", () => {
    const tabla = articolDin({ sistem: "tabla", grosime_mm: 0.8, rand: null });
    expect(textEmail(comanda({ linii: [{ id: "T", articol: tabla, cantitate: 889.67 }] }), "X"))
      .toContain("* Tablă aluminiu 0,8 mm = 1.922 kg (889,67 m²) ;");
  });

  it("furnizorul propus e cel de la care cumpără de obicei", () => {
    expect(furnizorPropus(cochilie)).toBe("Isoline");
    expect(furnizorPropus(articolDin({ sistem: "elastomer", grosime_mm: 19, rand: 48 }))).toBe("Banda Tech");
    expect(furnizorPropus(articolDin({ sistem: "tabla_inox", grosime_mm: 0.4, rand: null }))).toBe("Direct Line Inox");
  });
});

describe("recepția: avizul CS 20261262, apoi factura CS 202627295", () => {
  const trimisa = comanda({ trimisa: "2026-07-13T10:40:00.000Z" });
  const aviz = { tip: "aviz" as const, serie: "CS", numar: "20261262", data: "2026-07-17" };

  it("ciorna nu se recepționează; avizul fără preț e voie", () => {
    expect(valideazaReceptie({ comanda: comanda(), document: aviz, linii: [{ linie: "L1", cantitate: 350 }] }))
      .toBe("Comanda nu a fost trimisă: trimite-o întâi.");
    expect(valideazaReceptie({ comanda: trimisa, document: aviz, linii: [{ linie: "L1", cantitate: 350 }] })).toBeNull();
  });

  it("avizul pune marfa pe șantier; comanda e primită", () => {
    const intrari = intrariDinReceptie({ comanda: trimisa, document: aviz, linii: [{ linie: "L1", cantitate: 350 }] }, id, "2026-07-17T08:00:00.000Z");
    expect(intrari).toHaveLength(1);
    expect(intrari[0]).toMatchObject({ tip: "intrare", spre: "S-TRANSAVIA", cantitate: 350, comanda: { id: "C1", linie: "L1" }, nota: "aviz CS 20261262" });
    expect(intrari[0]!.pret).toBeUndefined();
    expect(stareComanda(trimisa, intrari)).toBe("primita");
  });

  it("o parte primită: „primită parțial”, cu restul de primit", () => {
    const intrari = intrariDinReceptie({ comanda: trimisa, document: aviz, linii: [{ linie: "L1", cantitate: 100 }] }, id, "2026-07-17T08:00:00.000Z");
    expect(stareComanda(trimisa, intrari)).toBe("partial");
    expect(primitPeLinii(trimisa, intrari).get("L1")).toBe(100);
  });

  it("factura înlocuiește avizul: storno + intrare cu prețul ei; 39,7719 lei / 5,31 = 7,49 €", () => {
    const pePrimul = intrariDinReceptie({ comanda: trimisa, document: aviz, linii: [{ linie: "L1", cantitate: 350 }] }, id, "2026-07-17T08:00:00.000Z");
    const factura = inlocuiesteCuFactura(trimisa, pePrimul, "20261262", {
      document: { tip: "factura", serie: "CS", numar: "202627295", data: "2026-07-20" }, curs: 5.31,
      preturi: { L1: { valoare: 39.7719, moneda: "RON" } },
    }, id, "2026-07-20T08:00:00.000Z");
    const toate = [...pePrimul, ...factura];
    expect(factura.map((m) => m.anuleaza ? "storno" : m.document?.tip)).toEqual(["storno", "factura"]);
    // Stocul nu se mișcă, comanda rămâne primită, costul e cel din evidența firmei.
    expect(solduri(toate).map((s) => [s.depozit, s.cantitate])).toEqual([["S-TRANSAVIA", 350]]);
    expect(stareComanda(trimisa, toate)).toBe("primita");
    expect(pretMediu(toate, cochilie.cheie)).toBeCloseTo(7.49, 2);
    const f = factura[1]!;
    expect(f.pret).toEqual({ valoare: 7.49, lei: 39.7719, curs: 5.31 });
    expect(f.nota).toBe("factura CS 202627295 (aviz 20261262)");
    // Valoarea fără TVA de pe factură: 13.920,17 lei.
    expect(Math.round(f.pret!.lei! * f.cantitate * 100) / 100).toBe(13920.17);
  });

  it("prețul în lei cere cursul", () => {
    expect(valideazaReceptie({
      comanda: trimisa, document: { tip: "factura", numar: "1", data: "2026-07-20" },
      linii: [{ linie: "L1", cantitate: 350, pret: { valoare: 39.7719, moneda: "RON" } }],
    })).toBe("Prețul e în lei: scrie cursul de pe factură.");
  });

  it("transportul se împarte pe linii după valoare și intră în prețul unitar", () => {
    const tub = articolDin({ sistem: "elastomer", grosime_mm: 19, rand: 48 });
    const c = comanda({ trimisa: "x", linii: [{ id: "A", articol: cochilie, cantitate: 100 }, { id: "B", articol: tub, cantitate: 100 }] });
    const intrari = intrariDinReceptie({
      comanda: c, document: { tip: "factura", numar: "9", data: "2026-08-01" },
      transport: { valoare: 20, moneda: "EUR" },
      linii: [{ linie: "A", cantitate: 100, pret: { valoare: 3, moneda: "EUR" } }, { linie: "B", cantitate: 100, pret: { valoare: 1, moneda: "EUR" } }],
    }, id, "2026-08-01T00:00:00.000Z");
    // 300 € și 100 €: transportul de 20 € merge 15 / 5.
    expect(intrari.map((m) => m.pret!.valoare)).toEqual([3.15, 1.05]);
  });

  it("tabla vine la kg și intră în m²: 1.002 kg de 0,8 mm = 463,89 m²", () => {
    const tabla = articolDin({ sistem: "tabla", grosime_mm: 0.8, rand: null });
    const c = comanda({ trimisa: "x", spre: "central", linii: [{ id: "T", articol: tabla, cantitate: 463.89 }] });
    const [m] = intrariDinReceptie({
      comanda: c, document: { tip: "factura", numar: "91301355", data: "2026-09-08" }, curs: 5.32,
      linii: [{ linie: "T", cantitate: 1002, pret: { valoare: 23.63, moneda: "RON" } }],
    }, id, "2026-09-08T00:00:00.000Z");
    expect(m!.cantitate).toBe(463.889);
    // 23,63 lei/kg × 2,16 kg/m² = 51,04 lei/m² = 9,59 €/m².
    expect(m!.pret!.valoare).toBeCloseTo(9.594, 2);
  });
});

describe("rămas de comandat: necesar − adus − comandat; centralul e propunere de transfer", () => {
  const vata = materialManual("vata_minerala", 50, 140, 641, "x");
  const intrare = (p: Partial<Miscare> & Pick<Miscare, "cantitate">): Miscare =>
    ({ id: id(), data: "2026-07-01T00:00:00.000Z", tip: "intrare", articol: articolDin(vata), ...p });

  it("două șantiere nu mai numără aceiași metri din central", () => {
    const miscari = [intrare({ cantitate: 100, spre: "central" })];
    const a = deComandatSantier([vata], miscari, [], "S-A")[0]!;
    const b = deComandatSantier([vata], miscari, [], "S-B")[0]!;
    // Înainte: 541 pe fiecare (641 − 100 din central, numărat de două ori).
    expect([a.ramas, b.ramas]).toEqual([641, 641]);
    expect(a.disponibil).toEqual([{ depozit: "central", cantitate: 100 }]);
  });

  it("adusul pe șantier și comanda nesosită scad; consumul nu", () => {
    const c = comanda({ trimisa: "x", spre: "S-A", linii: [{ id: "L", articol: articolDin(vata), cantitate: 300 }] });
    const miscari: Miscare[] = [
      intrare({ cantitate: 100, spre: "central" }),
      { id: id(), data: "2026-07-02T00:00:00.000Z", tip: "transfer", articol: articolDin(vata), cantitate: 100, din: "central", spre: "S-A" },
      { id: id(), data: "2026-07-03T00:00:00.000Z", tip: "consum", articol: articolDin(vata), cantitate: 60, din: "S-A" },
      intrare({ cantitate: 120, spre: "S-A", comanda: { id: "C1", linie: "L" } }),
    ];
    const [r] = deComandatSantier([vata], miscari, [c], "S-A");
    // adus 220 (100 transferați + 120 primiți), comandat nesosit 180 → rămân 241, 241 cochilii de 1 m.
    expect([r!.adus, r!.comandat, r!.ramas, r!.ambalaje?.cate]).toEqual([220, 180, 241, 241]);
    expect(r!.disponibil).toEqual([]);
  });

  it("pe alt șantier e liber doar ce s-a adus peste nevoia lui", () => {
    const miscari = [intrare({ cantitate: 700, spre: "S-B" })];
    const [r] = deComandatSantier([vata], miscari, [], "S-A", {}, [{ depozit: "S-B", materiale: [vata] }]);
    expect(r!.disponibil).toEqual([{ depozit: "S-B", cantitate: 59 }]);
  });

  it("ciornele: una pe furnizor, cantitatea la ambalaj întreg", () => {
    const tub = materialManual("elastomer", 19, 48, 101, "x");
    const randuri = deComandatSantier([vata, tub], [], [], "S-A");
    const ciorne = ciorneDinRamas(randuri, { firma: "RADOIA ISOLIRUNG SRL", santier: "S-A", spre: "S-A" }, id, "2026-07-01T00:00:00.000Z");
    expect(ciorne.map((c) => [c.furnizor, c.linii.map((l) => l.cantitate)])).toEqual([["Isoline", [641]], ["Banda Tech", [102]]]);
  });
});

describe("evidența cumpărărilor, cu coloanele Excelului firmei", () => {
  it("factura TRANSAVIA dă rândul din evidența lor: 350 ML × 39,7719 lei, curs 5,31, 7,49 €, 13.920,17 lei", async () => {
    const { randuriEvidenta } = await import("../web/comanda-excel.js");
    const c = comanda({ trimisa: "x", furnizor: "ISOLINE SRL" });
    const aviz = intrariDinReceptie({ comanda: c, document: { tip: "aviz", serie: "CS", numar: "20261262", data: "2026-07-17" },
      linii: [{ linie: "L1", cantitate: 350 }] }, id, "2026-07-17T08:00:00.000Z");
    const f = inlocuiesteCuFactura(c, aviz, "20261262", { document: { tip: "factura", serie: "CS", numar: "202627295", data: "2026-07-20" },
      curs: 5.31, preturi: { L1: { valoare: 39.7719, moneda: "RON" } } }, id, "2026-07-20T08:00:00.000Z");
    const r = randuriEvidenta([...aviz, ...f], () => "TRANSAVIA ALBA IULIA");
    expect(r).toEqual([["ISOLINE SRL", "TRANSAVIA ALBA IULIA", "202627295", "20.07.2026", "COCHILII CASERATE Ø140 X 50 MM",
      350, "ML", 39.7719, 5.31, 7.49, 13920.17, 2621.5, "20261262"]]);
  });
});

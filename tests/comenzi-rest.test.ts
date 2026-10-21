/**
 * Faza 4, ce mai lipsea pe 11 octombrie 2026: prețurile furnizorilor pe ciornă,
 * avizul citit din poză sau PDF, returul la furnizor și comanda din
 * măsurătorile de pe teren.
 *
 * Avizul și factura sunt cele reale ISOLINE, pe TRANSAVIA ALBA IULIA, citite
 * de model pe 11 octombrie 2026 (`tests/fixtures-aviz-isoline.json`, fără
 * adrese și fără nume de oameni).
 */
import { describe, it, expect } from "vitest";
import {
  propuneriDinDepozit,
  adus, ciorneDinRamas, deComandatSantier, intrariDinReceptie, inlocuiesteCuFactura, primitPeLinii, returLaFurnizor,
  returnatPeLinii, soldPe, stareComanda, valideazaRetur, valoareAsteptata, type Comanda,
} from "../src/stoc/comenzi.js";
import { CitireAviz, receptieDinCitire } from "../src/stoc/aviz.js";
import { numeFurnizor, pretPropus, PRETURI_FURNIZORI, type PreturiFurnizori } from "../src/stoc/preturi-furnizori.js";
import { articolDin, cheieBaza, solduri, valideazaMiscare, type Miscare } from "../src/stoc/registru.js";
import { materialManual } from "../src/stoc/necesar.js";
import { necesarDinMasuratori } from "../src/stoc/din-masuratori.js";
import type { RandSantier } from "../src/santier/agrega.js";
import citiri from "./fixtures-aviz-isoline.json" with { type: "json" };

let n = 0;
const id = (): string => `r${++n}`;
const cochilie = articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 140 });
const tabla = articolDin({ sistem: "tabla", grosime_mm: 0.8, rand: null });
const comanda = (p: Partial<Comanda> = {}): Comanda => ({
  id: "C1", creat: "2026-07-13T10:37:00.000Z", furnizor: "Isoline", firma: "RADOIA ISOLIRUNG SRL",
  santier: "S-T", spre: "S-T", trimisa: "2026-07-13T10:40:00.000Z",
  linii: [{ id: "L1", articol: cochilie, cantitate: 350 }], ...p,
});

describe("prețul de pe ciornă: lista furnizorului sau ultima lui factură", () => {
  it("numele din evidență devin cele din lista furnizorilor", () => {
    expect(numeFurnizor("BANDATECH SRL")).toBe("Banda Tech");
    expect(numeFurnizor("COLOR - METAL")).toBe("Color Metal");
    expect(numeFurnizor("METAL  DM AUTOMOTIVE SRL")).toBe("Metal DM Automotive");
    expect(numeFurnizor("MTM IZOLATII & CONSTRUCTII")).toBe("MTM Izolatii");
    expect(numeFurnizor("ISOLINE SRL")).toBe("Isoline");
  });

  it("cochilia ø140 × 50 de la Isoline: ultima factură din evidență, în lei, cu cursul ei", () => {
    // Evidența: 39,77 lei/ml în iulie (factura TRANSAVIA), apoi 47,28–47,45 până în septembrie.
    const p = pretPropus(cochilie, "Isoline")!;
    expect(p).toMatchObject({ moneda: "RON", curs: 5.32 });
    expect(p.valoare).toBeGreaterThan(47);
    expect(p.sursa).toMatch(/^factura \d+ din \d{2}\.\d{2}\.2026$/);
    // Alt furnizor, care n-a vândut-o: fără preț, se scrie de mână.
    expect(pretPropus(cochilie, "Direct Line Inox")).toBeNull();
  });

  it("tubul K-Flex: din lista Banda Tech, în €/ml, când nu e o factură mai nouă", () => {
    const st13x114 = articolDin({ sistem: "elastomer", grosime_mm: 13, rand: 114 });
    expect(pretPropus(st13x114, "Banda Tech")).toEqual({
      furnizor: "Banda Tech", valoare: 3.415, moneda: "EUR", data: "2026-06-24", sursa: "lista K-Flex ST, 24.06.2026",
    });
  });

  it("tabla e pe kg, ca pe factură", () => {
    const p = PRETURI_FURNIZORI.preturi[cheieBaza(tabla)]!;
    expect(p.length).toBeGreaterThan(0);
    // Lei pe kg, nu pe m²: 0,8 mm de aluminiu e în jur de 20 de lei/kg.
    for (const x of p) expect(x.valoare).toBeLessThan(40);
  });

  it("o factură trecută în aplicație, mai nouă, bate evidența", () => {
    const surse: PreturiFurnizori = { generat: "", surse: [], preturi: {
      [cheieBaza(cochilie)]: [{ furnizor: "Isoline", valoare: 39.7719, moneda: "RON", curs: 5.31, data: "2026-07-20", sursa: "factura 202627295 din 20.07.2026" }],
    } };
    const intrare: Miscare = {
      id: "i", data: "2026-10-01T00:00:00.000Z", tip: "intrare", articol: cochilie, cantitate: 10, spre: "S-T", furnizor: "Isoline",
      document: { tip: "factura", serie: "CS", numar: "1", data: "2026-10-01" }, pret: { valoare: 9, lei: 47.88, curs: 5.32 },
    };
    expect(pretPropus(cochilie, "Isoline", [intrare], surse)).toMatchObject({ valoare: 47.88, moneda: "RON", sursa: "factura CS 1 din 01.10.2026" });
    expect(pretPropus(cochilie, "Isoline", [], surse)!.valoare).toBe(39.7719);
  });

  it("ciorna poartă prețul și valoarea așteptată, pe monedă", () => {
    const vata = materialManual("vata_minerala", 50, 140, 350, "x");
    const tub = materialManual("elastomer", 13, 114, 100, "x");
    const randuri = deComandatSantier([vata, tub], [], [], "S-T");
    const ciorne = ciorneDinRamas(randuri, { firma: "RADOIA ISOLIRUNG SRL", santier: "S-T", spre: "S-T" }, id, "2026-10-11T00:00:00.000Z",
      (a, f) => pretPropus(a, f));
    const isoline = ciorne.find((c) => c.furnizor === "Isoline")!;
    const banda = ciorne.find((c) => c.furnizor === "Banda Tech")!;
    expect(isoline.linii[0]!.pret?.moneda).toBe("RON");
    expect(banda.linii[0]!.pret).toMatchObject({ valoare: 3.415, moneda: "EUR" });
    // 100 ml = 50 de tuburi de 2 m.
    expect(valoareAsteptata(banda)).toEqual({ EUR: 341.5, RON: 0, faraPret: 0 });
  });
});

describe("avizul citit din PDF: modelul citește, codul pune pe linii", () => {
  const aviz = CitireAviz.parse(citiri.aviz);
  const factura = CitireAviz.parse(citiri.factura);

  it("avizul ISOLINE CS 20261262 completează recepția: 350 ml pe linia cochiliei, fără preț", () => {
    const r = receptieDinCitire(comanda(), aviz);
    expect(r.document).toEqual({ tip: "aviz", serie: "CS", numar: "20261262", data: "2026-07-17" });
    expect(r.linii).toEqual({ L1: { cantitate: 350 } });
    expect(r.nepotrivite).toEqual([]);
  });

  it("factura CS 202627295 aduce prețul și cursul: lanțul iese la ban, 7,49 €", () => {
    const c = comanda();
    const ra = receptieDinCitire(c, aviz);
    const intrari = intrariDinReceptie({
      comanda: c, document: { ...ra.document, numar: ra.document.numar!, data: ra.document.data!, tip: "aviz" },
      linii: Object.entries(ra.linii).map(([linie, v]) => ({ linie, cantitate: v.cantitate })),
    }, id, "2026-07-17T00:00:00.000Z");
    const rf = receptieDinCitire(c, factura);
    expect(rf).toMatchObject({ curs: 5.31, moneda: "RON", linii: { L1: { cantitate: 350, pret: { valoare: 39.7719, moneda: "RON" } } } });
    const f = inlocuiesteCuFactura(c, intrari, "20261262", {
      document: { tip: "factura", serie: rf.document.serie!, numar: rf.document.numar!, data: rf.document.data! }, curs: rf.curs!,
      preturi: { L1: rf.linii["L1"]!.pret! },
    }, id, "2026-07-20T00:00:00.000Z");
    expect(f[1]!.pret).toEqual({ valoare: 7.49, lei: 39.7719, curs: 5.31 });
  });

  it("un rând care nu e pe comandă nu se pune nicăieri; omul îl vede", () => {
    const r = receptieDinCitire(comanda(), {
      ...aviz, linii: [...aviz.linii, { cod: null, denumire: "COCHILTECH AL. 114 X 50", cantitate: 20, um: "ML", pret_unitar: null },
        { cod: null, denumire: "BANDA ALU 75MM", cantitate: 4, um: "BUC", pret_unitar: null }],
    });
    expect(r.linii).toEqual({ L1: { cantitate: 350 } });
    expect(r.nepotrivite.map((x) => x.denumire)).toEqual(["COCHILTECH AL. 114 X 50", "BANDA ALU 75MM"]);
  });

  it("altă unitate decât a articolului (MP la o cochilie) nu completează linia", () => {
    const r = receptieDinCitire(comanda(), { ...aviz, linii: [{ ...aviz.linii[0]!, um: "MP" }] });
    expect(r.linii).toEqual({});
    expect(r.umGresit).toHaveLength(1);
  });

  it("tabla vine la kg: cantitatea de pe aviz rămâne în kg, ca în formular", () => {
    const c = comanda({ linii: [{ id: "T", articol: tabla, cantitate: 463.89 }] });
    const r = receptieDinCitire(c, { ...aviz, linii: [{ cod: null, denumire: "TABLA AL. 0,8*1000", cantitate: 1002, um: "KG", pret_unitar: null }] });
    expect(r.linii).toEqual({ T: { cantitate: 1002 } });
  });
});

describe("returul la furnizor (S32)", () => {
  const c = comanda();
  const intrari = intrariDinReceptie({
    comanda: c, document: { tip: "factura", serie: "CS", numar: "202627295", data: "2026-07-20" }, curs: 5.31,
    linii: [{ linie: "L1", cantitate: 350, pret: { valoare: 39.7719, moneda: "RON" } }],
  }, id, "2026-07-20T00:00:00.000Z");

  it("iese din stoc, spre furnizor, cu prețul intrării; primitul pe comandă rămâne", () => {
    const r = { comanda: c, linie: "L1", cantitate: 20, din: "S-T", motiv: "cochilii strivite" };
    expect(valideazaRetur(r, intrari)).toBeNull();
    const m = returLaFurnizor(r, intrari, id, "2026-07-25T00:00:00.000Z");
    expect(m).toMatchObject({ tip: "retur", din: "S-T", furnizor: "Isoline", cantitate: 20, comanda: { id: "C1", linie: "L1" },
      pret: { valoare: 7.49, lei: 39.7719, curs: 5.31 }, nota: "retur la Isoline: cochilii strivite" });
    expect(m.spre).toBeUndefined();
    expect(valideazaMiscare(m)).toBeNull();
    const toate = [...intrari, m];
    expect(solduri(toate).map((s) => [s.depozit, s.cantitate])).toEqual([["S-T", 330]]);
    expect(primitPeLinii(c, toate).get("L1")).toBe(350);
    expect(returnatPeLinii(c, toate).get("L1")).toBe(20);
    expect(stareComanda(c, toate)).toBe("primita");
    // Scade ce s-a adus: dacă trebuie înlocuit, reapare la „Rămas de comandat”.
    expect(adus(toate, "S-T", cochilie.cheie)).toBe(330);
  });

  it("nu se returnează mai mult decât a venit, și nu fără motiv", () => {
    expect(valideazaRetur({ comanda: c, linie: "L1", cantitate: 351, din: "S-T", motiv: "x" }, intrari))
      .toBe("Se returnează mai mult decât a venit pe linia asta.");
    expect(valideazaRetur({ comanda: c, linie: "L1", cantitate: 5, din: "S-T", motiv: " " }, intrari))
      .toBe("Scrie de ce se returnează (defect, greșit, în plus).");
  });

  it("un retur fără furnizor și fără depozit de sosire nu e valid", () => {
    expect(valideazaMiscare({ tip: "retur", articol: cochilie, cantitate: 1, din: "S-T" }))
      .toBe("Alege depozitul în care intră materialul.");
  });

  it("în evidența cumpărărilor iese cu minus", async () => {
    const { randuriEvidenta } = await import("../web/comanda-excel.js");
    const m = returLaFurnizor({ comanda: c, linie: "L1", cantitate: 20, din: "S-T", motiv: "defect",
      document: { tip: "aviz", numar: "R-7", data: "2026-07-25" } }, intrari, id, "2026-07-25T00:00:00.000Z");
    const r = randuriEvidenta([...intrari, m], () => "TRANSAVIA ALBA IULIA");
    expect(r[1]).toEqual(["Isoline", "TRANSAVIA ALBA IULIA", "R-7", "25.07.2026", "COCHILII CASERATE Ø140 X 50 MM",
      -20, "ML", 39.7719, 5.31, 7.49, -795.44, -149.8, "R-7"]);
  });
});

describe("comanda din măsurătorile de pe teren (S2)", () => {
  const rand = (p: Partial<RandSantier>): RandSantier => ({
    id: id(), zona: "A", diametru_valoare: 140, diametru_tip: "exterior", izolatie: "vata_minerala", grosime_mm: 50,
    jacheta: "aluminiu", element: "ml", pret_dublu: false, cantitate: 0, termeni: [], nesigur: false, ...p,
  });

  it("materialul etapei se calculează ca la ofertă: cochilii pe ml, tabla pe m² cu pierderi", async () => {
    const nec = await necesarDinMasuratori([rand({ cantitate: 100 }), rand({ element: "cot", cantitate: 6 })], "rezidential",
      { tuburiPeste: [140] });
    const cochilii = nec.materiale.find((m) => m.sistem === "vata_minerala")!;
    // 100 ml + 6 coturi (3 pe metru la ø114–140) = 102 ml, tuburi fără pierdere.
    expect([cochilii.categorie, cochilii.rand, cochilii.ml]).toEqual(["tub", 140, 102]);
    expect(nec.materiale.find((m) => m.sistem === "tabla")?.categorie).toBe("tabla");
  });

  it("se scade ce e acum pe șantier, nu tot ce s-a adus: ce s-a pus pe țeavă nu mai e acolo", () => {
    const vata = materialManual("vata_minerala", 50, 140, 102, "etapa 2");
    const miscari: Miscare[] = [
      { id: id(), data: "2026-07-01T00:00:00.000Z", tip: "intrare", articol: cochilie, cantitate: 200, spre: "S-T" },
      { id: id(), data: "2026-07-10T00:00:00.000Z", tip: "consum", articol: cochilie, cantitate: 180, din: "S-T" },
    ];
    expect(soldPe(miscari, "S-T", cochilie.cheie)).toBe(20);
    const [etapa] = deComandatSantier([vata], miscari, [], "S-T", {}, [], "sold");
    expect([etapa!.adus, etapa!.ramas]).toEqual([20, 82]);
    // Pe toată oferta s-ar fi scăzut cei 200 aduși: nimic de comandat, deși pe șantier mai sunt 20.
    expect(deComandatSantier([vata], miscari, [], "S-T")[0]!.ramas).toBe(0);
  });
});

describe("„Comandă ce lipsește”: întâi din depozit", () => {
  const material = materialManual("vata_minerala", 50, 114, 193.33, "test");
  const articol = articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 114 });
  const rand = (ramas: number, disponibil: { depozit: string; cantitate: number }[]) => ({ material, articol, ramas, disponibil });

  it("ia din fiecare loc cel mult cât mai lipsește", () => {
    expect(propuneriDinDepozit([rand(50, [{ depozit: "central", cantitate: 40 }, { depozit: "S2", cantitate: 30 }])], () => true))
      .toEqual([{ material, articol, din: "central", cantitate: 40 }, { material, articol, din: "S2", cantitate: 10 }]);
  });

  it("nu propune șantiere închise și nici resturi din rotunjiri", () => {
    expect(propuneriDinDepozit([rand(50, [{ depozit: "NISAL", cantitate: 30 }, { depozit: "central", cantitate: 0.01 }])],
      (d) => d !== "NISAL")).toEqual([]);
  });

  it("nimic de luat când nu lipsește nimic", () => {
    expect(propuneriDinDepozit([rand(0, [{ depozit: "central", cantitate: 40 }])], () => true)).toEqual([]);
  });
});

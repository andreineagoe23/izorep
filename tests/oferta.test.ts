/**
 * Registrul de ofertă: ce pleacă din aplicație către client.
 *
 * `web/oferta.ts` e pur — primește linii, întoarce un `ArrayBuffer` — exact ca
 * să poată fi testat aici, în Node, scriind bufferul și recitindu-l cu ExcelJS.
 * Tiparul e cel din `tests/foi.test.ts`, doar în sens invers.
 *
 * Ce se apără:
 *
 * - **împărțirea pe cele trei foi.** O poziție marcată ajunsă pe foaia `Ofertă`
 *   ar fi un preț nevalidat semnat de firmă. Asta e regula, nu formatarea.
 * - **totalul, la bănuț.** Oferta 284 reală conține `2323.0899999999997` într-o
 *   celulă: exact ce se întâmplă fără `bani()`.
 * - **cauza scrisă omenește**, nu textul brut al erorii.
 *
 * Testul de la final e cel care contează cel mai mult: `Oferta 27.04.2026
 * Matari.xlsx` importat determinist trebuie să dea un registru al cărui total
 * e **12.692,04 €** — totalul ofertei semnate. Rulează doar dacă fișierele
 * firmei sunt pe disc (nu sunt commit-uite), deci în CI se sare, vizibil
 * (`cuClienti` din `conditii.ts`).
 */
import { describe, it, expect } from "vitest";
import { CLIENTI, cuClienti } from "./conditii.js";
import { imparte, totalOferta, type AntetOferta, type Provenienta } from "../web/oferta.js";
import { registruOferta } from "../web/registru-oferta.js";
import { citesteOferta, totalul } from "./registru-citit.js";
import type { LinieProcesata } from "../src/import/nucleu.js";
import type { LinieExtrasa } from "../src/import/schema.js";

const ANTET: AntetOferta = {
  serie: "RAD", numar: "284", data: "27.05.2026",
  persoana: "Vlad Emil", client: "Grup Energoinstal SA",
  obiectiv: "TRANSAVIA ALBA-IULIA", firma: "RADOIA ISOLIRUNG SRL",
  localitate: "PALTINIS",
};

const PROV: Provenienta = {
  generatLa: "2026-09-07T10:00:00.000Z",
  destinatie: "rezidential",
  model: null,
  sesiune: "sesiune-de-test",
  fisierSursa: "test.xlsx",
};

const extrasa = (p: Partial<LinieExtrasa> = {}): LinieExtrasa => ({
  index: 1, sistem: "elastomer", diametru_valoare: 50, diametru_tip: "DN",
  grosime_mm: 13, forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null,
  straturi_extra: [], incredere: 0.99, motiv: "test",
  ...p,
});

let contor = 0;
const linie = (p: {
  text?: string;
  um?: string;
  cantitate?: number;
  sectiune?: string;
  unitar?: number;
  necesitaValidare?: boolean;
  codEroare?: LinieProcesata["codEroare"];
  avertismente?: LinieProcesata["avertismente"];
  extras?: Partial<LinieExtrasa>;
} = {}): LinieProcesata => {
  const index = ++contor;
  const l: LinieProcesata = {
    bruta: {
      index, foaie: "izolatie", rand: index,
      text: p.text ?? `Izolatie elastomer DN50 gr. 13 mm ${index}`,
      celule: [],
      ...(p.um !== undefined ? { um: p.um } : { um: "ml" }),
      ...(p.cantitate !== undefined ? { cantitate: p.cantitate } : { cantitate: 10 }),
      ...(p.sectiune !== undefined ? { sectiune: p.sectiune } : {}),
    } as LinieProcesata["bruta"],
    extras: extrasa({ index, ...p.extras }),
    sursa: "regex",
    necesitaValidare: p.necesitaValidare ?? false,
  };
  if (p.unitar !== undefined) {
    const cant = p.cantitate ?? 10;
    l.pret = {
      pret_unitar: p.unitar, cantitate: cant, total: Math.round(p.unitar * cant * 100) / 100,
    } as NonNullable<LinieProcesata["pret"]>;
  }
  if (p.codEroare) l.codEroare = p.codEroare;
  if (p.avertismente) l.avertismente = p.avertismente;
  return l;
};

describe("imparte", () => {
  it("desparte cele trei grămezi după preț și marcaj", () => {
    const curata = linie({ unitar: 10 });
    const marcata = linie({ unitar: 10, necesitaValidare: true });
    const fara = linie({ codEroare: "grosime_inexistenta" });

    const r = imparte([curata, marcata, fara]);
    expect(r.oferta).toEqual([curata]);
    expect(r.deValidat).toEqual([marcata]);
    expect(r.netarifate).toEqual([fara]);
  });

  it("rândurile care nu sunt poziții de izolație nu intră nicăieri", () => {
    // Un antet de secțiune sau un rând de total n-are ce căuta nici în oferta
    // trimisă clientului, nici la „netarifate" — acolo ar fi zgomot.
    const antet = linie({ extras: { sistem: null } });
    const r = imparte([antet]);
    expect([...r.oferta, ...r.deValidat, ...r.netarifate]).toEqual([]);
  });
});

describe("totalOferta", () => {
  it("adună la bănuț, nu în float", () => {
    // Cazul din oferta 284 reală: 47,41 × 49 = 2323,09, dar în fișierul semnat
    // scrie 2323.0899999999997, adică suma fără rotunjire.
    const t = totalOferta([linie({ unitar: 47.41, cantitate: 49 })]);
    expect(t).toBe(2323.09);
    expect(String(t)).not.toContain("999");
  });

  it("un import fără nicio poziție tarifată dă zero, nu NaN", () => {
    expect(totalOferta([])).toBe(0);
  });
});

describe("registrul generat", () => {
  const set = () => [
    linie({ text: "Izolatie elastomer DN50 gr. 13 mm", unitar: 10, cantitate: 5, sectiune: "TERMICE" }),
    linie({ text: "Izolatie elastomer DN80 gr. 19 mm", unitar: 20, cantitate: 2, extras: { grosime_mm: 19 } }),
    linie({ text: "SPIRO DN 125, Armaflex 13mm", unitar: 13.74, cantitate: 1, necesitaValidare: true,
      avertismente: [{ cod: "notatie_contrazice_materialul", mesaj: "brut" }] }),
    linie({ text: "Cot vata Di21", codEroare: "fara_coeficient_de_forma" }),
    linie({ extras: { sistem: null }, text: "TOTAL CAPITOL" }),
  ];
  const genereaza = (linii = set(), p: Partial<Provenienta> = {}) =>
    registruOferta({ linii, antet: ANTET, provenienta: { ...PROV, ...p } }).then(citesteOferta);

  it("pe foaia Ofertă stau doar pozițiile cu preț și nemarcate, numerotate", async () => {
    const o = await genereaza();
    expect(o.pozitii.map((p) => [p.nr, p.denumire])).toEqual([
      [1, "Izolatie elastomer DN50 gr. 13 mm"],
      [2, "Izolatie elastomer DN80 gr. 19 mm"],
    ]);
  });

  it("o poziție marcată NU apare pe foaia Ofertă, oricât de bun ar arăta prețul", async () => {
    // Regula, nu formatarea: SPIRO DN125 are un preț perfect plauzibil (13,74)
    // și complet greșit. Pe foaia clientului ar fi un preț nevalidat semnat.
    const o = await genereaza();
    expect(o.text).not.toContain("SPIRO");
    expect(o.intern).toContain("SPIRO DN 125, Armaflex 13mm");
  });

  it("totalul e suma coloanei de valoare, la bănuț", async () => {
    const linii = set();
    const o = await genereaza(linii);
    expect(totalul(o, "TOTAL LUCRARI IZOLATII TERMICE")).toBe(10 * 5 + 20 * 2);
    expect(totalul(o, "TOTAL LUCRARI")).toBe(totalOferta(imparte(linii).oferta));
  });

  it("foaia Pentru noi spune de ce a rămas afară fiecare poziție, cu vorbe de om", async () => {
    const o = await genereaza();
    expect(o.intern).toContain("scrie DN, dar materialul dă diametrul exterior");
    expect(o.intern).not.toContain("notatie_contrazice_materialul");
    expect(o.intern).toContain("niciun strat n-are coeficient pe banda lui (întrebarea 9 către firmă)");
  });

  it("secțiunea clientului devine titlul capitolului, nu un cod pe rând", async () => {
    const o = await genereaza();
    expect(o.coloane).not.toContain("Cod");
    expect(o.randuri.find((r) => r.rand === 16)?.text).toBe("TERMICE");
  });

  it("proveniența stă pe foaia Pentru noi, nu pe cea a clientului", async () => {
    const o = await genereaza(set(), { model: "gpt-4.1-2025-04-14" });
    for (const t of ["Cum a fost calculată oferta", PROV.generatLa, "rezidential", "gpt-4.1-2025-04-14", "sesiune-de-test", "test.xlsx"]) {
      expect(o.intern).toContain(t);
      expect(o.text).not.toContain(t);
    }
    // Și câte poziții au rămas pe dinafară: fără ele, foaia clientului arată completă.
    expect(o.intern).toContain("1 de verificat, 1 fără preț");
  });

  it("nota și semnătura firmei, ca în ofertele semnate", async () => {
    const o = await genereaza();
    expect(o.text).toContain("Preturile sunt exprimate in Euro si nu contin TVA");
    expect(o.text).toContain("Plata lucrarilor se face pe baza cantitatilor real executate");
    expect(o.text).toContain(ANTET.firma);
  });

  it("un import fără nicio poziție tarifată dă un registru valid, cu total zero", async () => {
    const o = await genereaza([linie({ codEroare: "grosime_inexistenta" })]);
    expect(o.pozitii).toEqual([]);
    expect(totalul(o, "TOTAL LUCRARI")).toBe(0);
  });
});

describe("discountul comercial", () => {
  const cuDiscount = (procent?: number, linii = [linie({ unitar: 10, cantitate: 5 }), linie({ unitar: 20, cantitate: 2 })]) =>
    registruOferta({
      linii,
      antet: { ...ANTET, ...(procent === undefined ? {} : {
        discountProcent: procent,
        discountConditie: "PENTRU PLATA FACTURII FISCALE IN TERMEN DE 5-7 ZILE",
      }) },
      provenienta: PROV,
    }).then(citesteOferta);
  const totaluri = (o: Awaited<ReturnType<typeof cuDiscount>>) =>
    o.randuri.filter((r) => /^(TOTAL|DISCOUNT)/.test(r.text));

  it("fără discount, registrul are un singur rând de total", async () => {
    expect(totaluri(await cuDiscount()).map((r) => r.text.split(" ").slice(0, 2).join(" "))).toEqual(["TOTAL LUCRARI"]);
  });

  it("cu discount, reproduce structura ofertei 284: total, discount, total general", async () => {
    const r = totaluri(await cuDiscount(3));
    expect(r).toHaveLength(3);
    expect(r[0]!.text).toContain("TOTAL LUCRARI");
    expect(r[0]!.valoare).toBe(90);            // 10x5 + 20x2
    expect(r[1]!.text).toContain("DISCOUNT 3 %");
    expect(r[1]!.text).toContain("PENTRU PLATA FACTURII");
    expect(r[1]!.valoare).toBe(2.7);           // VALOAREA reducerii, ca in oferta reala
    expect(r[2]!.text).toContain("TOTAL GENERAL");
    expect(r[2]!.valoare).toBe(87.3);
  });

  it("discountul trece prin bani(), spre deosebire de oferta reală", async () => {
    // In oferta 284 semnata scrie `DISCOUNT = 2837.25189`: cinci zecimale.
    const val = totaluri(await cuDiscount(3, [linie({ unitar: 47.41, cantitate: 49 })])).map((r) => r.valoare!);
    for (const v of val) expect(String(v), `${v} are mai mult de 2 zecimale`).toMatch(/^\d+(\.\d{1,2})?$/);
    expect(val).toEqual([2323.09, 69.69, 2253.40]);
  });
});

/* ------------------------------------------------------------------ *
 * Cap-coadă, pe o ofertă semnată.
 * ------------------------------------------------------------------ */

const MATARI = `${CLIENTI}/oferta-118-1-matari-goluri-foc.xlsx`;

describe("cap-coadă pe oferta semnată 118.1", () => {
  cuClienti("53 de poziții pe capitolele EI30 … EI120, cu golul, total 12.692,04 € — exact totalul semnat", async () => {
    const { importaFisier } = await import("../src/import/pipeline.js");
    const { stocInMemorie } = await import("../src/import/memorie.js");
    const raport = await importaFisier(MATARI, { faraModel: true, stoc: stocInMemorie() });
    const o = await citesteOferta(await registruOferta({
      linii: raport.linii,
      antet: { ...ANTET, numar: "118.1", client: "NISAL SRL", obiectiv: "XXXLutz+Momax Balotesti" },
      provenienta: { ...PROV, fisierSursa: "oferta-118-1-matari-goluri-foc.xlsx" },
    }));

    expect(o.coloane).toEqual(["Nr.", "Denumire", "UM", "Cantitate", "Dimensiune gol", "Suprafata (mp)", "Pret unitar Euro", "Pret total Euro"]);
    expect(o.pozitii).toHaveLength(53);
    expect(o.pozitii[0]).toMatchObject({ nr: 1, denumire: "Teava OL/OLZN DN15 | 130/130", gol: "130/130", pretUnitar: 23.05 });
    // EI180 a rămas fără preț, ca în oferta semnată: capitolul nu apare la client.
    expect(o.randuri.filter((r) => /^Teceri/.test(r.text) && r.valoare === null).map((r) => /EI\d+/.exec(r.text)![0]))
      .toEqual(["EI30", "EI60", "EI120"]);
    expect(o.text).toContain("banda wrap");
    expect(totalul(o, "TOTAL LUCRARI")).toBe(12692.04);
    expect(Math.round(o.pozitii.reduce((s, p) => s + p.valoare, 0) * 100) / 100).toBe(12692.04);
  });
});

describe("codul și denumirea", () => {
  it("codul clientului de la începutul rândului merge în coloana Cod, nu în denumire", async () => {
    // Cererea TRANSAVIA: „IZOLATII | Caseta izolatie ...”; oferta semnată are
    // IZOLATII în coloana A și doar descrierea în B.
    const l = linie({ text: "IZOLATII | Caseta izolatie armaturi cu flanse DN100 vata minerala gr. 13 mm", unitar: 121.67,
      extras: { sistem: "vata_minerala", grosime_mm: 13 } });
    const o = await citesteOferta(await registruOferta({ linii: [l], antet: ANTET, provenienta: PROV }));
    expect(o.pozitii[0]).toMatchObject({ cod: "IZOLATII", denumire: "Caseta izolatie armaturi cu flanse DN100 vata minerala gr. 13 mm" });
  });

  it("specificația cu roșu ia locul materialelor din textul clientului, ca în Oferta 284", async () => {
    const l = linie({
      text: "IZOLATII | Caseta izolatie armaturi cu flanse DN100 din tabla aluminiu si vata minerala",
      unitar: 121.67, extras: { sistem: "vata_minerala", grosime_mm: 50, straturi_extra: [{ sistem: "tabla", grosime_mm: null }] },
    });
    const o = await citesteOferta(await registruOferta({ linii: [l], antet: ANTET, provenienta: PROV }));
    expect(o.pozitii[0]!.rosu).toBe("vata minerala gr. 50 mm si protectie cu tabla de aluminiu");
    expect(o.pozitii[0]!.denumire)
      .toBe("Caseta izolatie armaturi cu flanse DN100 vata minerala gr. 50 mm si protectie cu tabla de aluminiu");
  });
});

describe("„In atentia”", () => {
  it("se scrie cum a fost scrisă persoana, cu „d-nei” ca în 118", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await registruOferta({
      linii: [linie({ unitar: 10 })], antet: { ...ANTET, persoana: "d-nei Alina Maties" }, provenienta: PROV,
    }));
    expect(wb.worksheets[0]!.getCell("A10").value).toBe("In atentia d-nei Alina Maties");
  });
});

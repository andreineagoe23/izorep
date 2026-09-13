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
 * firmei sunt pe disc (nu sunt commit-uite), deci în CI se sare peste el, la
 * fel ca la restul suitelor care ating `../attachments/`.
 */
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { existsSync } from "node:fs";
import {
  clientPropus, dataAzi, imparte, registruOferta, totalOferta,
  type AntetOferta, type Provenienta,
} from "../web/oferta.js";
import { numeOferta } from "../web/descarca.js";
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

/** Recitește registrul generat, ca să verificăm ce ajunge chiar în fișier. */
async function citeste(buf: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

const text = (ws: ExcelJS.Worksheet, cel: string): string => {
  const v = ws.getCell(cel).value;
  return v === null || v === undefined ? "" : String(v);
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
    linie({ text: "Izolatie elastomer DN80 gr. 19 mm", unitar: 20, cantitate: 2 }),
    linie({ text: "SPIRO DN 125", unitar: 13.74, cantitate: 1, necesitaValidare: true,
      avertismente: [{ cod: "notatie_contrazice_materialul", mesaj: "brut" }] }),
    linie({ text: "Cot vata Di21", codEroare: "fara_coeficient_de_forma" }),
    linie({ extras: { sistem: null }, text: "TOTAL CAPITOL" }),
  ];

  it("are exact cele trei foi, în ordinea în care se folosesc", async () => {
    const wb = await citeste(await registruOferta({ linii: set(), antet: ANTET, provenienta: PROV }));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Ofertă", "De validat", "Netarifate"]);
  });

  it("antetul poartă toate câmpurile formularului", async () => {
    const ws = (await citeste(await registruOferta({
      linii: set(), antet: ANTET, provenienta: PROV,
    }))).getWorksheet("Ofertă")!;

    expect(text(ws, "A5")).toBe("OFERTA LUCRARI IZOLATII TERMICE");
    expect(text(ws, "C7")).toBe("Nr. RAD284 / 27.05.2026");
    expect(text(ws, "A10")).toContain("Vlad Emil");
    expect(text(ws, "A11")).toContain("Grup Energoinstal SA");
    expect(text(ws, "A12")).toContain("TRANSAVIA ALBA-IULIA");
    expect(ws.getRow(15).values).toEqual([
      undefined, "Identificare_Norma", "Denumire", "UM", "TOTAL CANTITATE",
      "Pret unitar Euro", "Pret total Euro",
    ]);
  });

  it("pe foaia Ofertă stau doar pozițiile cu preț și nemarcate", async () => {
    const ws = (await citeste(await registruOferta({
      linii: set(), antet: ANTET, provenienta: PROV,
    }))).getWorksheet("Ofertă")!;

    expect(text(ws, "B16")).toBe("Izolatie elastomer DN50 gr. 13 mm");
    expect(text(ws, "B17")).toBe("Izolatie elastomer DN80 gr. 19 mm");
    // A treia poziție e marcată, a patra n-are preț, a cincea nu e poziție.
    expect(text(ws, "B18")).toBe("");
  });

  it("o poziție marcată NU apare pe foaia Ofertă, oricât de bun ar arăta prețul", async () => {
    // Regula, nu formatarea: SPIRO DN125 are un preț perfect plauzibil (13,74)
    // și complet greșit. Dacă s-ar strecura pe foaia 1, exact capcana pe care
    // etapa A o face vizibilă ar ajunge semnată la client.
    const wb = await citeste(await registruOferta({ linii: set(), antet: ANTET, provenienta: PROV }));
    const oferta = wb.getWorksheet("Ofertă")!;
    const validat = wb.getWorksheet("De validat")!;

    let gasitInOferta = false;
    oferta.eachRow((r) => {
      if (String(r.getCell(2).value ?? "").includes("SPIRO")) gasitInOferta = true;
    });
    expect(gasitInOferta).toBe(false);
    expect(text(validat, "B2")).toBe("SPIRO DN 125");
  });

  it("totalul e suma coloanei de total, la bănuț", async () => {
    const linii = set();
    const ws = (await citeste(await registruOferta({
      linii, antet: ANTET, provenienta: PROV,
    }))).getWorksheet("Ofertă")!;

    // Două poziții pe foaie (r16, r17), rând gol, apoi TOTAL pe r19.
    expect(text(ws, "A19")).toContain("TOTAL LUCRARI IZOLATII TERMICE");
    expect(ws.getCell("F19").value).toBe(10 * 5 + 20 * 2);
    expect(ws.getCell("F19").value).toBe(totalOferta(imparte(linii).oferta));
  });

  it("foaia De validat spune de ce e marcată fiecare poziție", async () => {
    const ws = (await citeste(await registruOferta({
      linii: set(), antet: ANTET, provenienta: PROV,
    }))).getWorksheet("De validat")!;

    expect(text(ws, "G1")).toBe("De ce e marcată");
    // Eticheta umană, nu codul și nu mesajul brut al validatorului.
    expect(text(ws, "G2")).toBe("scrie DN, dar materialul dă diametrul exterior");
    expect(text(ws, "G2")).not.toContain("notatie_contrazice_materialul");
    expect(text(ws, "G2")).not.toBe("brut");
  });

  it("o poziție netarifată poartă eticheta umană a cauzei, nu textul brut", async () => {
    const ws = (await citeste(await registruOferta({
      linii: set(), antet: ANTET, provenienta: PROV,
    }))).getWorksheet("Netarifate")!;

    expect(text(ws, "E1")).toBe("Ce blochează poziția");
    expect(text(ws, "E2")).toBe(
      "niciun strat n-are coeficient pe banda lui (întrebarea 9 către firmă)");
  });

  it("secțiunea din fișierul sursă ajunge în Identificare_Norma, altfel IZOLATII", async () => {
    const ws = (await citeste(await registruOferta({
      linii: set(), antet: ANTET, provenienta: PROV,
    }))).getWorksheet("Ofertă")!;

    expect(text(ws, "A16")).toBe("TERMICE");
    expect(text(ws, "A17")).toBe("IZOLATII");
  });

  it("zona de proveniență face oferta reproductibilă peste un an", async () => {
    const ws = (await citeste(await registruOferta({
      linii: set(), antet: ANTET,
      provenienta: { ...PROV, model: "gpt-4.1-2025-04-14" },
    }))).getWorksheet("Ofertă")!;

    const tot: string[] = [];
    ws.eachRow((r) => r.eachCell((c) => tot.push(String(c.value ?? ""))));
    const intreg = tot.join(" | ");

    expect(intreg).toContain("Cum a fost calculată oferta");
    expect(intreg).toContain(PROV.generatLa);
    expect(intreg).toContain("rezidential");
    expect(intreg).toContain("gpt-4.1-2025-04-14");
    expect(intreg).toContain("sesiune-de-test");
    expect(intreg).toContain("test.xlsx");
    // Și câte poziții au rămas pe dinafară: fără ele, foaia 1 arată completă.
    expect(intreg).toContain("1 de validat, 1 netarifate");
  });

  it("importul determinist, fără model, se scrie ca atare", async () => {
    const ws = (await citeste(await registruOferta({
      linii: set(), antet: ANTET, provenienta: PROV,
    }))).getWorksheet("Ofertă")!;
    const tot: string[] = [];
    ws.eachRow((r) => r.eachCell((c) => tot.push(String(c.value ?? ""))));
    expect(tot.join(" | ")).toContain("niciunul (doar stratul determinist)");
  });

  it("subsolul poartă localitatea, data și firma emitentă", async () => {
    const ws = (await citeste(await registruOferta({
      linii: set(), antet: ANTET, provenienta: PROV,
    }))).getWorksheet("Ofertă")!;
    expect(text(ws, "A21")).toBe("PALTINIS,");
    expect(text(ws, "F21")).toBe("RADOIA ISOLIRUNG SRL");
    expect(text(ws, "A22")).toBe("27.05.2026");
  });

  it("un import fără nicio poziție tarifată dă un registru valid, cu total zero", async () => {
    // Cazul care ar fi crăpat cel mai ușor: fără rânduri, `randTotal` cade pe
    // primul rând de date. Registrul trebuie să existe și să spună zero, nu să
    // arunce — omul are dreptul să vadă că nu s-a tarifat nimic.
    const ws = (await citeste(await registruOferta({
      linii: [linie({ codEroare: "grosime_inexistenta" })], antet: ANTET, provenienta: PROV,
    }))).getWorksheet("Ofertă")!;
    expect(ws.getCell("F17").value).toBe(0);
  });
});

describe("numeOferta", () => {
  it("compune numele din serie, număr și dată", () => {
    expect(numeOferta("RAD", "284", "27.05.2026")).toBe("Oferta RAD284 27.05.2026.xlsx");
  });

  it("scoate caracterele pe care un nume de fișier nu le poate purta", () => {
    // Numărul și data vin dintr-un formular: un `/` tastat acolo ar face
    // descărcarea să eșueze fără niciun mesaj.
    expect(numeOferta("RAD", "284/2", "27/05/2026")).toBe("Oferta RAD284-2 27-05-2026.xlsx");
  });
});

describe("discountul comercial", () => {
  const cuDiscount = (procent?: number) => registruOferta({
    linii: [linie({ unitar: 10, cantitate: 5 }), linie({ unitar: 20, cantitate: 2 })],
    antet: { ...ANTET, ...(procent === undefined ? {} : {
      discountProcent: procent,
      discountConditie: "PENTRU PLATA FACTURII FISCALE IN TERMEN DE 5-7 ZILE",
    }) },
    provenienta: PROV,
  });

  it("fără discount, registrul are un singur rând de total, ca înainte", async () => {
    const ws = (await citeste(await cuDiscount())).getWorksheet("Ofertă")!;
    const totaluri: string[] = [];
    ws.eachRow((r) => {
      const a = String(r.getCell(1).value ?? "");
      if (a.startsWith("TOTAL") || a.startsWith("DISCOUNT")) totaluri.push(a.split(" ").slice(0, 2).join(" "));
    });
    expect(totaluri).toEqual(["TOTAL LUCRARI"]);
  });

  it("cu discount, reproduce structura ofertei 284: total, discount, total general", async () => {
    const ws = (await citeste(await cuDiscount(3))).getWorksheet("Ofertă")!;
    const randuri: { a: string; f: unknown }[] = [];
    ws.eachRow((r) => {
      const a = String(r.getCell(1).value ?? "");
      if (a.startsWith("TOTAL") || a.startsWith("DISCOUNT")) randuri.push({ a, f: r.getCell(6).value });
    });

    expect(randuri).toHaveLength(3);
    expect(randuri[0]!.a).toContain("TOTAL LUCRARI");
    expect(randuri[0]!.f).toBe(90);            // 10x5 + 20x2
    expect(randuri[1]!.a).toContain("DISCOUNT 3 %");
    expect(randuri[1]!.a).toContain("PENTRU PLATA FACTURII");
    expect(randuri[1]!.f).toBe(2.7);           // VALOAREA reducerii, ca in oferta reala
    expect(randuri[2]!.a).toContain("TOTAL GENERAL");
    expect(randuri[2]!.f).toBe(87.3);
  });

  it("discountul trece prin bani(), spre deosebire de oferta reală", async () => {
    // In oferta 284 semnata scrie `DISCOUNT = 2837.25189` si
    // `TOTAL GENERAL = 91737.81111` — cinci zecimale intr-un document semnat,
    // adica exact ce se intampla fara rotunjire.
    const ws = (await citeste(await registruOferta({
      linii: [linie({ unitar: 47.41, cantitate: 49 })],
      antet: { ...ANTET, discountProcent: 3 },
      provenienta: PROV,
    }))).getWorksheet("Ofertă")!;

    const val: number[] = [];
    ws.eachRow((r) => {
      const a = String(r.getCell(1).value ?? "");
      if (a.startsWith("TOTAL") || a.startsWith("DISCOUNT")) val.push(Number(r.getCell(6).value));
    });
    for (const v of val) expect(String(v), `${v} are mai mult de 2 zecimale`).toMatch(/^\d+(\.\d{1,2})?$/);
    expect(val).toEqual([2323.09, 69.69, 2253.40]);
  });

  it("subsolul și zona de proveniență stau sub ultimul total, nu peste el", async () => {
    // Cu discount apar doua randuri in plus; daca subsolul ar ramane calculat
    // din primul total, ar scrie peste ele.
    const ws = (await citeste(await cuDiscount(3))).getWorksheet("Ofertă")!;
    let randGeneral = 0, randFirma = 0;
    ws.eachRow((r, n) => {
      if (String(r.getCell(1).value ?? "").startsWith("TOTAL GENERAL")) randGeneral = n;
      if (String(r.getCell(6).value ?? "") === ANTET.firma) randFirma = n;
    });
    expect(randGeneral).toBeGreaterThan(0);
    expect(randFirma).toBeGreaterThan(randGeneral);
  });
});

describe("propunerile din formular", () => {
  it("scoate din numele fișierului zgomotul care apare în toate", () => {
    // Numele cu care au venit fișierele de la clienți. Propunerea nu trebuie să fie
    // perfectă — câmpul rămâne editabil — dar trebuie să fie mai bună decât
    // numele întreg, altfel omul o șterge de fiecare dată și n-are rost.
    expect(clientPropus("Oferta 27.04.2026 Matari.xlsx")).toBe("Matari");
    expect(clientPropus("Izolatii Transavia.xlsx")).toBe("Izolatii Transavia");
    expect(clientPropus("Lista de cantitati Flower City_F4.xlsx")).toBe("Lista de cantitati Flower City F4");
    // Numele scurte, fără spații, cu care stau acum în `attachments/clienti/`.
    expect(clientPropus("cerere-de-oferta-transavia-abur.xlsx")).toBe("Transavia Abur");
    expect(clientPropus("oferta-284-transavia-abur.xlsx")).toBe("Transavia Abur");
    expect(clientPropus("oferta-118-1-matari-goluri-foc.xlsx")).toBe("Matari Goluri Foc");
    expect(clientPropus("Cerere oferta 2 Izolatii - Abur.xlsx")).toBe("Izolatii Abur");
  });

  it("când n-ar rămâne nimic, propune numele întreg", () => {
    // Numele astea chiar nu conțin niciun client — sunt doar „Oferta" plus o
    // dată. Mai bine ceva de șters decât un câmp gol pe care omul nu știe ce
    // ar trebui să conțină. Sufixul de copie iese doar când mai rămâne ceva
    // după el; aici cade tot, deci se întoarce numele întreg.
    expect(clientPropus("Oferta 27.04.2026.xlsx")).toBe("Oferta 27.04.2026");
    expect(clientPropus("Oferta 27.04.2026 (1).xlsx")).toBe("Oferta 27.04.2026 (1)");
    expect(clientPropus("cerere de oferta.xlsx")).toBe("cerere de oferta");
    expect(clientPropus("oferta.xlsx")).toBe("oferta");
  });

  it("data e scrisă cum o scriu ofertele firmei", () => {
    expect(dataAzi(new Date(2026, 4, 27))).toBe("27.05.2026");
    // Cu zero în față la zi și lună: `7.9.2026` n-ar semăna cu nimic din
    // ofertele reale, care au toate `27.05.2026`.
    expect(dataAzi(new Date(2026, 0, 7))).toBe("07.01.2026");
  });
});

/* ------------------------------------------------------------------ *
 * Cap-coadă, pe o ofertă semnată.
 * ------------------------------------------------------------------ */

const MATARI = "../attachments/clienti/oferta-118-1-matari-goluri-foc.xlsx";

describe("cap-coadă pe oferta semnată 118.1", () => {
  it("53 de poziții pe foaia Ofertă, total 12.692,04 € — exact totalul semnat", async () => {
    // Fara `describe.runIf`: fisierele firmei nu-s commit-uite, deci in CI ar
    // fi o suita SARITA — iar CI pica deliberat pe orice suita sarita, fiindca
    // una sarita arata exact ca una care trece. Testul ruleaza mereu si iese
    // devreme cand n-are pe ce lucra, ca in `golden.test.ts`.
    if (!existsSync(MATARI)) return;
    // Fișierul se tarifează 100% determinist, fără niciun apel la model, deci
    // testul e reproductibil bit cu bit. Dacă numărul ăsta se mișcă, registrul
    // generat nu mai reproduce oferta pe care firma a trimis-o clientului.
    const { importaFisier } = await import("../src/import/pipeline.js");
    const { stocInMemorie } = await import("../src/import/memorie.js");
    const raport = await importaFisier(MATARI, { faraModel: true, stoc: stocInMemorie() });

    const buf = await registruOferta({
      linii: raport.linii,
      antet: { ...ANTET, numar: "118.1", client: "NISAL SRL", obiectiv: "XXXLutz+Momax Balotesti" },
      provenienta: { ...PROV, fisierSursa: "oferta-118-1-matari-goluri-foc.xlsx" },
    });
    const ws = (await citeste(buf)).getWorksheet("Ofertă")!;

    const randuri: number[] = [];
    ws.eachRow((r, n) => { if (n >= 16 && typeof r.getCell(6).value === "number") randuri.push(n); });
    // 53 de poziții plus rândul de TOTAL, care e tot numeric în coloana F.
    expect(randuri).toHaveLength(54);

    const randTotal = randuri.at(-1)!;
    expect(String(ws.getCell(`A${randTotal}`).value)).toContain("TOTAL");
    expect(ws.getCell(`F${randTotal}`).value).toBe(12692.04);

    // Și e chiar suma coloanei, nu un număr scris separat.
    const suma = randuri.slice(0, -1).reduce((s, n) => s + Number(ws.getCell(`F${n}`).value), 0);
    expect(Math.round(suma * 100) / 100).toBe(12692.04);
  });
});

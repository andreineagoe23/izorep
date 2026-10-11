/**
 * Oferta ca date (`web/document-oferta.ts`), față de ofertele semnate.
 *
 * Pasul 0 din `docs/plan-import.md`: orice cerere se traduce în cadrul
 * ofertelor firmei. Ce se apără aici:
 *
 * - **TRANSAVIA → Oferta 284**, rând cu rând: codul, UM-ul, cantitatea,
 *   prețul unitar, valoarea, totalul cu și fără discount, iar specificația
 *   noastră egală cu textul scris cu roșu de firmă pe casete.
 * - **Matari → 118.1**: capitolele EI30 … EI180, numerotarea, golul.
 * - **NISAL → 118**: cele două foi ca două capitole, codurile clientului.
 * - pe toate fișierele de client: documentul are aceleași poziții și același
 *   total ca registrul de azi și ca planul de șantier.
 *
 * Fișierele firmei nu sunt commit-uite: fără ele, testele care le citesc nu
 * verifică nimic despre ele (tiparul din `oferte-semnate.test.ts`), iar cele
 * pe linii construite aici rulează oricum.
 */
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { existsSync, readdirSync } from "node:fs";
import { documentOferta, specificatie, NOTA, type DocumentOferta } from "../web/document-oferta.js";
import { imparte, planDinOferta, valoareOferta, type AntetOferta, type CerereOferta, type Provenienta } from "../web/oferta.js";
import { importaFisier } from "../src/import/pipeline.js";
import { stocInMemorie } from "../src/import/memorie.js";
import type { LinieProcesata } from "../src/import/nucleu.js";
import type { LinieExtrasa } from "../src/import/schema.js";

const DIR = "../attachments/clienti";

const ANTET: AntetOferta = {
  serie: "RAD", numar: "284", data: "27.05.2026", persoana: "Vlad Emil",
  client: "Grup Energoinstal SA", obiectiv: "TRANSAVIA ALBA-IULIA",
  firma: "RADOIA ISOLIRUNG SRL", localitate: "PALTINIS",
};
const PROV: Provenienta = {
  generatLa: "2026-10-11T00:00:00.000Z", destinatie: "rezidential",
  model: null, sesiune: "test", fisierSursa: "test.xlsx",
};

const importa = async (f: string): Promise<LinieProcesata[]> =>
  (await importaFisier(`${DIR}/${f}`, { faraModel: true, stoc: stocInMemorie() })).linii;

const cerere = (linii: LinieProcesata[], antet: Partial<AntetOferta> = {}, destinatie = "rezidential"): CerereOferta =>
  ({ linii, antet: { ...ANTET, ...antet }, provenienta: { ...PROV, destinatie } });

const pozitii = (d: DocumentOferta) => d.capitole.flatMap((c) => c.pozitii);

/** Valoarea unei celule, cu formula rezolvată și textul îmbogățit lipit. */
const valoare = (c: ExcelJS.Cell): unknown => {
  const v = c.value;
  if (v && typeof v === "object" && "result" in v) return v.result;
  if (v && typeof v === "object" && "richText" in v) return v.richText.map((p) => p.text).join("");
  return v;
};

/** Textul scris cu roșu în celulă (Oferta 284: ce ofertăm noi). */
const rosu = (c: ExcelJS.Cell): string => {
  const v = c.value;
  if (!v || typeof v !== "object" || !("richText" in v)) return "";
  return v.richText.filter((p) => p.font?.color?.argb === "FFFF0000").map((p) => p.text).join("").trim();
};

/* ------------------------------------------------- linii construite aici */

const extrasa = (p: Partial<LinieExtrasa> = {}): LinieExtrasa => ({
  index: 1, sistem: "elastomer", diametru_valoare: 50, diametru_tip: "DN",
  grosime_mm: 13, forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null,
  straturi_extra: [], incredere: 0.99, motiv: "test", ...p,
});

let contor = 0;
const linie = (p: {
  text?: string; foaie?: string; sectiune?: string; celule?: (string | number | null)[];
  unitar?: number; cantitate?: number; necesitaValidare?: boolean;
  codEroare?: LinieProcesata["codEroare"]; extras?: Partial<LinieExtrasa>;
} = {}): LinieProcesata => {
  const index = ++contor;
  const l: LinieProcesata = {
    bruta: {
      index, foaie: p.foaie ?? "Foaie1", rand: index, text: p.text ?? `Izolatie elastomer DN50 gr. 13 mm`,
      celule: p.celule ?? [], um: "ml", cantitate: p.cantitate ?? 10,
      ...(p.sectiune !== undefined ? { sectiune: p.sectiune } : {}),
    } as LinieProcesata["bruta"],
    extras: extrasa({ index, ...p.extras }),
    sursa: "regex",
    necesitaValidare: p.necesitaValidare ?? false,
  };
  if (p.unitar !== undefined) {
    const cant = p.cantitate ?? 10;
    l.pret = { pret_unitar: p.unitar, cantitate: cant, total: Math.round(p.unitar * cant * 100) / 100 } as NonNullable<LinieProcesata["pret"]>;
  }
  if (p.codEroare) l.codEroare = p.codEroare;
  return l;
};

describe("capitolele și numerotarea", () => {
  it("o singură foaie fără secțiuni: un capitol fără titlu", () => {
    const d = documentOferta(cerere([linie({ unitar: 5 }), linie({ unitar: 6 })]));
    expect(d.capitole.map((c) => c.titlu)).toEqual([null]);
    expect(pozitii(d).map((p) => p.nr)).toEqual([1, 2]);
  });

  it("secțiunile clientului devin capitole, iar antetul documentului nu", () => {
    const d = documentOferta(cerere([
      linie({ sectiune: "Obiectiv : XXXLutz", unitar: 5 }),
      linie({ sectiune: "OFERTA LUCRARI IZOLATII TERMICE", unitar: 5 }),
      linie({ sectiune: "Treceri EI30", unitar: 5 }),
      linie({ sectiune: "Treceri EI60", unitar: 5 }),
    ]));
    expect(d.capitole.map((c) => [c.titlu, c.pozitii.length])).toEqual([[null, 2], ["Treceri EI30", 1], ["Treceri EI60", 1]]);
  });

  it("mai multe foi: foaia e capitolul; doar pozițiile „Gata” au număr și intră în subtotal", () => {
    const d = documentOferta(cerere([
      linie({ foaie: "Termice", unitar: 10, cantitate: 2 }),
      linie({ foaie: "Termice", unitar: 10, necesitaValidare: true }),
      linie({ foaie: "Ventilatie", codEroare: "grosime_inexistenta" }),
      linie({ foaie: "Ventilatie", unitar: 1.5, cantitate: 3 }),
    ]));
    expect(d.capitole.map((c) => [c.titlu, c.subtotal])).toEqual([["Termice", 20], ["Ventilatie", 4.5]]);
    expect(pozitii(d).map((p) => [p.nr, p.stare])).toEqual([[1, "gata"], [null, "de_validat"], [null, "netarifate"], [2, "gata"]]);
    expect(d.numarate).toEqual({ gata: 2, de_validat: 1, netarifate: 1 });
    expect(d.total).toBe(24.5);
  });

  it("totalul e cel al ofertei salvate, cu ajustare, adaos de foc și discount", () => {
    const linii = [
      linie({ unitar: 10.33, cantitate: 3 }),
      linie({ unitar: 20, extras: { sistem: "goluri_foc", gol_latime_mm: 130, gol_inaltime_mm: 130 } }),
    ];
    const c = cerere(linii, { ajustareProcent: 10, discountProcent: 3 }, "industrial");
    const d = documentOferta(c);
    expect(d.totalGeneral).toBe(valoareOferta(c).valoare);
    expect(d.adaosFoc).toBeGreaterThan(0);
    expect(d.coloaneGol).toBe(true);
    expect(pozitii(d)[1]!.gol).toEqual({ dimensiune: "130/130", suprafata: 0.02 });
    expect(d.note.length).toBeGreaterThan(NOTA.length);
  });
});

describe("codul și specificația", () => {
  it("codul vine din text sau din prima celulă; numărul curent nu e cod", () => {
    const d = documentOferta(cerere([
      linie({ text: "IZOLATII | Caseta DN100", unitar: 1 }),
      linie({ celule: ["01.82.02.01A", "Z", "Kälteisolierung"], unitar: 1 }),
      linie({ celule: [7, "Teava OL DN15"], unitar: 1 }),
    ]));
    expect(pozitii(d).map((p) => [p.cod, p.textClient])).toEqual([
      ["IZOLATII", "Caseta DN100"],
      ["01.82.02.01A", "Izolatie elastomer DN50 gr. 13 mm"],
      [null, "Izolatie elastomer DN50 gr. 13 mm"],
    ]);
    expect(d.coloanaCod).toBe(true);
  });

  it("textul complet al clientului nu primește specificație; grosimea nescrisă da", () => {
    expect(specificatie(linie({ text: "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g50 - COT",
      extras: { sistem: "vata_minerala", grosime_mm: 50, straturi_extra: [{ sistem: "tabla", grosime_mm: null }] } }))).toBeNull();
    expect(specificatie(linie({ text: "Caseta izolatie armaturi cu flanse DN100 din tabla aluminiu si vata minerala",
      extras: { sistem: "vata_minerala", grosime_mm: 50, straturi_extra: [{ sistem: "tabla", grosime_mm: null }] } })))
      .toBe("vata minerala gr. 50 mm si protectie cu tabla de aluminiu");
  });

  it("alt material sau altă grosime decât cea scrisă se spune; inoxul cu grosimea lui", () => {
    expect(specificatie(linie({ text: "Kautschuk, S=20mm, DN100", extras: { grosime_mm: 19 } }))).toBe("elastomer gr. 19 mm");
    expect(specificatie(linie({ text: "Izolatie Ø50mm d=9mm cauciuc", extras: { grosime_mm: 9 } }))).toBeNull();
    expect(specificatie(linie({ text: "Izolatii vata DN50 g40 cu tabla de inox", extras: {
      sistem: "vata_minerala", grosime_mm: 40, straturi_extra: [{ sistem: "tabla_inox", grosime_mm: 0.4 }] } })))
      .toBe("vata minerala gr. 40 mm si protectie cu tabla de inox gr. 0,4 mm");
    expect(specificatie(linie({ extras: { sistem: "goluri_foc" } }))).toBeNull();
  });
});

/* ---------------------------------------------- pe ofertele semnate */

describe("cererea TRANSAVIA în șablon = Oferta 284", () => {
  const CERERE = "cerere-de-oferta-transavia-abur.xlsx";
  const OFERTA = `${DIR}/oferta-284-transavia-abur.xlsx`;

  it("99 de poziții, rând cu rând, totalul cu discount și textul roșu de pe casete", async () => {
    if (!existsSync(`${DIR}/${CERERE}`) || !existsSync(OFERTA)) return;
    const d = documentOferta(cerere(await importa(CERERE), { discountProcent: 3 }));
    expect(d.capitole).toHaveLength(1);
    expect(d.capitole[0]!.titlu).toBeNull();
    expect(d.coloaneGol).toBe(false);
    expect(d.coloanaCod).toBe(true);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(OFERTA);
    const ws = wb.getWorksheet("Izolatii")!;
    const semnate: ExcelJS.Row[] = [];
    ws.eachRow((r, n) => { if (n >= 16 && typeof valoare(r.getCell(5)) === "number") semnate.push(r); });

    const poz = pozitii(d);
    expect(poz).toHaveLength(99);
    expect(semnate).toHaveLength(99);
    const diferite: string[] = [];
    poz.forEach((p, i) => {
      const s = semnate[i]!;
      const cum = `rândul ${s.number}`;
      if (p.nr !== i + 1) diferite.push(`${cum}: nr ${p.nr}`);
      if (p.cod !== valoare(s.getCell(1))) diferite.push(`${cum}: cod ${p.cod}`);
      if (p.um !== valoare(s.getCell(3))) diferite.push(`${cum}: UM ${p.um}`);
      if (p.cantitate !== valoare(s.getCell(4))) diferite.push(`${cum}: cantitate ${p.cantitate}`);
      if (p.pretUnitar !== valoare(s.getCell(5))) diferite.push(`${cum}: P.U. ${p.pretUnitar}`);
      if (Math.abs(p.valoare! - (valoare(s.getCell(6)) as number)) > 1e-4) diferite.push(`${cum}: valoare ${p.valoare}`);
      // Roșul din 284 e ce a ofertat firma. Pe casete, materialul și grosimea;
      // pe țevi doar cuvântul „aluminiu” (corectat), textul era deja complet.
      const r = rosu(s.getCell(2));
      const asteptat = /gr\. \d+ mm/.test(r) ? r : null;
      if (p.specificatie !== asteptat) diferite.push(`${cum}: specificația „${p.specificatie}”, semnat „${r}”`);
      const negru = String(valoare(s.getCell(2))).replace(r, "").replace(/\s+/g, " ").trim();
      if (asteptat && !p.textClient.startsWith(negru)) diferite.push(`${cum}: text „${p.textClient}”`);
    });
    expect(diferite).toEqual([]);
    expect(poz.filter((p) => p.specificatie !== null)).toHaveLength(24);

    expect(d.total).toBe(94575.06);
    expect(d.discount).toBe(2837.25);
    expect(d.totalGeneral).toBe(91737.81);
    expect(d.note).toEqual(NOTA);
  });
});

describe("Matari în șablon = Oferta 118.1", () => {
  const F = "oferta-118-1-matari-goluri-foc.xlsx";

  it("capitolele EI30 … EI180, numerotarea, golul și totalul semnat", async () => {
    if (!existsSync(`${DIR}/${F}`)) return;
    const d = documentOferta(cerere(await importa(F)));
    expect(d.capitole.map((c) => [/EI\d+/.exec(c.titlu ?? "")?.[0], c.pozitii.length]))
      .toEqual([["EI30", 16], ["EI60", 12], ["EI120", 25], ["EI180", 12]]);
    const poz = pozitii(d);
    // Oferta semnată numerotează 1 … 53 pozițiile cu preț; EI180 a rămas fără preț.
    expect(poz.filter((p) => p.nr !== null).map((p) => p.nr)).toEqual(Array.from({ length: 53 }, (_, i) => i + 1));
    expect(d.capitole[3]!.pozitii.every((p) => p.nr === null)).toBe(true);
    expect(d.coloaneGol).toBe(true);
    expect(d.coloanaCod).toBe(false);
    expect(poz[0]).toMatchObject({ textClient: "Teava OL/OLZN DN15 | 130/130", gol: { dimensiune: "130/130", suprafata: 0.02 } });
    expect(d.total).toBe(12692.04);
    expect(d.capitole.reduce((s, c) => s + c.subtotal, 0)).toBeCloseTo(12692.04, 2);
  });
});

describe("NISAL în șablon = Oferta 118", () => {
  const F = "oferta-118-nisal.xlsx";

  it("cele două foi sunt două capitole, cu codurile clientului pe fiecare rând", async () => {
    if (!existsSync(`${DIR}/${F}`)) return;
    const d = documentOferta(cerere(await importa(F)));
    expect(d.capitole.map((c) => [c.titlu, c.pozitii.length])).toEqual([["Termice+Sanitare", 50], ["Ventilatie", 8]]);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(`${DIR}/${F}`);
    const diferite = pozitii(d)
      .filter((p) => p.cod !== valoare(wb.getWorksheet(p.sursa.foaie)!.getRow(p.sursa.rand).getCell(1)))
      .map((p) => `${p.sursa.foaie} r${p.sursa.rand}: ${p.cod}`);
    expect(diferite).toEqual([]);
    expect(d.total).toBe(163979.93);
    // Oferta semnată spune deja tot ce s-a tarifat: „S=20mm” în germană, iar
    // firma a scris „S=19 mm” în descrierea română. Nimic de adăugat.
    expect(pozitii(d).filter((p) => p.specificatie !== null)).toEqual([]);
  });
});

describe("pe toate cererile: documentul, registrul și planul spun același lucru", () => {
  it("aceleași poziții, același total, aceeași numerotare ca planul de șantier", async () => {
    if (!existsSync(DIR)) return;
    for (const f of readdirSync(DIR).filter((x) => x.endsWith(".xlsx"))) {
      const c = cerere(await importa(f), { discountProcent: 3, ajustareProcent: 5 });
      const d = documentOferta(c);
      const { oferta, deValidat, netarifate } = imparte(c.linii);
      expect(d.numarate, f).toEqual({ gata: oferta.length, de_validat: deValidat.length, netarifate: netarifate.length });
      expect(d.totalGeneral, f).toBe(valoareOferta(c).valoare);
      expect(d.capitole.every((cap) => cap.pozitii.length > 0), f).toBe(true);
      const plan = planDinOferta(c, "x");
      const gata = pozitii(d).filter((p) => p.nr !== null);
      expect(gata.map((p) => [p.nr, p.cantitate, p.pretUnitar]), f)
        .toEqual(plan.pozitii.map((p) => [p.nr, p.cantitate, p.pretUnitar]));
    }
  });
});

describe("pozițiile adăugate de mână", () => {
  it("trec prin import ca orice rând și intră la „Alte lucrări”, după capitolele clientului", async () => {
    const { cuAdaugate, FOAIE_ADAUGATE } = await import("../src/import/adaugate.js");
    const { proceseazaRegistru } = await import("../src/import/nucleu.js");
    const foaie = (nume: string, randuri: (string | number)[][]) => ({
      nume, coloane: 3,
      randuri: randuri.map((r, i) => ({ rand: i + 1, celule: r.map((v) => ({ v, span: 1 })) })),
    });
    const { construiesteLinie } = await import("../src/import/rand.js");
    const client = foaie("Izolatii", [["Izolatii cu vata minerala si protectie cu tabla de aluminiu Di114, g50 - ML", "ml", 10]]);
    client.randuri.forEach((r, i) => {
      const l = construiesteLinie(r.celule.map((c) => c.v), { index: i, foaie: "Izolatii", rand: r.rand });
      if (l) (r as { linie?: unknown }).linie = l;
    });
    const foi = cuAdaugate([client], [{ text: "Izolatie vata minerala 50 mm si tabla aluminiu Di114 - COT", um: "buc", cantitate: 2 }]);
    expect(foi.map((f) => f.nume)).toEqual(["Izolatii", FOAIE_ADAUGATE]);
    const rez = await proceseazaRegistru(foi, { stoc: stocInMemorie() });
    const d = documentOferta(cerere(rez.linii));
    expect(d.capitole.map((c) => c.titlu)).toEqual([null, "Alte lucrări"]);
    const [a, b] = pozitii(d);
    expect(a!.nr).toBe(1);
    expect(b).toMatchObject({ nr: 2, um: "buc", cantitate: 2, stare: "gata" });
    expect(b!.pretUnitar).toBeGreaterThan(0);
  });
});

/**
 * Nicio poziție dintr-o cerere de ofertă nu rămâne fără preț (8 octombrie
 * 2026, cerut de Andrei): avem toate listele firmei pe rezidențial și pe
 * industrial, iar restul se calculează după regulile firmei. Ce e calculat pe
 * o regulă cu o singură dovadă iese cu preț, dar la „De verificat”.
 *
 * Prima parte rulează pe cele 10 fișiere de client, pe ambele tipuri de
 * ofertă. Restul ține câte o regulă, pe rândul real din care a ieșit.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CLIENTI, cuClienti } from "./conditii.js";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { parseFoi } from "../src/import/parse-workbook.js";
import { proceseazaRegistru, tarifeazaExtras } from "../src/import/nucleu.js";
import { importaFisier } from "../src/import/pipeline.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { tarifeaza, tarifeazaPeMp } from "../src/pricing/engine.js";
import type { RezultatTarifare } from "../src/pricing/types.js";
import type { LinieExtrasa } from "../src/import/schema.js";

const DIR = CLIENTI;

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "izorep-fara-pret-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

async function linii(randuri: (string | number | null)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lista");
  ws.addRow(["Nr. crt.", "Denumire articol", "UM", "Cantitate"]);
  for (const r of randuri) ws.addRow(r);
  const cale = join(dir, "test.xlsx");
  await wb.xlsx.writeFile(cale);
  return (await proceseazaRegistru(await parseFoi(cale), { stoc: stocInMemorie() })).linii;
}

const extrasa = (p: Partial<LinieExtrasa>): LinieExtrasa => ({
  index: 0, sistem: "vata_minerala", diametru_valoare: null, diametru_tip: null, grosime_mm: null,
  forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [],
  incredere: 0.9, motiv: "test", ...p,
});

const motive = (p: unknown): string[] => (p as RezultatTarifare | undefined)?.motiveDeVerificat ?? [];

describe("cererile de ofertă ale clienților", () => {
  for (const destinatie of ["rezidential", "industrial"] as const) {
    cuClienti(`pe ${destinatie}: nicio poziție fără preț, în niciun fișier`, async () => {
      const fara: string[] = [];
      for (const f of readdirSync(DIR).filter((x) => x.endsWith(".xlsx"))) {
        const r = await importaFisier(join(DIR, f), { faraModel: true, destinatie, stoc: stocInMemorie() });
        for (const l of r.linii) {
          if (l.extras.sistem !== null && !l.pret) fara.push(`${f} r${l.bruta.rand}: ${l.codEroare} — ${l.bruta.text.slice(0, 80)}`);
        }
      }
      expect(fara).toEqual([]);
    });
  }
});

describe("tabla fără grosime scrisă", () => {
  it("inoxul ia 0,4 mm (răspunsul firmei), fără să mai ceară ochi", () => {
    const r = tarifeaza({
      diametru: { valoare: 89, tip: "interior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: 50 }, { sistem: "tabla_inox" }],
      forma: "ml", cantitate: 1, destinatie: "industrial",
    });
    expect(r.straturi[1]!.grosime_mm).toBe(0.4);
    expect(r.motiveDeVerificat ?? []).not.toContain("grosime_jacheta_apropiata");
  });

  it("aluminiul pe mp, pe industrial (0,6 și 0,8 au amândouă preț), ia 0,8", () => {
    const r = tarifeazaPeMp({ straturi: [{ sistem: "vata_minerala", grosime_mm: 50 }, { sistem: "tabla" }], cantitate: 1, destinatie: "industrial" });
    expect(r.straturi[1]!.grosime_mm).toBe(0.8);
  });

  it("„min 0,5 mm” (spitalul) ia 0,6, cea mai subțire care o acoperă, de verificat", async () => {
    const l = (await linii([[1, "Sistem complet de protectie mecanica a izolatiilor din tabla zincata cu grosimea de min 0,5 mm", "mp", 290]]))
      .find((x) => x.extras.sistem !== null);
    expect(l!.pret!.pret_unitar).toBe(45);
    expect(motive(l!.pret)).toContain("grosime_apropiata");
  });
});

describe("Transavia inox pe rezidențial", () => {
  cuClienti("inoxul nu trimite nicio poziție la verificat; rămân doar cele cu motivul lor", async () => {
    const f = join(DIR, "cerere-de-oferta-transavia-inox.xlsx");
    const r = await importaFisier(f, { faraModel: true, destinatie: "rezidential", stoc: stocInMemorie() });
    const cuPret = r.linii.filter((l) => l.extras.sistem !== null && l.pret);
    expect(cuPret).toHaveLength(72);
    expect(cuPret.filter((l) => motive(l.pret).includes("segment_diferit"))).toEqual([]);
  });
});

describe("prețul pe mp, când lista segmentului nu-l are", () => {
  it("tablă 0,6 mm pe rezidențial: prețul pe mp din lista industrială (0,8 e identic în amândouă)", () => {
    const r = tarifeazaPeMp({ straturi: [{ sistem: "tabla", grosime_mm: 0.6 }], cantitate: 1 });
    expect(r.pret_unitar).toBe(45);
    expect(r.motiveDeVerificat).toContain("mp_din_celalalt_segment");
  });

  it("elastomer 40 mm pe mp (spitalul): extrapolat din 25 și 32 mm, de verificat", () => {
    const r = tarifeazaPeMp({ straturi: [{ sistem: "elastomer", grosime_mm: 40 }], cantitate: 1 });
    // 37,18 + (37,18 − 30,77) / 7 × 8
    expect(r.pret_unitar).toBe(44.49);
    expect(r.motiveDeVerificat).toContain("grosime_extrapolata");
  });
});

describe("rândurile care nu se ofertează", () => {
  it("tubulatura flexibilă izolată și rezervorul izolat (Book15) vin izolate de la producător", async () => {
    const l = await linii([
      [1, "Supply, insulated flexible circular duct made of laminated aluminum with 25 mm fiberglass insulation, Ø125", "ml", 10],
      [2, "Storage tank for hot and chilled water, with 20 mm closed polyethylene cells insulation, with PVC outer protection", "pcs", 1],
    ]);
    const preizolate = l.filter((x) => x.preizolat);
    expect(preizolate).toHaveLength(2);
    expect(preizolate.every((x) => x.extras.sistem === null)).toBe(true);
  });
});

describe("rânduri fără tot ce cere lista, completate din același fișier", () => {
  it("golul EI180 fără dimensiuni (Matari) îl ia de la aceeași țeavă din secțiunile de deasupra", async () => {
    // Ca în fișierul real: secțiunea e o celulă îmbinată, golul stă în coloana lui.
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Matari");
    ws.addRow(["Nr. crt.", "Denumire articol", "UM", "Cantitate", "Dimensiune gol"]);
    for (const [sectiune, rand] of [
      ["Teceri prin pereti rezistenti la foc EI30", [1, "Teava OL/OLZN DN15", "buc", 6, "130/130"]],
      ["Teceri prin pereti rezistenti la foc EI180", [2, "Teava OL/OLZN DN15", "buc", 4, null]],
    ] as const) {
      const r = ws.addRow([sectiune]);
      ws.mergeCells(r.number, 1, r.number, 5);
      ws.addRow([...rand]);
    }
    const cale = join(dir, "matari.xlsx");
    await wb.xlsx.writeFile(cale);
    const l = (await proceseazaRegistru(await parseFoi(cale), { stoc: stocInMemorie() })).linii;
    const fara = l.find((x) => x.bruta.cantitate === 4)!;
    expect(fara.pret!.pret_unitar).toBe(23.05);
    expect(motive(fara.pret)).toContain("gol_de_la_aceeasi_teava");
    expect(fara.necesitaValidare).toBe(true);
  });

  it("grosimea ca interval („20 to 50mm”, Book15) ia capătul de sus, de verificat", async () => {
    const l = (await linii([[1, "Rectangular duct insulated with 20 to 50mm mineral wool", "m2", 100]]))
      .find((x) => x.extras.sistem !== null);
    expect(l!.extras.grosime_mm).toBe(50);
    expect(motive(l!.pret)).toContain("grosime_interval");
  });
});

describe("lucrări fără listă proprie", () => {
  it("banda autoadezivă pe armături: elastomerul de 9 mm pe primul rând, de verificat", () => {
    const r = tarifeazaExtras(extrasa({ sistem: "elastomer" }), 45, "rezidential", "Izolatii armaturi banda autoadeziva");
    expect(r.pret!.pret_unitar).toBeGreaterThan(0);
    expect(motive(r.pret)).toContain("banda_armaturi");
  });

  it("o jachetă pe care textul n-o numește nu intră în preț (spitalul, „protejată cu folie”)", async () => {
    const text = "Teava din otel zincata serie medie, Dn 1\", imbinata prin cuplaje rapide, izolatie in grosime de 20 mm protejata cu folie";
    const rez = await proceseazaRegistru(await parseFoi(await (async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Lista");
      ws.addRow(["Nr. crt.", "Denumire articol", "UM", "Cantitate"]);
      ws.addRow([1, text, "ml", 100]);
      const cale = join(dir, "folie.xlsx");
      await wb.xlsx.writeFile(cale);
      return cale;
    })()), {
      stoc: stocInMemorie(),
      extrage: async (ls) => ls.map((x) => extrasa({
        index: x.index, diametru_valoare: 25, diametru_tip: "DN", grosime_mm: 20,
        straturi_extra: [{ sistem: "tabla", grosime_mm: null }],
      })),
    });
    const l = rez.linii.find((x) => x.extras.sistem !== null)!;
    expect((l.pret as RezultatTarifare).straturi.map((s) => s.sistem)).toEqual(["vata_minerala"]);
    expect(l.necesitaValidare).toBe(true);
  });
});

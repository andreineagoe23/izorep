/**
 * Regulile din demo-ul de la firmă (16 noiembrie 2026) și din răspunsurile pe
 * `docs/intrebari-firma-3.md`, intrate pe 23 noiembrie 2026
 * (`docs/plan-dupa-demo.md`, Etapa 1). Pe scurt: ce lipsește din cerere se
 * întreabă clientul („Fără preț”), nu se presupune.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { parseFoi } from "../src/import/parse-workbook.js";
import { proceseazaRegistru, reevalueaza, mpPeMlRectangular, type LinieProcesata } from "../src/import/nucleu.js";
import { extrageDeterminist } from "../src/import/extract-regex.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { tarifeazaPeMp } from "../src/pricing/engine.js";
import { potrivit } from "../web/validare.js";
import { patchDinCamp } from "../web/import/verificare-vizual.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "izorep-demo-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

async function importa(randuri: (string | number | null)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lista");
  ws.addRow(["Nr. crt.", "Denumire articol", "UM", "Cantitate"]);
  for (const r of randuri) ws.addRow(r);
  const cale = join(dir, "cerere.xlsx");
  await wb.xlsx.writeFile(cale);
  const opt = { stoc: stocInMemorie() };
  return { rez: await proceseazaRegistru(await parseFoi(cale), opt), opt };
}

/** Rândul 2 din foaie: primul de după antet. */
const r2 = (rez: { linii: LinieProcesata[] }): LinieProcesata => rez.linii.find((x) => x.bruta.rand === 2)!;
const stare = (l: LinieProcesata): string =>
  potrivit(l, "gata") ? "gata" : potrivit(l, "de_validat") ? "verif" : potrivit(l, "netarifate") ? "fara" : "alt";
const sisteme = (text: string): (string | null)[] => {
  const e = extrageDeterminist(0, text, "ml", undefined, 1).linie;
  return [e.sistem, ...e.straturi_extra.map((x) => x.sistem)];
};

describe("tubulatura din tablă zincată: tabla e a tubulaturii (notițele lui Adrian)", () => {
  it("„… pentru ventilație, din tablă zincată, - VATĂ MINERALĂ 30 mm”: doar vata, fără jachetă", () => {
    expect(sisteme("Tubulatura rectangulara pentru ventilatie, din tabla zincata, - VATA MINERALA 30 mm cu certificat CE"))
      .toEqual(["vata_minerala"]);
  });
  it("tabla de protecție scrisă după izolație rămâne jachetă", () => {
    expect(sisteme("Tubulatura rectangulara izolata cu vata minerala 30 mm, protectie din tabla aluminiu"))
      .toEqual(["vata_minerala", "tabla"]);
  });
});

describe("cuvintele clienților, confirmate de firmă", () => {
  it.each([
    ["Izolatii cu cauciuc DN32 gr. 13 mm", "elastomer"],
    ["Izolatie din auciuc sintetic pentru PPR 32 - 13 mm", "elastomer"],
    ["Izolare conducte cu elastmer 13mm DN32", "elastomer"],
    ["Izolatie K-Flex 19 mm DN50", "elastomer"],
    ["Kautschuk, d=9mm, DN20", "elastomer"],
    ["Izolare conducte cu cochilii 40 mm DN80", "vata_minerala"],
    ["Izolare conducte agent termic cu vata caserata 30 mm, DN50", "vata_minerala"],
    ["Izolare cu saltele 50 mm DN200", "vata_minerala"],
    ["Izolatie MW 50 mm DN100", "vata_minerala"],
    ["Mineralwolle 50 mm DN100", "vata_minerala"],
    ["Izolatii cu vata minrala si protectie cu tabla de alumniu Di49, g40 - ML", "vata_minerala"],
  ])("%s → %s", (text, sistem) => {
    expect(sisteme(text)[0]).toBe(sistem);
  });
  it("„tb. Al”, „tablă Al”, „alumniu” sunt tablă de aluminiu", () => {
    expect(sisteme("Izolatii vata min. + tb. Al Di27 g40 ML")).toEqual(["vata_minerala", "tabla"]);
    expect(sisteme("Izolatii vata minerala 40 mm cu tabla Al Di27")).toEqual(["vata_minerala", "tabla"]);
  });
  it("cauciucul garniturilor și al suporților nu e izolație", () => {
    expect(sisteme("Tubulatura rectangulara din tabla zincata, inclusiv garnituri, tamburi de cauciuc, console")[0]).toBeNull();
    expect(sisteme("sistem de prindere, izolatoare antivibratii din cauciuc, profile de montaj")[0]).toBeNull();
  });
});

describe("ce lipsește din cerere se întreabă clientul", () => {
  it("„protecție cu tablă” fără material: „Fără preț”; protecția aleasă de om îl tarifează", async () => {
    const { rez, opt } = await importa([[1, "Izolatii cu vata minerala si protectie cu tabla Di76, g50 - ML", "ml", 10]]);
    const l = r2(rez);
    expect([stare(l), l.codEroare]).toEqual(["fara", "tabla_fara_material"]);
    // Grosimea schimbată singură nu ajunge: tabla tot nu e aleasă.
    rez.rezolvate.set(l.extras.index, { extras: { ...l.extras, ...patchDinCamp(l.extras, "grosime", "60") }, sursa: "om" });
    reevalueaza(rez, opt);
    const g = r2(rez);
    expect([stare(g), g.codEroare]).toEqual(["fara", "tabla_fara_material"]);
    rez.rezolvate.set(l.extras.index, { extras: { ...g.extras, ...patchDinCamp(g.extras, "protectie", "tabla|") }, sursa: "om" });
    reevalueaza(rez, opt);
    const ales = r2(rez);
    expect(stare(ales)).toBe("gata");
    expect(ales.pret!.pret_unitar).toBeGreaterThan(30);
  });

  it("caseta „din tablă și vată”, fără material la tablă: tot „Fără preț”", async () => {
    const { rez } = await importa([
      [1, "IZOLATII | Caseta izolatie armaturi cu flanse DN125 din tabla si vata", "buc", 2],
      [2, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di140, g50 - ML", "ml", 10],
    ]);
    const c = rez.linii.find((x) => x.bruta.text.includes("Caseta"))!;
    expect([stare(c), c.codEroare]).toEqual(["fara", "tabla_fara_material"]);
  });

  it("lipsește materialul: grosimea scrisă singură nu mai tarifează vata pusă ca loc", async () => {
    const { rez, opt } = await importa([[1, "Izolare conducta DN65", "ml", 10]]);
    const l = r2(rez);
    expect(l.codEroare).toBe("lipseste_materialul");
    rez.rezolvate.set(l.extras.index, { extras: { ...l.extras, ...patchDinCamp(l.extras, "grosime", "19") }, sursa: "om" });
    reevalueaza(rez, opt);
    expect(r2(rez).codEroare).toBe("lipseste_materialul");
    const e = r2(rez).extras;
    rez.rezolvate.set(l.extras.index, { extras: { ...e, ...patchDinCamp(e, "sistem", "elastomer") }, sursa: "om" });
    reevalueaza(rez, opt);
    expect(stare(r2(rez))).toBe("gata");
  });

  it("demontarea izolației: poziție „Fără preț”, cu prețul pus de mână", async () => {
    const randuri = [[1, "Demontare izolatie veche si transport la groapa", "ml", 40]];
    const { rez } = await importa(randuri);
    const l = r2(rez);
    expect([stare(l), l.codEroare]).toEqual(["fara", "demontare"]);
    reevalueaza(rez, { stoc: stocInMemorie(), preturiManuale: new Map([[l.extras.index, 3.5]]) });
    expect([stare(r2(rez)), r2(rez).pret!.pret_unitar]).toEqual(["gata", 3.5]);
  });

  it("elastomer 40 mm: fără preț (nu avem prețuri peste 32 mm)", () => {
    expect(() => tarifeazaPeMp({ straturi: [{ sistem: "elastomer", grosime_mm: 40 }], cantitate: 1 })).toThrow();
  });
});

describe("tubulatura rectangulară în metri: regula firmei", () => {
  it("2 × (A + B + 2g) / 1000: 400 × 300 cu vată 50 → 1,6 m²/ml", () => {
    expect(mpPeMlRectangular("Izolare tubulatura 400x300 cu vata minerala 50 mm", 50)).toEqual({ a: 400, b: 300, mp: 1.6 });
    expect(mpPeMlRectangular("Teava DN100 vata 50 mm", 50)).toBeNull();
  });

  it("pe rând: prețul pe m² × 1,6, „Gata”", async () => {
    const { rez } = await importa([[1, "Izolare tubulatura 400x300 cu vata minerala 50 mm", "ml", 30]]);
    const l = r2(rez);
    const peMp = tarifeazaPeMp({ straturi: [{ sistem: "vata_minerala", grosime_mm: 50 }], cantitate: 1 }).pret_unitar;
    expect(l.pret!.pret_unitar).toBe(Math.round(peMp * 1.6 * 100) / 100);
    expect(stare(l)).toBe("gata");
  });
});

describe("mărunte din răspunsuri", () => {
  it("Conlit fără grosime: 60 mm", async () => {
    const { rez } = await importa([[1, "Protectie la foc EI60 a tubulaturii de desfumare cu placi Conlit", "mp", 20]]);
    const l = r2(rez);
    expect(l.pret && "straturi" in l.pret ? l.pret.straturi[0]!.grosime_mm : null).toBe(60);
  });

  it("fără UM: „De verificat”, afară de când textul o spune („- ML”)", async () => {
    const { rez } = await importa([
      [1, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di60, g40", null, 16],
      [2, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di60, g40 - ML", null, 16],
    ]);
    const [fara, cuMl] = [2, 3].map((n) => rez.linii.find((x) => x.bruta.rand === n));
    expect([stare(fara!), fara!.pret?.motiveDeVerificat]).toEqual(["verif", ["um_lipsa"]]);
    expect(stare(cuMl!)).toBe("gata");
  });

  it("închiderea de gol pe un pat de cabluri: „De verificat”", async () => {
    const { rez } = await importa([[1, "Inchideri goluri la foc EI120 - pat de cabluri 300/100", "buc", 4]]);
    const l = r2(rez);
    expect(l.pret?.motiveDeVerificat).toContain("pat_cabluri");
    expect(stare(l)).toBe("verif");
  });

  it("cantitatea 0 rămâne 0: poziția are preț și valoarea 0", async () => {
    const { rez } = await importa([[1, "Izolatii cu vata minerala si protectie cu tabla de aluminiu Di60, g40 - ML", "ml", 0]]);
    const l = r2(rez);
    expect([l.bruta.cantitate, stare(l), l.pret!.total]).toEqual([0, "gata", 0]);
  });
});

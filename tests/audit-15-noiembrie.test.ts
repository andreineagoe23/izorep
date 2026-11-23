/**
 * Rândurile din auditul din 15 noiembrie 2026 (`docs/audit-2026-11-15.md`), pe
 * cererile de probă din `exemple-AI/` (în repo, deci rulează și în CI), doar
 * regulile. Prețul așteptat e cel din `cheie-de-verificare.xlsx`.
 */
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { parseFoi } from "../src/import/parse-workbook.js";
import { proceseazaRegistru, type LinieProcesata } from "../src/import/nucleu.js";
import { mapariStatice } from "../src/import/mapari-statice.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { potrivit } from "../web/validare.js";
import { lasateAfara } from "../src/import/lasate-afara.js";
import type { Extractor } from "../src/import/nucleu.js";

const EX1 = join(__dirname, "../exemple-AI/exemplu-1-abur-industrial/1-cerere-de-oferta-fabrica-demo-abur.xlsx");
const EX2 = join(__dirname, "../exemple-AI/exemplu-2-cladire-rezidential/1-cerere-de-oferta-ansamblu-demo-bloc-c2.xlsx");

const importa = async (f: string, destinatie: "rezidential" | "industrial") =>
  proceseazaRegistru(await parseFoi(f), { stoc: stocInMemorie(), mapari: mapariStatice(), destinatie });

const rand = (linii: LinieProcesata[], foaie: string, r: number): LinieProcesata =>
  linii.find((l) => l.bruta.foaie === foaie && l.bruta.rand === r)!;

const stare = (l: LinieProcesata | undefined): string =>
  !l ? "afara" : potrivit(l, "gata") ? "gata" : potrivit(l, "de_validat") ? "de_validat" : potrivit(l, "netarifate") ? "fara_pret" : "afara";

describe("auditul din 15 noiembrie: prețuri greșite „Gata”", () => {
  it("„protecție cu tablă” fără material: „Fără preț”, de întrebat clientul, fără tablă presupusă (ex. 1, r10)", async () => {
    // Până pe 23 noiembrie 2026: aluminiu presupus, 38,51 € „De verificat”. Firma: „depinde de lucrare: întrebăm clientul”.
    const l = rand((await importa(EX1, "industrial")).linii, "Izolatii", 10);
    expect([stare(l), l.codEroare, l.pret]).toEqual(["fara_pret", "tabla_fara_material", undefined]);
    expect(l.extras.straturi_extra.some((x) => x.sistem === "tabla")).toBe(false);
  });

  it("„protecție cu tablă de aluminiu” rămâne „Gata”, fără motivul nou (ex. 1, r1)", async () => {
    const l = rand((await importa(EX1, "industrial")).linii, "Izolatii", 1);
    expect(l.pret?.pret_unitar).toBe(33.25);
    expect(stare(l)).toBe("gata");
  });

  it("„gr 19” fără „mm” e grosimea: 19 mm, nu 9 mm de la țeava PEHD (ex. 2, r27)", async () => {
    const l = rand((await importa(EX2, "rezidential")).linii, "Termice+Sanitare", 27);
    expect(l.extras.grosime_mm).toBe(19);
    expect(l.pret?.pret_unitar).toBe(14.82);
    expect(stare(l)).toBe("gata");
  });

  it("„gr 19” se citește doar ca grosime a materialului: „gr 2 kg”, „gr 7” nu", async () => {
    const { extrageDeterminist, scrieGrosime } = await import("../src/import/extract-regex.js");
    expect(extrageDeterminist(0, "Izolare conducte DN80 cu elastomer gr. 19", "ml", undefined, 1).linie.grosime_mm).toBe(19);
    expect(extrageDeterminist(0, "Izolare conducte DN80 cu elastomer gr19", "ml", undefined, 1).linie.grosime_mm).toBe(19);
    expect(extrageDeterminist(0, "Izolare conducte DN80 cu elastomer gr 7", "ml", undefined, 1).linie.grosime_mm).toBeNull();
    expect(scrieGrosime("elastomer gr 2 kg")).toBe(false);
  });

  it("fără grosime și fără țeavă de același ø: „Fără preț”, de întrebat clientul (ex. 1, r14; r28; ex. 2, r13)", async () => {
    // Până pe 23 noiembrie 2026: tabelul de grosimi uzuale sau țeava vecină. Firma:
    // „întrebăm clientul”, „nu există grosimi uzuale”.
    const r1 = (await importa(EX1, "industrial")).linii;
    for (const r of [14, 28]) {
      const l = rand(r1, "Izolatii", r);
      expect([r, stare(l), l.codEroare, l.extras.grosime_mm]).toEqual([r, "fara_pret", "grosime_ambigua", null]);
    }
    const b = rand((await importa(EX2, "rezidential")).linii, "Termice+Sanitare", 13);
    expect([stare(b), b.codEroare]).toEqual(["fara_pret", "grosime_ambigua"]);
  });

});

describe("auditul din 15 noiembrie: izolația fără material", () => {
  it("„Casetă armături DN80” și „Izolare conductă DN65” sunt poziții „Fără preț”, cu cauza, nu „Lăsate afară”", async () => {
    const r1 = await importa(EX1, "industrial");
    const caseta = rand(r1.linii, "Izolatii", 21);
    expect([stare(caseta), caseta.codEroare, caseta.pret]).toEqual(["fara_pret", "lipseste_materialul", undefined]);
    const r2 = await importa(EX2, "rezidential");
    const conducta = rand(r2.linii, "Termice+Sanitare", 25);
    expect([stare(conducta), conducta.codEroare]).toEqual(["fara_pret", "lipseste_materialul"]);
    // Ce rămâne afară e de altă meserie (robinet, țeava PPR, tubulatura neizolată)
    // sau trecerile la foc, punctul 6 din audit. Demontarea izolației (r33) e din
    // 23 noiembrie 2026 poziție „Fără preț”, cu prețul pus de mână.
    expect(lasateAfara(r1).map((a) => a.rand)).toEqual([34]);
    expect(lasateAfara(r2).map((a) => `${a.foaie} ${a.rand}`)).toEqual([
      "Termice+Sanitare 31", "Termice+Sanitare 32", "Ventilatie 12", "Treceri foc 15", "Treceri foc 16",
    ]);
  });

  it("codul de rând singur („IZOLATII | Robinet cu sertar DN50”) nu face din rând izolație", async () => {
    expect(stare(rand((await importa(EX1, "industrial")).linii, "Izolatii", 34))).toBe("afara");
  });

  it("cu model, rândul fără material pleacă tot la model, iar citirea lui îl tarifează", async () => {
    const trimise: string[] = [];
    const model: Extractor = async (linii) => linii.map((l) => {
      trimise.push(l.text);
      const dn = /DN(\d+)/.exec(l.text);
      return /Izolare conducta DN65/.test(l.text)
        ? { index: l.index, sistem: "elastomer", diametru_valoare: 65, diametru_tip: "DN", grosime_mm: 19, forma: "ml",
          gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [], incredere: 0.95, motiv: "apa: elastomer" }
        : { index: l.index, sistem: null, diametru_valoare: dn ? Number(dn[1]) : null, diametru_tip: dn ? "DN" : null,
          grosime_mm: null, forma: null, gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [], incredere: 0.9, motiv: "" };
    });
    const rez = await proceseazaRegistru(await parseFoi(EX2),
      { stoc: stocInMemorie(), mapari: mapariStatice(), destinatie: "rezidential", extrage: model, douaCitiri: false });
    expect(trimise, trimise.join("\n")).toContain("Izolare conducta DN65");
    const l = rand(rez.linii, "Termice+Sanitare", 25);
    expect(l.pret?.pret_unitar).toBe(14.36);
    // Modelul care nu știe nici el materialul nu șterge cauza.
    const nimic = rand(rez.linii, "Termice+Sanitare", 30);
    expect(nimic.codEroare ?? nimic.extras.sistem).toBeTruthy();
  });
});

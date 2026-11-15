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

const EX1 = join(__dirname, "../exemple-AI/exemplu-1-abur-industrial/1-cerere-de-oferta-fabrica-demo-abur.xlsx");
const EX2 = join(__dirname, "../exemple-AI/exemplu-2-cladire-rezidential/1-cerere-de-oferta-ansamblu-demo-bloc-c2.xlsx");

const importa = async (f: string, destinatie: "rezidential" | "industrial") =>
  proceseazaRegistru(await parseFoi(f), { stoc: stocInMemorie(), mapari: mapariStatice(), destinatie });

const rand = (linii: LinieProcesata[], foaie: string, r: number): LinieProcesata =>
  linii.find((l) => l.bruta.foaie === foaie && l.bruta.rand === r)!;

const stare = (l: LinieProcesata): string =>
  potrivit(l, "gata") ? "gata" : potrivit(l, "de_validat") ? "de_validat" : potrivit(l, "netarifate") ? "fara_pret" : "afara";

describe("auditul din 15 noiembrie: prețuri greșite „Gata”", () => {
  it("„protecție cu tablă” fără material: tablă de aluminiu, cu preț, „De verificat” (ex. 1, r10)", async () => {
    const l = rand((await importa(EX1, "industrial")).linii, "Izolatii", 10);
    expect(l.pret?.pret_unitar).toBe(38.51);
    expect(stare(l)).toBe("de_validat");
    expect(l.pret?.motiveDeVerificat).toContain("tabla_fara_material");
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

  it("fără grosime și fără țeavă de același ø: tabelul firmei, 100 mm, „De verificat” (ex. 1, r14)", async () => {
    const l = rand((await importa(EX1, "industrial")).linii, "Izolatii", 14);
    expect(l.extras.grosime_mm).toBe(100);
    expect(l.pret?.pret_unitar).toBe(101.84);
    expect(stare(l)).toBe("de_validat");
    expect(l.pret?.motiveDeVerificat).toContain("grosime_fara_conducta");
  });

  it("vecina cu aceeași grosime ca tabelul nu contrazice regula: rămâne „Gata” (ex. 1, r28; ex. 2, r13)", async () => {
    const a = rand((await importa(EX1, "industrial")).linii, "Izolatii", 28);
    expect([a.pret?.pret_unitar, stare(a)]).toEqual([19.64, "gata"]);
    const b = rand((await importa(EX2, "rezidential")).linii, "Termice+Sanitare", 13);
    expect([b.pret?.pret_unitar, stare(b)]).toEqual([8.66, "gata"]);
  });
});

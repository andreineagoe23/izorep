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
});

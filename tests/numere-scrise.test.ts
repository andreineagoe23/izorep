/**
 * Testul complet din 26 noiembrie 2026: în casetele `type="number"`, „2,97”
 * tastat devenea 297 (Chrome aruncă virgula, iar caseta rămâne „validă”): pe
 * o factură, prețul ieșea de 100 de ori mai mare, fără niciun semn. Casetele
 * de numere sunt text cu `inputmode="decimal"` (tastatura numerică pe
 * telefon), citite românește cu `numarScris`.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { numarScris } from "../web/celula.js";

const fisiere = (d: string): string[] => readdirSync(d).flatMap((f) => {
  const c = join(d, f);
  return statSync(c).isDirectory() ? fisiere(c) : c.endsWith(".ts") ? [c] : [];
});

describe("numerele scrise de om", () => {
  it("nicio casetă `type=\"number\"` în ecrane", () => {
    const cu = fisiere(join(__dirname, "../web")).filter((f) => /type=\\?"number\\?"/.test(readFileSync(f, "utf8")));
    expect(cu).toEqual([]);
  });

  it("se citesc românește: virgula zecimală, punctul de mii, și punctul zecimal", () => {
    expect(["2,97", "1.250", "1.250,5", "12.5", " 7 ", "", "abc"].map(numarScris)).toEqual([2.97, 1250, 1250.5, 12.5, 7, null, null]);
  });
});

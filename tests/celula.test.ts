/**
 * Numărul scris de om în celulele ofertei și ale necesarului (`web/celula.ts`).
 * O cifră citită greșit aici devine o cantitate sau un preț greșit în ofertă.
 */
import { describe, it, expect } from "vitest";
import { numarInCelula, numarScris } from "../web/celula.js";

describe("numărul scris în celulă", () => {
  it("se citește cu virgulă, cu punct de mii sau cu punct zecimal", () => {
    expect(numarScris("121,67")).toBe(121.67);
    expect(numarScris("1.234,5")).toBe(1234.5);
    expect(numarScris(" 1 234,5 ")).toBe(1234.5);
    expect(numarScris("1234.5")).toBe(1234.5);
    expect(numarScris("100")).toBe(100);
    expect(numarScris("1.250")).toBe(1250);
    expect(numarScris("12.500.000")).toBe(12500000);
    expect(numarScris("0.125")).toBe(0.125);
    expect(numarScris("1.25")).toBe(1.25);
  });

  it("gol sau text nu e număr", () => {
    expect(numarScris("")).toBeNull();
    expect(numarScris("  ")).toBeNull();
    expect(numarScris("abc")).toBeNull();
  });

  it("se scrie înapoi în celulă fără separator de mii, ca să se poată citi la fel", () => {
    for (const n of [121.67, 1234.5, 0.125, 99415.02]) expect(numarScris(numarInCelula(n))).toBe(n);
    expect(numarInCelula(null)).toBe("");
  });
});

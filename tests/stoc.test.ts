/** Registrul de stoc (`src/stoc/registru.ts`): stocul e suma mișcărilor. */
import { describe, it, expect } from "vitest";
import {
  articolDin, deComandat, pretMediu, esteAnulata, solduri, storno, type Miscare,
} from "../src/stoc/registru.js";
import type { MaterialNecesar } from "../src/stoc/necesar.js";

const vata = articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 114 });
const tabla = articolDin({ sistem: "tabla", grosime_mm: 0.8, rand: 220 });
let n = 0;
const m = (p: Partial<Miscare> & Pick<Miscare, "tip" | "cantitate">): Miscare =>
  ({ id: `m${++n}`, data: "2026-09-29T08:00:00.000Z", articol: vata, ...p });
const sold = (ms: Miscare[], depozit: string, cheie = vata.cheie): number =>
  solduri(ms).find((s) => s.depozit === depozit && s.articol.cheie === cheie)?.cantitate ?? 0;

describe("registrul de stoc", () => {
  it("soldul e suma mișcărilor: intrare, transfer pe șantier, consum, retur", () => {
    const ms = [
      m({ tip: "intrare", cantitate: 100, spre: "central" }),
      m({ tip: "transfer", cantitate: 60, din: "central", spre: "santier" }),
      m({ tip: "consum", cantitate: 45, din: "santier" }),
      m({ tip: "retur", cantitate: 5, din: "santier", spre: "central" }),
    ];
    expect(sold(ms, "central")).toBe(45);
    expect(sold(ms, "santier")).toBe(10);
  });

  it("stornoul readuce soldul și nu se poate aplica de două ori", () => {
    const intrare = m({ tip: "intrare", cantitate: 30, spre: "central" });
    const s = storno(intrare, [intrare], "s1", "2026-09-29T09:00:00.000Z")!;
    expect(sold([intrare, s], "central")).toBe(0);
    expect(esteAnulata(intrare, [intrare, s])).toBe(true);
    expect(storno(intrare, [intrare, s], "s2", "x")).toBeNull();
    expect(storno(s, [intrare, s], "s3", "x")).toBeNull();
    expect(s.nota).toBe("anulează mișcarea din 29.09.2026");
  });

  it("de comandat = necesar − stocul din depozitele lucrării, niciodată negativ", () => {
    const nec: MaterialNecesar[] = [
      { cheie: vata.cheie, sistem: "vata_minerala", grosime_mm: 50, rand: 114, ml: 80, m2: 60, bucati: 0, pozitii: 2, valoareOferta: 0 },
      { cheie: tabla.cheie, sistem: "tabla", grosime_mm: 0.8, rand: 220, ml: 80, m2: 70, bucati: 0, pozitii: 2, valoareOferta: 0 },
    ];
    const ms = [
      m({ tip: "intrare", cantitate: 50, spre: "central" }),
      m({ tip: "intrare", cantitate: 500, spre: "alt-santier", articol: tabla }),
      m({ tip: "intrare", cantitate: 90, spre: "central", articol: tabla }),
    ];
    const r = deComandat(nec, solduri(ms), ["central", "santier"]);
    expect(r.map((x) => [x.necesar, x.inStoc, x.deComandat])).toEqual([[80, 50, 30], [70, 90, 0]]);
  });

  it("costul: media intrărilor cu preț, ponderată cu cantitatea; anulatele nu intră", () => {
    const a = m({ tip: "intrare", cantitate: 100, spre: "central", pret: { valoare: 10 } });
    const b = m({ tip: "intrare", cantitate: 300, spre: "central", pret: { valoare: 14 } });
    const anulata = m({ tip: "intrare", cantitate: 1000, spre: "central", pret: { valoare: 99 } });
    const ms = [a, b, anulata, storno(anulata, [anulata], "x", "2026-09-29T09:00:00.000Z")!];
    expect(pretMediu(ms, vata.cheie)).toBe(13);
    expect(pretMediu(ms, tabla.cheie)).toBeNull();
  });
});

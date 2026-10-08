/** Registrul de stoc (`src/stoc/registru.ts`): stocul e suma mișcărilor. */
import { describe, it, expect } from "vitest";
import {
  articolDin, deComandat, laAmbalaj, pretMediu, esteAnulata, solduri, storno, type Miscare,
} from "../src/stoc/registru.js";
import { materialManual, type MaterialNecesar } from "../src/stoc/necesar.js";

const vata = articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 114 });
const tabla = articolDin({ sistem: "tabla", grosime_mm: 0.8, rand: 220 });
let n = 0;
const m = (p: Partial<Miscare> & Pick<Miscare, "tip" | "cantitate">): Miscare =>
  ({ id: `m${++n}`, data: "2026-09-29T08:00:00.000Z", articol: vata, ...p });
const sold = (ms: Miscare[], depozit: string, cheie = vata.cheie): number =>
  solduri(ms).find((s) => s.depozit === depozit && s.articol.cheie === cheie)?.cantitate ?? 0;

const baza = { piese: 0, piesePresupuse: 0, pierdere: 0, pozitii: 2, pePozitie: [], valoareOferta: 0 };

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
      { ...baza, cheie: vata.cheie, sistem: "vata_minerala", grosime_mm: 50, rand: 114, categorie: "tub", ml: 80, m2: 60 },
      { ...baza, cheie: tabla.cheie, sistem: "tabla", grosime_mm: 0.8, rand: 220, categorie: "tabla", ml: 80, m2: 70 },
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

  it("marca: stocul de orice marcă acoperă necesarul, iar costul e media pe toate mărcile (S11)", () => {
    const armaflex = articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 114 }, "Rockwool");
    const isover = articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 114 }, "Isover");
    expect(armaflex.cheie).not.toBe(isover.cheie);
    const ms = [
      m({ tip: "intrare", cantitate: 30, spre: "central", articol: armaflex, pret: { valoare: 10 } }),
      m({ tip: "intrare", cantitate: 10, spre: "central", articol: isover, pret: { valoare: 14 } }),
    ];
    // Stocul le ține separat …
    expect(solduri(ms)).toHaveLength(2);
    // … dar pentru necesar (fără marcă) contează amândouă.
    const nec: MaterialNecesar[] = [{ ...baza, cheie: vata.cheie, sistem: "vata_minerala", grosime_mm: 50, rand: 114, categorie: "tub", ml: 80, m2: 60 }];
    expect(deComandat(nec, solduri(ms), ["central"])[0]!.deComandat).toBe(40);
    expect(pretMediu(ms, vata.cheie)).toBe(11);
  });

  it("ambalajul: comanda se rotunjește în sus la ambalaj întreg, restul rămâne în depozit (S14)", () => {
    expect(laAmbalaj(25, { unitate: "cutie", continut: 12 })).toEqual({
      cate: 3, ambalaj: { unitate: "cutie", continut: 12 }, cantitate: 36, rest: 11,
    });
    expect(laAmbalaj(24, { unitate: "cutie", continut: 12 }).cate).toBe(2);
    const nec: MaterialNecesar[] = [{ ...baza, cheie: vata.cheie, sistem: "vata_minerala", grosime_mm: 50, rand: 114, categorie: "tub", ml: 80, m2: 60 }];
    const r = deComandat(nec, [], ["central"], { [vata.cheie]: { unitate: "cutie", continut: 12 } })[0]!;
    expect(r.deComandat).toBe(80);
    expect(r.ambalaje).toMatchObject({ cate: 7, cantitate: 84, rest: 4 });
  });

  it("materialul clientului nu se comandă (S38)", () => {
    const nec: MaterialNecesar[] = [{ ...baza, cheie: vata.cheie, sistem: "vata_minerala", grosime_mm: 50, rand: 114, categorie: "tub", ml: 80, m2: 60, alClientului: true }];
    expect(deComandat(nec, [], ["central"])[0]).toMatchObject({ deComandat: 0, alClientului: true });
  });

  it("materialul adăugat de mână intră în „De comandat”, cu motivul lui; tabla are și kg", () => {
    const banda = materialManual("tabla", 0.8, null, 25, "goluri la foc, poziția 12");
    expect(banda).toMatchObject({ m2: 25, kg: 54, manual: "goluri la foc, poziția 12", categorie: "tabla" });
    expect(deComandat([banda], [], ["central"])[0]!.deComandat).toBe(25);
  });
});

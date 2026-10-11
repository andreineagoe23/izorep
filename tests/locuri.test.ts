/**
 * Faza 5: locurile, atelierul, transferurile (`src/stoc/locuri.ts`).
 *
 * Gata când (`docs/plan-implementare.md`): pentru o bucată de tablă se vede
 * drumul complet — furnizor, central, atelier, șantier. Exemplul e cel al
 * firmei (răspunsul 4): șeful de șantier cere la atelier 10 ml ø100, 3 coturi
 * și 10 carcase; tabla trece din central în atelier, e pusă deoparte, apoi
 * pleacă pe șantier.
 */
import { describe, it, expect } from "vitest";
import { ATELIER, CENTRAL, FIRMA_CENTRAL, drumul, inAtelier, intreFirme, locuri } from "../src/stoc/locuri.js";
import { articolDin, cheieBaza, solduri, storno, type Miscare } from "../src/stoc/registru.js";

const TABLA = articolDin({ sistem: "tabla", grosime_mm: 0.8, rand: null });
const TABLA_MARCA = articolDin({ sistem: "tabla", grosime_mm: 0.8, rand: null }, "Alutech");
let n = 0;
const m = (p: Partial<Miscare> & Pick<Miscare, "tip" | "cantitate">): Miscare =>
  ({ id: `m${++n}`, data: `2026-10-${String(10 + n).padStart(2, "0")}T08:00:00.000Z`, articol: TABLA, ...p });

const SANTIERE = [
  { id: "S-284", denumire: "TRANSAVIA", firma: "RADOIA ISOLIRUNG SRL" },
  { id: "S-118", denumire: "XXXLutz", firma: "R&F ISORAD SYSTEM SRL" },
];

describe("locurile", () => {
  it("centralul, atelierul, apoi șantierele, fiecare cu firma lui și responsabilul scris", () => {
    const l = locuri(SANTIERE, { "S-284": "Ion Popescu" });
    expect(l.map((x) => [x.id, x.tip, x.firma, x.responsabil ?? null])).toEqual([
      [CENTRAL, "central", FIRMA_CENTRAL, null],
      [ATELIER, "atelier", FIRMA_CENTRAL, null],
      ["S-284", "santier", "RADOIA ISOLIRUNG SRL", "Ion Popescu"],
      ["S-118", "santier", "R&F ISORAD SYSTEM SRL", null],
    ]);
  });

  it("transferul între depozite ale unor firme diferite e marcat; în aceeași firmă, nu", () => {
    const l = locuri(SANTIERE);
    expect(intreFirme({ tip: "transfer", din: CENTRAL, spre: "S-118" }, l))
      .toEqual({ din: "RADOIA ISOLIRUNG SRL", spre: "R&F ISORAD SYSTEM SRL" });
    expect(intreFirme({ tip: "transfer", din: CENTRAL, spre: "S-284" }, l)).toBeNull();
    expect(intreFirme({ tip: "transfer", din: "S-284", spre: "S-118" }, l)).not.toBeNull();
    expect(intreFirme({ tip: "intrare", spre: "S-118" }, l)).toBeNull();
  });
});

describe("atelierul", () => {
  const intrare = m({ tip: "intrare", cantitate: 60, spre: CENTRAL, furnizor: "ISOLINE" });
  const laAtelier = m({ tip: "transfer", cantitate: 12, din: CENTRAL, spre: ATELIER, lucrareId: "S-284",
    nota: "10 ml ø100, 3 coturi și 10 carcase" });
  const liber = m({ tip: "transfer", cantitate: 5, din: CENTRAL, spre: ATELIER });

  it("tabla trecută în atelier pentru un șantier stă pusă deoparte, separat de cea liberă", () => {
    const a = inAtelier([intrare, laAtelier, liber]);
    expect(a.map((x) => [x.pentru, x.cantitate, x.cereri])).toEqual([
      ["S-284", 12, ["10 ml ø100, 3 coturi și 10 carcase"]],
      [null, 5, []],
    ]);
    // Soldul atelierului e tot suma mișcărilor: 17 m².
    expect(solduri([intrare, laAtelier, liber]).find((s) => s.depozit === ATELIER)?.cantitate).toBe(17);
  });

  it("plecată pe șantier, nu mai e pusă deoparte; o parte rămâne", () => {
    const pleaca = m({ tip: "transfer", cantitate: 8, din: ATELIER, spre: "S-284", lucrareId: "S-284" });
    expect(inAtelier([intrare, laAtelier, liber, pleaca]).map((x) => [x.pentru, x.cantitate]))
      .toEqual([["S-284", 4], [null, 5]]);
    const rest = m({ tip: "transfer", cantitate: 4, din: ATELIER, spre: "S-284" });
    expect(inAtelier([intrare, laAtelier, liber, pleaca, rest]).map((x) => [x.pentru, x.cantitate]))
      .toEqual([[null, 5]]);
  });

  it("anulată, trecerea în atelier dispare din ce e pus deoparte", () => {
    const anulare = storno(laAtelier, [laAtelier], "s1", "2026-10-30T00:00:00.000Z")!;
    expect(inAtelier([intrare, laAtelier, anulare])).toEqual([]);
  });
});

describe("drumul tablei: furnizor, central, atelier, șantier", () => {
  it("se vede fiecare pas, în ordine, pe toate mărcile", () => {
    const miscari: Miscare[] = [
      m({ tip: "intrare", cantitate: 60, spre: CENTRAL, furnizor: "ISOLINE", articol: TABLA_MARCA }),
      m({ tip: "intrare", cantitate: 30, spre: "S-118", furnizor: "Banda Tech" }), // alt șantier: nu e drumul lui
      m({ tip: "transfer", cantitate: 12, din: CENTRAL, spre: ATELIER, lucrareId: "S-284", articol: TABLA_MARCA }),
      m({ tip: "transfer", cantitate: 12, din: ATELIER, spre: "S-284", lucrareId: "S-284", articol: TABLA_MARCA }),
      m({ tip: "transfer", cantitate: 2, din: "S-284", spre: "S-118" }),
    ];
    const d = drumul(miscari, cheieBaza(TABLA), "S-284");
    expect(d.map((p) => [p.din, p.spre, p.cantitate])).toEqual([
      ["ISOLINE", CENTRAL, 60],
      [CENTRAL, ATELIER, 12],
      [ATELIER, "S-284", 12],
      ["S-284", "S-118", 2],
    ]);
  });
});

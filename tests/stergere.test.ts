/**
 * Ce spune panoul de ștergere despre stocul din alte locuri (audit 16
 * octombrie): un transfer din central pe șantier, șters, pune materialul
 * înapoi în central; restul adus înapoi de pe șantier dispare din central.
 */
import { describe, expect, it } from "vitest";
import { ceSeSterge, rezumatStergere } from "../web/stergere.js";
import { articolDin, type Miscare } from "../src/stoc/registru.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";

const ZI = "2026-10-21T08:00:00.000Z";
const tabla = articolDin({ sistem: "tabla", grosime_mm: 0.8, rand: null });
const vata = articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 140 });
const plan = { id: "S-1", denumire: "Hala", situatii: [], pozitii: [] } as unknown as PlanSantier;

describe("ștergerea unui șantier și stocul din alte locuri", () => {
  it("spune ce se întoarce în central și ce dispare din atelier", () => {
    const miscari: Miscare[] = [
      { id: "t1", data: ZI, tip: "transfer", articol: tabla, cantitate: 100, din: "central", spre: "S-1" },
      { id: "t2", data: ZI, tip: "transfer", articol: vata, cantitate: 10, din: "S-1", spre: "atelier" },
      { id: "i1", data: ZI, tip: "intrare", articol: vata, cantitate: 50, spre: "S-1" },
      { id: "alt", data: ZI, tip: "intrare", articol: vata, cantitate: 5, spre: "central" },
    ];
    const s = ceSeSterge({ planuri: [plan], depozit: { miscari, necesare: [] }, oferte: {} }, { santier: "S-1" });
    expect(s.miscari.sort()).toEqual(["i1", "t1", "t2"]);
    expect(s.alteLocuri).toEqual([
      { nume: "depozitul central", materiale: 1, revine: true, dispare: false },
      { nume: "atelier", materiale: 1, revine: false, dispare: true },
    ]);
    const r = rezumatStergere(s);
    expect(r).toContain("atenție: se schimbă și stocul din depozitul central, la 1 material: ce a plecat de acolo se întoarce acolo");
    expect(r).toContain("atenție: se schimbă și stocul din atelier, la 1 material: ce a ajuns acolo de aici dispare");
  });

  it("fără mișcări spre alte locuri, nimic în plus", () => {
    const miscari: Miscare[] = [{ id: "i1", data: ZI, tip: "intrare", articol: vata, cantitate: 50, spre: "S-1" }];
    expect(ceSeSterge({ planuri: [plan], depozit: { miscari, necesare: [] }, oferte: {} }, { santier: "S-1" }).alteLocuri).toBeUndefined();
  });
});

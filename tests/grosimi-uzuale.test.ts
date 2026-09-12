/**
 * Grosimea propusa cand clientul n-o scrie.
 *
 * Sursa e raspunsul firmei din 11 septembrie 2026, nu o deductie din oferte.
 * Distinctia conteaza: varianta dinainte a acestui test verifica tabelul dedus
 * din oferta TRANSAVIA (40/50/60 mm) si trecea — dar firma a spus ca acolo
 * grosimile fusesera cerute special de client. Testul trecea pe o exceptie
 * luata drept regula, exact felul de greseala pe care o suita de teste o poate
 * cimenta in loc s-o prinda.
 */
import { describe, it, expect } from "vitest";
import { grosimePropusa } from "../src/pricing/grosimi-uzuale.js";

describe("vata minerala — apa calda, agent termic, abur", () => {
  /** Tabelul firmei, pe DN, exact cum a fost dat. */
  const TABEL: [number, number][] = [
    [15, 20], [20, 20], [25, 20],
    [32, 30], [40, 40], [50, 50], [65, 60], [80, 80],
    [100, 100], [125, 100], [150, 100], [200, 100], [250, 100],
  ];

  it("fiecare DN primeste grosimea din tabel", () => {
    for (const [dn, g] of TABEL) {
      expect(grosimePropusa("vata_minerala", dn, "DN"), `DN${dn}`).toBe(g);
    }
  });

  it("peste DN100 ramane 100 mm, oricat de mare e teava", () => {
    // "ramane 100mm la ce e peste" — deci nu se opreste propunerea, ca la
    // elastomer, ci se pastreaza ultima treapta.
    expect(grosimePropusa("vata_minerala", 400, "DN")).toBe(100);
    expect(grosimePropusa("vata_minerala", 630, "exterior")).toBe(100);
  });

  it("acelasi rezultat cand clientul scrie diametrul exterior", () => {
    // Clientul scrie si "DN50" si "Di60" pentru aceeasi teava. Daca regula ar
    // depinde de notatie, aceeasi teava ar primi doua grosimi diferite.
    expect(grosimePropusa("vata_minerala", 60.3, "exterior")).toBe(50);
    expect(grosimePropusa("vata_minerala", 76.1, "exterior")).toBe(60);
    expect(grosimePropusa("vata_minerala", 114.3, "exterior")).toBe(100);
  });
});

describe("elastomer — apa rece, agent de frig", () => {
  it("cele trei benzi date de firma", () => {
    expect(grosimePropusa("elastomer", 60, "exterior")).toBe(13);
    expect(grosimePropusa("elastomer", 76, "exterior")).toBe(19);
    expect(grosimePropusa("elastomer", 219, "exterior")).toBe(19);
    expect(grosimePropusa("elastomer", 273, "exterior")).toBe(25);
    expect(grosimePropusa("elastomer", 324, "exterior")).toBe(25);
  });

  it("peste o324 nu se propune nimic", () => {
    // Acolo intra 32 mm, care "depinde de mediul inconjurator" — informatie
    // care nu e pe randul din Excel. Tacerea e raspunsul corect.
    expect(grosimePropusa("elastomer", 400, "exterior")).toBeNull();
  });

  it("9 mm nu se propune niciodata", () => {
    // Se foloseste "mai mult la pluviale", deci cere context, nu diametru.
    const propuse = [21.3, 33.7, 60, 76, 219, 273, 324]
      .map((od) => grosimePropusa("elastomer", od, "exterior"));
    expect(propuse).not.toContain(9);
  });
});

describe("unde nu exista temei, nu se propune nimic", () => {
  it("jachetele n-au propunere: grosimea lor vine din randul din lista", () => {
    expect(grosimePropusa("tabla", 100, "DN")).toBeNull();
    expect(grosimePropusa("tabla_inox", 100, "DN")).toBeNull();
    expect(grosimePropusa("pvc", 100, "DN")).toBeNull();
  });

  it("un DN care nu exista in tabelul de conversie nu produce o propunere", () => {
    expect(grosimePropusa("vata_minerala", 17, "DN")).toBeNull();
  });
});

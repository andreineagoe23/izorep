/**
 * Deduplicarea reziduului pe sablon.
 *
 * Regula pe care se sprijine tot: rolul e stabil pe sablon, valorile nu.
 * Masurat pe cele 9 fisiere de client, pe cele 64 de sabloane care apar de cel
 * putin doua ori, tripleta (sistem, tip diametru, forma) e identica intre
 * instante in 100% din cazuri. Vezi `.claude/plan-l1-l4.md`.
 *
 * Testele de aici verifica exact partea periculoasa: ca valorile NU se copiaza
 * si ca, atunci cand nu se stie sigur din ce slot vine un numar, linia merge la
 * model in loc sa fie ghicita.
 */
import { describe, it, expect } from "vitest";
import {
  sablonul, normalizeaza, proiectii, proiecteaza,
  grupeazaPeSablon, extindePeSablon,
} from "../src/import/sabloane.js";
import type { LinieExtrasa } from "../src/import/schema.js";

const linie = (p: Partial<LinieExtrasa> = {}): LinieExtrasa => ({
  index: 0, sistem: null, diametru_valoare: null, diametru_tip: null,
  grosime_mm: null, forma: null, gol_latime_mm: null, gol_inaltime_mm: null,
  straturi_extra: [], incredere: 0.9, motiv: "test", ...p,
});

const TEXT_A = "Izolatii cu vata minerala si protectie cu tabla de inox 304 Di89, g50 - COT";
const TEXT_B = "Izolatii cu vata minerala si protectie cu tabla de inox 304 Di60, g40 - COT";

describe("sablonul", () => {
  it("scoate numerele si pastreaza ordinea lor", () => {
    const s = sablonul(TEXT_A);
    expect(s.tipar).toBe("izolatii cu vata minerala si protectie cu tabla de inox # di#, g# - cot");
    expect(s.numere).toEqual([304, 89, 50]);
  });

  it("doua linii care difera doar prin cifre au acelasi tipar", () => {
    expect(sablonul(TEXT_A).tipar).toBe(sablonul(TEXT_B).tipar);
  });

  it("normalizeaza diacriticele si spatiile", () => {
    expect(normalizeaza("  Izolație   TERMICĂ ")).toBe("izolatie termica");
  });

  it("citeste virgula zecimala ca punct", () => {
    expect(sablonul("teava 60,3x3,6").numere).toEqual([60.3, 3.6]);
  });
});

describe("proiectia rolului", () => {
  const rep = linie({
    index: 1, sistem: "vata_minerala", diametru_valoare: 89, diametru_tip: "interior",
    grosime_mm: 50, forma: "cot",
  });

  it("duce rolul si RECITESTE numerele din linia tinta", () => {
    const harta = proiectii(rep, sablonul(TEXT_A))!;
    const p = proiecteaza(rep, harta, { index: 2, sablon: sablonul(TEXT_B) })!;
    expect(p.sistem).toBe("vata_minerala");
    expect(p.diametru_tip).toBe("interior");
    expect(p.forma).toBe("cot");
    // Astea sunt ale liniei tinta, nu ale reprezentantului. Aici e toata miza:
    // un cache care ar copia valorile ar tarifa Di60 cu pretul lui Di89.
    expect(p.diametru_valoare).toBe(60);
    expect(p.grosime_mm).toBe(40);
    expect(p.index).toBe(2);
    expect(p.motiv).toContain("sablon comun cu linia 1");
  });

  it("refuza sablonul cand valoarea nu apare printre numerele liniei", () => {
    // DN50 dedus din 2'' e corect, dar nu are slot: pe alta linie n-ar avea de
    // unde sa fie recitit.
    const dinToli = linie({ sistem: "elastomer", diametru_valoare: 50, diametru_tip: "DN", grosime_mm: 13 });
    expect(proiectii(dinToli, sablonul('Izolatie elastomer 13 mm pe teava 2"'))).toBeNull();
  });

  it("accepta acelasi numar in mai multe sloturi cat timp raman de acord", () => {
    // Articolul scris de doua ori, in germana si in romana: 40 apare in ambele
    // jumatati, dar spun acelasi lucru.
    const a = "Isolierung Armaflex PEHD D40x3.0 | Izolatie Armaflex 9mm pentru tub PEHD D40x3,0";
    const b = "Isolierung Armaflex PEHD D50x3.0 | Izolatie Armaflex 9mm pentru tub PEHD D50x3,0";
    const rep2 = linie({ sistem: "elastomer", diametru_valoare: 40, diametru_tip: "exterior", grosime_mm: 9 });
    const harta = proiectii(rep2, sablonul(a));
    expect(harta).not.toBeNull();
    expect(proiecteaza(rep2, harta!, { index: 3, sablon: sablonul(b) })!.diametru_valoare).toBe(50);
  });

  it("refuza linia cand sloturile ambigue nu mai sunt de acord", () => {
    const a = "tub D40 pentru tub D40";
    const b = "tub D50 pentru tub D63";   // aceleasi sloturi, valori diferite
    const rep2 = linie({ sistem: "elastomer", diametru_valoare: 40, diametru_tip: "exterior" });
    const harta = proiectii(rep2, sablonul(a))!;
    expect(proiecteaza(rep2, harta, { index: 4, sablon: sablonul(b) })).toBeNull();
  });
});

describe("gruparea reziduului", () => {
  const linii = [
    { index: 1, text: TEXT_A, um: "buc" },
    { index: 2, text: TEXT_B, um: "buc" },
    { index: 3, text: TEXT_B, um: "ml" },
    { index: 4, text: "Alta linie complet diferita, cu 12 mm" },
  ];

  it("aceeasi fraza cu alt UM e alt grup", () => {
    const g = grupeazaPeSablon(linii);
    expect(g.length).toBe(3);
    expect(g[0]!.reprezentant.index).toBe(1);
    expect(g[0]!.restul.map((l) => l.index)).toEqual([2]);
  });

  it("liniile fara raspuns pentru reprezentant se intorc la model", () => {
    const { proiectate, ramase } = extindePeSablon(grupeazaPeSablon(linii), []);
    expect(proiectate).toEqual([]);
    expect(ramase.map((l) => l.index)).toEqual([2]);
  });

  it("extinde grupul cand reprezentantul a primit raspuns", () => {
    const rep = linie({
      index: 1, sistem: "vata_minerala", diametru_valoare: 89, diametru_tip: "interior",
      grosime_mm: 50, forma: "cot",
    });
    const { proiectate, ramase } = extindePeSablon(grupeazaPeSablon(linii), [rep]);
    expect(ramase).toEqual([]);
    expect(proiectate.map((p) => [p.index, p.diametru_valoare, p.grosime_mm])).toEqual([[2, 60, 40]]);
  });
});

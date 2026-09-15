/**
 * Guardrail-ul de plauzibilitate pe iesirea modelului.
 *
 * Cazurile de aici nu sunt inventate: fiecare vine dintr-un fisier real din
 * `../attachments/` sau dintr-o greseala masurata a modelului. Un validator
 * care se aprinde pe linii corecte e mai rau decat niciunul — omul inceteaza
 * sa-l mai citeasca — deci jumatate din teste verifica exact ca TACE.
 */
import { describe, it, expect } from "vitest";
import { valideazaExtragere, aplicaValidarea, diametruContrazisDeText } from "../src/import/valideaza.js";
import type { LinieExtrasa } from "../src/import/schema.js";

const linie = (p: Partial<LinieExtrasa> = {}): LinieExtrasa => ({
  index: 0, sistem: null, diametru_valoare: null, diametru_tip: null,
  grosime_mm: null, forma: null, gol_latime_mm: null, gol_inaltime_mm: null,
  straturi_extra: [], incredere: 0.95, motiv: "test", ...p,
});

const coduri = (l: LinieExtrasa, text: string, um?: string): string[] =>
  valideazaExtragere(l, um === undefined ? { text } : { text, um }).map((a) => a.cod);

describe("DN citit, dar pe rând scrie alt Ø", () => {
  const dn = (v: number) => linie({ sistem: "elastomer", diametru_valoare: v, diametru_tip: "DN", grosime_mm: 9 });

  it("se aprinde când Ø-ul nu e DN-ul în tabelul de conversie", () => {
    // NISAL, rândul 44: oferta semnată a luat Ø20, nu DN20 (ø26,9).
    const av = diametruContrazisDeText(dn(20), "Kautschuk, d=9mm, DN20 | Dimensiuni: Ø20mm");
    expect(av.map((a) => a.cod)).toEqual(["diametru_contrazis"]);
    expect(av[0]!.mesaj).toContain("ISO 26.9");
  });

  it.each([
    ["Dn 80 (Ø88,9 x 4 - 3'')", 80],
    ["Izolatie Armaflex 13 mm Ф 57 x 3,5 mm (Dn 2\")", 50],
    ["Armaflex DN100, fara niciun diametru scris", 100],
    ["Armaflex Ø1/2\" (Dn 15mm)", 15],
  ])("tace pe %s", (text, v) => {
    expect(diametruContrazisDeText(dn(v), text)).toEqual([]);
  });
});

describe("numere inventate", () => {
  it("prinde diametrul care nu apare in text", () => {
    // Cazul real: gpt-4.1-mini a citit "Di60" ca 76 pe cerere-de-oferta-transavia-inox.xlsx.
    // Un rand gresit in matrice inseamna alt pret, iar modelul raporteaza 0,95
    // incredere pe el. Fara verificarea asta, nimic nu se aprinde.
    const l = linie({ sistem: "elastomer", diametru_valoare: 76, diametru_tip: "interior", grosime_mm: 19 });
    expect(coduri(l, "Izolatie elastomer Di60, g19 - COT")).toContain("diametru_necitat");
  });

  it("prinde grosimea care nu apare in text", () => {
    const l = linie({ sistem: "elastomer", diametru_valoare: 89, diametru_tip: "exterior", grosime_mm: 13 });
    expect(coduri(l, "Izolatie elastomer ø89")).toContain("grosime_necitata");
  });

  it("prinde grosimea inventata pe un strat suplimentar", () => {
    const l = linie({
      sistem: "elastomer", diametru_valoare: 89, diametru_tip: "exterior", grosime_mm: 13,
      straturi_extra: [{ sistem: "vata_minerala", grosime_mm: 40 }],
    });
    expect(coduri(l, "ø89 elastomer 13mm + vata minerala")).toContain("grosime_necitata");
  });

  it("prinde dimensiunea de gol care nu apare in text", () => {
    const l = linie({ sistem: "goluri_foc", gol_latime_mm: 200, gol_inaltime_mm: 200 });
    expect(coduri(l, "Teava OL/OLZN DN15 | 130/130")).toContain("gol_necitat");
  });
});

describe("conversii legitime: validatorul tace", () => {
  it("tolii sunt o citare corecta a DN-ului", () => {
    // "Dn 2''" nu contine cifra 50 nicaieri, dar DN50 e citirea corecta.
    const l = linie({ sistem: "elastomer", diametru_valoare: 50, diametru_tip: "DN", grosime_mm: 13 });
    expect(coduri(l, 'Izolatie elastomer 13 mm pe teava 2" apa rece')).toEqual([]);
  });

  it("diametrul exterior ISO din text e o citare corecta a DN-ului", () => {
    const l = linie({ sistem: "elastomer", diametru_valoare: 80, diametru_tip: "DN", grosime_mm: 13 });
    expect(coduri(l, "Kaelteisolierung 13mm, Rohr 88,9 x 4")).toEqual([]);
  });

  it("virgula zecimala din fisierele romanesti se citeste ca punct", () => {
    const l = linie({ sistem: "elastomer", diametru_valoare: 60.3, diametru_tip: "exterior", grosime_mm: 19 });
    expect(coduri(l, "Teava 60,3x3,6 izolata cu elastomer 19 mm")).toEqual([]);
  });

  it("nu confunda 130/130 cu tolii", () => {
    // Fara ghilimea, "1/2" din "130/130" nu are voie sa devina DN15.
    const l = linie({ sistem: "goluri_foc", gol_latime_mm: 130, gol_inaltime_mm: 130 });
    expect(coduri(l, "Teava OL/OLZN DN15 | 130/130")).toEqual([]);
  });
});

describe("imposibil, nu doar necitat", () => {
  it("prinde DN-ul care nu exista in tabelul de conversie", () => {
    const l = linie({ sistem: "elastomer", diametru_valoare: 45, diametru_tip: "DN", grosime_mm: 13 });
    expect(coduri(l, "izolatie elastomer 13 mm pe DN45")).toContain("dn_necunoscut");
  });

  it("prinde grosimea pe care sistemul ala nu o are in lista", () => {
    // 40 mm exista la vata minerala si nu exista la elastomer. Numarul e citat,
    // deci prima verificare tace; asta e a doua plasa.
    const l = linie({ sistem: "elastomer", diametru_valoare: 89, diametru_tip: "exterior", grosime_mm: 40 });
    const c = coduri(l, "elastomer 40 mm pe ø89");
    expect(c).toContain("grosime_in_afara_listei");
    expect(c).not.toContain("grosime_necitata");
  });

  it("prinde forma care contrazice unitatea de masura de pe rand", () => {
    const l = linie({ sistem: "elastomer", diametru_valoare: 89, diametru_tip: "exterior", grosime_mm: 13, forma: "ml" });
    expect(coduri(l, "Cot izolat ø89, elastomer 13 mm", "buc")).toContain("forma_contrazice_um");
  });

  it("nu se aprinde cand forma se potriveste cu UM", () => {
    const l = linie({ sistem: "elastomer", diametru_valoare: 89, diametru_tip: "exterior", grosime_mm: 13, forma: "cot" });
    expect(coduri(l, "Cot izolat ø89, elastomer 13 mm", "buc")).toEqual([]);
  });
});

describe("aplicaValidarea", () => {
  const sursa = new Map([[0, { text: "Izolatie elastomer Di60, g19 - COT" }]]);

  it("anuleaza increderea raportata de model pe linia suspecta", () => {
    const l = linie({ sistem: "elastomer", diametru_valoare: 76, diametru_tip: "interior", grosime_mm: 19, incredere: 0.95 });
    const [rezultat] = aplicaValidarea([l], sursa);
    expect(rezultat!.incredere).toBe(0);
    expect(rezultat!.motiv).toContain("NEVERIFICAT");
  });

  it("nu atinge liniile curate", () => {
    const l = linie({ sistem: "elastomer", diametru_valoare: 60, diametru_tip: "interior", grosime_mm: 19, incredere: 0.95 });
    expect(aplicaValidarea([l], sursa)[0]).toBe(l);
  });

  it("nu modifica nimic pe o linie fara sursa cunoscuta", () => {
    const l = linie({ index: 99, diametru_valoare: 12345 });
    expect(aplicaValidarea([l], sursa)[0]).toBe(l);
  });
});

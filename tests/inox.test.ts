/**
 * Tabla de inox ca sistem de prima clasa.
 *
 * Sursa problemei: `cerere-de-oferta-transavia-inox.xlsx` are 72 de randuri "tabla de inox
 * 304", dar promptul din extract-llm.ts mapa explicit inoxul pe sistemul
 * "tabla", care e lista de ALUMINIU. Cele 39 de pozitii tarifate din el
 * (6.039,90 EUR) au iesit pe lista gresita — la ø90 inoxul e 30,89 EUR
 * (0,4 mm) fata de 17,08 EUR (aluminiu 0,6 mm). Vezi .claude/stare.md.
 *
 * Inoxul e SINGURUL sistem fara lista rezidentiala (intrebarea 15): a venit
 * doar pe industrial, deci `SistemRezidential` il exclude si pretul lui vine
 * mereu din lista industriala, indiferent de restul pozitiei.
 */
import { describe, it, expect } from "vitest";
import { lista, diametre, listaDe } from "../src/pricing/lists.js";
import { tarifeaza } from "../src/pricing/engine.js";
import { extrageDeterminist } from "../src/import/extract-regex.js";
import { valideazaExtragere } from "../src/import/valideaza.js";
import { tarifeazaExtras } from "../src/import/nucleu.js";
import type { LinieExtrasa } from "../src/import/schema.js";
import type { RezultatGolFoc, RezultatTarifare } from "../src/pricing/types.js";

describe("lista de inox", () => {
  it("are 192 de celule si grosimile 0,4 / 0,5 / 0,6 mm", () => {
    const l = lista("tabla_inox");
    expect(Object.keys(l.cells).length).toBe(192);
    expect(l.grosimi_mm).toEqual([0.4, 0.5, 0.6]);
  });

  it("e industriala, nu rezidentiala: pe rezidential cade pe lista industriala si o spune", () => {
    expect(listaDe("tabla_inox", "rezidential").folosita).toBe("industrial");
    expect(listaDe("tabla", "rezidential").folosita).toBe("rezidential");
  });

  it("ø80–ø710 din 10 in 10", () => {
    const d = diametre("tabla_inox");
    expect(d[0]).toBe(80);
    expect(d.at(-1)).toBe(710);
    expect(d.length).toBe(64);
  });
});

describe("tarifare: inoxul e mai scump decat aluminiul la aceeasi pozitie", () => {
  it("vata_minerala + tabla_inox da alt pret (mai mare) decat vata_minerala + tabla", () => {
    // Aceeasi pozitie compusa (vata 20 mm pe ø60 exterior, geometric 100 dupa
    // stratul de vata) tarifata cu jacheta de aluminiu 0,6 mm si cu jacheta de
    // inox 0,4 mm. Valorile de mai jos sunt calculate din JSON, nu inventate:
    //   data/price-lists/vata_minerala.json:            "60|20" = 6.676192
    //   data/price-lists/tabla.json:                    "100|0.6" = 17.434
    //   data/price-lists/industrial/tabla_inox.json:    "100|0.4" = 32.256053
    const cuAluminiu = tarifeaza({
      diametru: { valoare: 60, tip: "exterior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: 20 }, { sistem: "tabla", grosime_mm: 0.6 }],
      forma: "ml", cantitate: 1,
    });
    const cuInox = tarifeaza({
      diametru: { valoare: 60, tip: "exterior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: 20 }, { sistem: "tabla_inox", grosime_mm: 0.4 }],
      forma: "ml", cantitate: 1,
    });

    // Ambele straturi de jacheta cad pe acelasi rand din lista (100), deci
    // diferenta de pret vine STRICT din lista folosita, nu din rotunjire.
    expect(cuAluminiu.straturi[1]!.rand_lista).toBe(100);
    expect(cuInox.straturi[1]!.rand_lista).toBe(100);

    expect(cuAluminiu.straturi[1]!.pret_unitar).toBe(17.43);
    expect(cuInox.straturi[1]!.pret_unitar).toBe(32.26);
    expect(cuInox.pret_unitar).toBeGreaterThan(cuAluminiu.pret_unitar);
    expect(cuInox.pret_unitar).toBe(38.94);
    expect(cuAluminiu.pret_unitar).toBe(24.11);
  });
});

describe("extragere determinista: inoxul nu fura sistemul principal", () => {
  it("linia compusa din Izolatii Transavia da sistem vata_minerala, nu tabla_inox", () => {
    // Text real din fisier: sistemul PRINCIPAL e vata minerala, inoxul e doar
    // stratul de protectie. Stratul determinist nu construieste straturi_extra
    // azi — verificarea e doar ca nu clasifica gresit linia ca tabla_inox.
    const r = extrageDeterminist(
      0, "IZOLATII | Izolatii cu vata minerala si protectie cu tabla de inox 304 Di60, g48 - COT", "buc",
    );
    expect(r.linie.sistem).toBe("vata_minerala");
  });

  it("o linie DOAR de jachetare cu inox da sistem tabla_inox", () => {
    const r = extrageDeterminist(1, "Protectie cu tabla de inox 304, Di90, g0,4 - ML", "ml");
    expect(r.linie.sistem).toBe("tabla_inox");
  });
});

describe("validare: grosimea in afara listei de inox", () => {
  it("marcheaza grosime_in_afara_listei pentru tabla_inox la 0,8 mm", () => {
    const linie: LinieExtrasa = {
      index: 0, sistem: "tabla_inox", diametru_valoare: 90, diametru_tip: "exterior",
      grosime_mm: 0.8, forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null,
      straturi_extra: [], incredere: 0.9, motiv: "test",
    };
    const av = valideazaExtragere(linie, { text: "tabla de inox 304 ø90, 0,8 mm" });
    expect(av.map((a) => a.cod)).toContain("grosime_in_afara_listei");
  });
});

describe("nota de destinatie mixta", () => {
  /** RezultatGolFoc n-are `note`; helper-ul evita cast-uri repetate in teste. */
  const noteDePe = (pret: RezultatTarifare | RezultatGolFoc | undefined): string[] | undefined =>
    pret && "note" in pret ? pret.note : undefined;

  it("o pozitie cu inox poarta nota ca pretul vine din lista industriala", () => {
    const extras: LinieExtrasa = {
      index: 0, sistem: "tabla_inox", diametru_valoare: 90, diametru_tip: "exterior",
      grosime_mm: 0.4, forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null,
      straturi_extra: [], incredere: 0.9, motiv: "test",
    };
    const { pret } = tarifeazaExtras(extras, 10);
    const note = noteDePe(pret);
    expect(note).toBeDefined();
    expect(note?.[0]?.toLowerCase()).toContain("industriala");
  });

  it("pe rezidential, inoxul NU trimite pozitia la verificat: e singura lista de inox a firmei", () => {
    // Firma n-are lista rezidentiala de inox, nu una „lipsa”: a raspuns pe
    // 5 octombrie la grosimea celor 72 de pozitii Transavia inox (0,4), deci
    // le ofera din lista asta. Nota ramane, ca proveniena sa se vada.
    const r = tarifeaza({
      diametru: { valoare: 89, tip: "exterior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: 50 }, { sistem: "tabla_inox" }],
      forma: "ml", cantitate: 1,
    });
    expect(r.motiveDeVerificat ?? []).not.toContain("segment_diferit");
    expect(r.note?.join(" ").toLowerCase()).toContain("industriala");
  });

  it("PVC pe industrial ramane de verificat: acolo lista firmei lipseste (plan, decizia PVC)", () => {
    const r = tarifeaza({
      diametru: { valoare: 89, tip: "exterior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: 50 }, { sistem: "pvc" }],
      forma: "ml", cantitate: 1, destinatie: "industrial",
    });
    expect(r.motiveDeVerificat).toContain("segment_diferit");
  });

  it("o pozitie fara inox NU poarta nota", () => {
    const extras: LinieExtrasa = {
      index: 0, sistem: "tabla", diametru_valoare: 100, diametru_tip: "exterior",
      grosime_mm: 0.6, forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null,
      straturi_extra: [], incredere: 0.9, motiv: "test",
    };
    const { pret } = tarifeazaExtras(extras, 1);
    expect(noteDePe(pret)).toBeUndefined();
  });
});

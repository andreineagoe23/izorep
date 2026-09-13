/**
 * Suita de referinta pentru inchiderile goluri la foc.
 *
 * Sursa: Oferta 118.1 / 27.04.2026, beneficiar NISAL SRL, obiectiv
 * XXXLutz+Momax Balotesti, emitent R&F ISORAD SYSTEM SRL. Fixture:
 * tests/fixtures-oferta-118-1.json — 53 de pozitii cu pretul exact care a
 * fost ofertat, plus totalul semnat de 12.692,04 EUR.
 *
 * Preturile de lista vin din "pret-rezidential-goluri-foc.xlsx".
 * Daca un test de aici pica, motorul nu mai reproduce oferta si NU se poate
 * emite cu el.
 */
import { describe, it, expect } from "vitest";
import {
  pretBandaWrap, pretColier, pretGol,
  suprafataAfisata, suprafataGol, tarifeazaGolFoc,
} from "../src/pricing/goluri-foc.js";
import { tarifeaza } from "../src/pricing/engine.js";
import { extrageDeterminist } from "../src/import/extract-regex.js";
import { esteAntetSectiune } from "../src/import/sectiuni.js";
import { listaGoluriFoc } from "../src/pricing/lists.js";
import { PozitieNetarifata } from "../src/pricing/types.js";
import fixture from "./fixtures-oferta-118-1.json" with { type: "json" };

interface Pozitie {
  nr: number;
  clasa: string;
  denumire: string;
  cant: number;
  gol: { latime_mm: number; inaltime_mm: number };
  suprafata_afisata: number;
  pu: number;
}
const POZITII = fixture as Pozitie[];

describe("suprafata golului", () => {
  it("se calculeaza din dimensiunile golului, in mp", () => {
    expect(suprafataGol({ latime_mm: 130, inaltime_mm: 130 })).toBeCloseTo(0.0169, 6);
    expect(suprafataGol({ latime_mm: 1400, inaltime_mm: 600 })).toBeCloseTo(0.84, 6);
  });

  it("respinge dimensiuni nule sau negative", () => {
    expect(() => suprafataGol({ latime_mm: 0, inaltime_mm: 130 })).toThrow(PozitieNetarifata);
    expect(() => suprafataGol({ latime_mm: 130, inaltime_mm: -5 })).toThrow(PozitieNetarifata);
  });

  it("coloana din oferta rotunjeste IN SUS, nu la cel mai apropiat", () => {
    // 150/150 = 0,0225 -> firma scrie 0,03, nu 0,02.
    expect(suprafataAfisata(0.0225)).toBe(0.03);
    // 320/320 = 0,1024 -> firma scrie 0,11, nu 0,10.
    expect(suprafataAfisata(0.1024)).toBe(0.11);
    // Valorile exacte raman neatinse.
    expect(suprafataAfisata(0.09)).toBe(0.09);
    expect(suprafataAfisata(0.6)).toBe(0.6);
  });
});

describe("pragurile de suprafata", () => {
  it("limita superioara e inclusiva", () => {
    // Dovada din oferta: 1000/600 = 0,60 mp exact -> pragul "pana la 0,60".
    expect(pretGol(0.6)).toBe(53.78);
    // 1500/600 = 0,90 mp exact -> pragul "pana la 0,90".
    expect(pretGol(0.9)).toBe(84.51);
    // Cu un fir peste, se urca pragul.
    expect(pretGol(0.6001)).toBe(63.38);
  });

  it("peste 1 mp trece la tarif pe mp", () => {
    expect(pretGol(1.0)).toBe(105.62);
    expect(pretGol(1.5)).toBe(201.65);   // 1,5 x 134,43
  });

  it("acopera toate cele 11 praguri din lista", () => {
    expect(listaGoluriFoc().praguri_suprafata).toHaveLength(11);
  });
});

describe("banda WRAP", () => {
  /**
   * Cel mai important test din fisier. Lista are DOUA tabele de banda, iar
   * varianta anterioara a extragerii le amesteca: pastra tot tabelul de
   * plastic si doar primul rand din cel de otel. La ø140 diferenta e de 5x.
   */
  it("are pret diferit pe otel fata de plastic, la acelasi diametru", () => {
    expect(pretBandaWrap(140, "otel")).toBe(12.19);
    expect(pretBandaWrap(140, "plastic")).toBe(65.67);
  });

  it("acopera ambele tabele intregi", () => {
    const w = listaGoluriFoc().banda_wrap;
    expect(w.plastic.map((x) => x.diametru)).toEqual([32, 40, 50, 56, 63, 75, 90, 110, 125, 140, 160]);
    expect(w.otel.map((x) => x.diametru)).toEqual([22, 28, 35, 42, 48, 60, 64, 76, 89, 114, 140, 168]);
  });

  it("nu interpoleaza intre diametre: numarul de infasurari sare in trepte", () => {
    expect(() => pretBandaWrap(100, "plastic")).toThrow(PozitieNetarifata);
    // ø32 e in tabelul de plastic, dar nu si in cel de otel.
    expect(() => pretBandaWrap(32, "otel")).toThrow(PozitieNetarifata);
  });
});

describe("colier PROMASTOP UNICOLLAR", () => {
  it("la traversare orizontala se pun 2 coliere, deci pret dublu", () => {
    expect(pretColier(110, "urcare")).toBe(41);
    expect(pretColier(110, "orizontal")).toBe(82);
  });

  it("nu e ofertat la orice diametru", () => {
    expect(() => pretColier(100, "urcare")).toThrow(PozitieNetarifata);
  });
});

describe("pretul e aditiv: gol + banda + colier", () => {
  it("golul singur", () => {
    const r = tarifeazaGolFoc({ gol: { latime_mm: 320, inaltime_mm: 320 }, cantitate: 1 });
    expect(r.pret_unitar).toBe(30.36);
    expect(r.componente).toHaveLength(1);
  });

  it("gol + banda WRAP pe conducta de plastic", () => {
    const r = tarifeazaGolFoc({
      gol: { latime_mm: 320, inaltime_mm: 320 },
      diametru_conducta: 110, material_conducta: "plastic",
      banda_wrap: true, cantitate: 1,
    });
    expect(r.pret_unitar).toBe(72.68);   // 30,36 + 42,32
    expect(r.componente.map((c) => c.tip)).toEqual(["gol", "banda_wrap"]);
  });

  it("gol + banda + colier, traversare orizontala", () => {
    const r = tarifeazaGolFoc({
      gol: { latime_mm: 320, inaltime_mm: 320 },
      diametru_conducta: 110, material_conducta: "plastic",
      banda_wrap: true, colier: "orizontal", cantitate: 2,
    });
    expect(r.pret_unitar).toBe(154.68);  // 30,36 + 42,32 + 82
    expect(r.total).toBe(309.36);
  });

  it("banda fara materialul conductei nu se ghiceste", () => {
    expect(() => tarifeazaGolFoc({
      gol: { latime_mm: 320, inaltime_mm: 320 },
      diametru_conducta: 140, banda_wrap: true, cantitate: 1,
    })).toThrow(PozitieNetarifata);
  });

  it("banda fara diametrul conductei nu se ghiceste", () => {
    expect(() => tarifeazaGolFoc({
      gol: { latime_mm: 320, inaltime_mm: 320 },
      material_conducta: "otel", banda_wrap: true, cantitate: 1,
    })).toThrow(PozitieNetarifata);
  });

  it("clasa EI e eticheta de grupare, nu variabila de pret", () => {
    // In oferta, aceeasi conducta DN15 pe gol 130/130 costa 23,05 si la
    // EI30, si la EI120. Clasa se pastreaza pentru gruparea din document.
    const gol = { latime_mm: 130, inaltime_mm: 130 };
    const ei30 = tarifeazaGolFoc({ gol, clasa_foc: "EI30", cantitate: 1 });
    const ei120 = tarifeazaGolFoc({ gol, clasa_foc: "EI120", cantitate: 1 });
    expect(ei30.pret_unitar).toBe(ei120.pret_unitar);
    expect(ei30.clasa_foc).toBe("EI30");
  });
});

describe("oferta 118.1 / 27.04.2026 se reproduce la banut", () => {
  it.each(POZITII.map((p) => [p.nr, p.clasa, p.denumire, p] as const))(
    "poz. %i %s — %s",
    (_nr, _clasa, _den, p) => {
      const r = tarifeazaGolFoc({
        gol: p.gol, clasa_foc: p.clasa, cantitate: p.cant,
      });
      expect(r.pret_unitar).toBe(p.pu);
      expect(r.total).toBe(Math.round(p.pu * p.cant * 100) / 100);
    },
  );

  it("suprafata afisata coincide cu coloana din oferta, in 52 din 53 de pozitii", () => {
    const abateri = POZITII.filter(
      (p) => suprafataAfisata(suprafataGol(p.gol)) !== p.suprafata_afisata,
    );
    expect(abateri.map((p) => p.nr)).toEqual([47]);
  });

  it("totalul ofertei", () => {
    const total = POZITII.reduce(
      (s, p) => s + tarifeazaGolFoc({ gol: p.gol, cantitate: p.cant }).total, 0,
    );
    expect(Math.round(total * 100) / 100).toBe(12692.04);
  });
});

describe("granita fata de motorul de matrice", () => {
  it("tarifeaza() refuza goluri_foc si spune ce sa folosesti", () => {
    expect(() => tarifeaza({
      diametru: { valoare: 100, tip: "exterior" },
      straturi: [{ sistem: "goluri_foc" }],
      forma: "ml", cantitate: 1,
    })).toThrow(/tarifeazaGolFoc/);
  });
});

describe("abateri cunoscute fata de oferta 118.1", () => {
  /**
   * Ca in tests/pricing.test.ts: aici motorul da INTENTIONAT alt rezultat
   * decat oferta, pentru ca oferta a fost completata manual.
   */
  it("poz. 47, gol 520/520: coloana de suprafata e scrisa 0,27, nu 0,28", () => {
    const gol = { latime_mm: 520, inaltime_mm: 520 };
    expect(suprafataGol(gol)).toBeCloseTo(0.2704, 6);
    expect(suprafataAfisata(suprafataGol(gol))).toBe(0.28);   // regula: rotunjire in sus
    const inOferta = 0.27;                                    // scris de mana

    // Nu schimba pretul: ambele cad in pragul "pana la 0,30".
    expect(pretGol(0.28)).toBe(pretGol(inOferta));
    expect(pretGol(0.28)).toBe(34.59);
  });
});

describe("recunoasterea liniilor de inchideri goluri la foc", () => {
  const extrage = (text: string, um?: string, sectiune?: string) =>
    extrageDeterminist(0, text, um, sectiune).linie;

  it("linia isi ia sistemul din antetul sectiunii, cand ea singura tace", () => {
    // Oferta 118.1: linia e doar teava plus dimensiunea golului. Ce e de
    // fapt scrie in antetul de deasupra.
    const fara = extrage("Teava OL/OLZN DN15 | 130/130", "buc");
    expect(fara.sistem).toBeNull();

    const cu = extrage("Teava OL/OLZN DN15 | 130/130", "buc", "Teceri prin pereti rezistenti la foc EI30");
    expect(cu.sistem).toBe("goluri_foc");
    expect(cu.gol_latime_mm).toBe(130);
    expect(cu.gol_inaltime_mm).toBe(130);
  });

  it("sectiunea da doar sistemul, niciodata dimensiunile", () => {
    // Altfel o pozitie ar mosteni golul alteia.
    const l = extrage("Teava OL/OLZN DN25", "buc", "Teceri prin pereti rezistenti la foc EI30");
    expect(l.sistem).toBe("goluri_foc");
    expect(l.gol_latime_mm).toBeNull();
    expect(extrageDeterminist(0, "Teava OL/OLZN DN25", "buc", "Teceri prin pereti rezistenti la foc EI30").complet)
      .toBe(false);
  });

  it("protectia la foc A TUBULATURII nu e inchidere de gol", () => {
    // cerere-de-oferta-spital.xlsx: 28 de randuri de felul asta. Sunt alta lucrare, fara
    // lista de preturi, iar dimensiunea tubulaturii rectangulare ("1000/500")
    // nu e dimensiune de gol. Cu "EI 60" ca semnal, intrau toate ca goluri.
    for (const text of [
      "Protectie la foc EI 60 pentru tubulaturile din tabla zincata | 1000/500",
      "Tubulatura rectangulara de admisie aer verticala care strabate peretele | 800/500",
    ]) {
      expect(extrage(text, "mp").sistem).not.toBe("goluri_foc");
    }
  });

  it("tolii nu sunt dimensiuni de gol", () => {
    const l = extrage('Teava OL 1/2" | inchideri goluri la foc', "buc");
    expect(l.sistem).toBe("goluri_foc");
    expect(l.gol_latime_mm).toBeNull();
  });
});

describe("antetul de sectiune se recunoaste fizic, nu semantic", () => {
  const rand = (celule: (string | number | null)[], extra: object = {}) => ({
    index: 0, foaie: "F", rand: 1, text: "x", celule, ...extra,
  });

  it("celula imbinata, fara UM si fara cantitate, e antet", () => {
    const t = "Teceri prin pereti rezistenti la foc EI30";
    expect(esteAntetSectiune(rand([t, t, t, t]))).toBe(true);
  });

  it("randul cu cantitate sau UM e pozitie, nu antet", () => {
    const t = "Teava OL/OLZN DN15";
    expect(esteAntetSectiune(rand([t, t], { um: "buc" }))).toBe(false);
    expect(esteAntetSectiune(rand([t, t], { cantitate: 6 }))).toBe(false);
  });

  it("randul cu texte diferite pe coloane e pozitie", () => {
    expect(esteAntetSectiune(rand(["Teava OL/OLZN DN15", "130/130"]))).toBe(false);
  });
});

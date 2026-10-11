/**
 * Ce nu are voie sa se strice pe ecrane, oricum s-ar schimba aspectul.
 *
 * Aspectul, textele si butoanele se verifica in browser: se schimba des cat
 * aplicatia nu e gata, iar un test pe fiecare eticheta doar ingheata marcajul.
 * Aici raman doua reguli: textul venit din fisierele clientilor sau din poze nu
 * poate injecta HTML, iar o pagina de santier nu ajunge in oferta nevazuta.
 */
import { describe, expect, it } from "vitest";
import type { LinieProcesata } from "../src/import/nucleu.js";
import type { RandSantier } from "../src/santier/agrega.js";
import { cardPozitie } from "../web/import/vizual.js";
import { pozitieOferta } from "../web/import/oferta-vizual.js";
import { documentOferta } from "../web/document-oferta.js";
import { cardPagina, cardTrimite, poateFiVerificata, type PaginaSantier } from "../web/santier-vizual.js";

const INJECTIE = `<img src=x onerror="alert(1)">`;

const rand = (p: Partial<RandSantier> = {}): RandSantier => ({
  id: "r1", zona: "A) Zona 1", diametru_valoare: 60, diametru_tip: "exterior", izolatie: "vata_minerala", grosime_mm: 50,
  jacheta: "aluminiu", element: "ml", pret_dublu: false, cantitate: 34, termeni: [], nesigur: false, ...p,
});
const pagina = (p: Partial<PaginaSantier> = {}): PaginaSantier => ({
  id: "p1", nume: "santier1.jpeg", url: "blob:x", stare: "gata", eroare: "", randuri: [rand()], note: [],
  verificata: false, faraModel: false, ...p,
});

describe("textul venit din afara nu injecteaza HTML", () => {
  it("descrierea clientului, in cardul pozitiei de la import", () => {
    const linie = {
      bruta: { index: 4, foaie: "Foaia 1", rand: 12, text: `${INJECTIE} Izolatie`, um: "ml", cantitate: 6, celule: [] },
      extras: {
        index: 4, sistem: "vata_minerala", diametru_valoare: 100, diametru_tip: "DN", grosime_mm: 50, forma: "ml",
        gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [], incredere: 0.99, motiv: "",
      },
      sursa: "regex", necesitaValidare: false,
    } as LinieProcesata;
    const html = cardPozitie(linie, { propunere: null, editeaza: false, cuFoaie: true });
    expect(html).not.toContain(INJECTIE);
  });

  it("codul, textul și foaia clientului, în poziția ofertei", () => {
    const linie = {
      bruta: { index: 4, foaie: INJECTIE, rand: 12, text: `${INJECTIE} | Izolatie vata DN100`, um: "ml", cantitate: 6, celule: ["E3.1.<b>"] },
      extras: {
        index: 4, sistem: "vata_minerala", diametru_valoare: 100, diametru_tip: "DN", grosime_mm: 50, forma: "ml",
        gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [], incredere: 0.99, motiv: "",
      },
      sursa: "regex", necesitaValidare: false,
    } as LinieProcesata;
    const doc = documentOferta({
      linii: [linie],
      antet: { serie: "RAD", numar: "1", data: "", persoana: "", client: "", obiectiv: "", firma: "", localitate: "" },
      provenienta: { generatLa: "", destinatie: "rezidential", model: null, sesiune: "", fisierSursa: "" },
    });
    const html = pozitieOferta(doc.capitole[0]!.pozitii[0]!, { linie, propunere: null, editeaza: false, cuFoaie: true });
    expect(html).toContain("Izolatie vata DN100");
    expect(html).not.toContain(INJECTIE);
  });

  it("zona si notele citite din poza, pe pagina de santier", () => {
    const html = cardPagina(pagina({ randuri: [rand({ zona: INJECTIE })], note: [INJECTIE] }), 1,
      { editeaza: null, destinatie: "rezidential" });
    // Pagina are un <img> legitim, poza; cel injectat nu trebuie sa apara.
    expect(html).not.toContain(INJECTIE);
  });
});

describe("pagina de santier ajunge in oferta doar verificata", () => {
  it("un rand nesigur sau incomplet opreste „Am verificat pagina”", () => {
    for (const r of [rand({ nesigur: true }), rand({ diametru_valoare: null }), rand({ cantitate: 0 }),
      rand({ izolatie: null, jacheta: null })]) {
      expect(poateFiVerificata(pagina({ randuri: [r] }))).toBe(false);
    }
    expect(poateFiVerificata(pagina({ randuri: [] }))).toBe(false);
    expect(poateFiVerificata(pagina())).toBe(true);
  });

  it("„Trimite la ofertă” e oprit cat mai e o pagina neverificata", () => {
    expect(cardTrimite({ pagini: [pagina()], titlu: "" })).toMatch(/type="submit"[^>]*disabled/);
    expect(cardTrimite({ pagini: [pagina({ verificata: true })], titlu: "" })).not.toMatch(/type="submit"[^>]*disabled/);
  });

  it("„Pune în situație” cere pagini verificate și un șantier ales; numele șantierului nu injectează HTML", () => {
    const santier = { id: "S-1", denumire: "<img src=x>", client: "" };
    const gata = pagina({ verificata: true });
    expect(cardTrimite({ pagini: [gata], titlu: "", scop: "situatie", santier: null })).toMatch(/type="submit"[^>]*disabled/);
    expect(cardTrimite({ pagini: [pagina()], titlu: "", scop: "situatie", santier })).toMatch(/type="submit"[^>]*disabled/);
    const html = cardTrimite({ pagini: [gata], titlu: "", scop: "situatie", santier });
    expect(html).not.toMatch(/type="submit"[^>]*disabled/);
    expect(html).not.toContain("<img");
  });
});

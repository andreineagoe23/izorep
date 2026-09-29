/**
 * Marcajul ecranului „Șantier" (`web/santier-vizual.ts`), in Node.
 *
 * Aspectul se verifica in browser. Aici: textul venit din poza nu poate
 * injecta HTML, iar o pagina nu poate fi marcata verificata cat are randuri pe
 * care omul nu le-a vazut sau care n-au ce le trebuie ca sa aiba pret.
 */
import { describe, expect, it } from "vitest";
import type { RandSantier } from "../src/santier/agrega.js";
import {
  cardIncarca, cardPagina, cardTrimite, deVerificat, lipsa, poateFiVerificata, straturi, type PaginaSantier,
} from "../web/santier-vizual.js";

const rand = (p: Partial<RandSantier> = {}): RandSantier => ({
  id: "r1", zona: "A) Zona 1", diametru_valoare: 60, diametru_tip: "exterior", izolatie: "vata_minerala", grosime_mm: 50,
  jacheta: "aluminiu", element: "ml", pret_dublu: false, cantitate: 34,
  termeni: [{ text: "14 ml", cantitate: 14, multiplicator: 1, nesigur: false }, { text: "20 ml", cantitate: 20, multiplicator: 1, nesigur: false }],
  nesigur: false, ...p,
});
const pagina = (p: Partial<PaginaSantier> = {}): PaginaSantier => ({
  id: "p1", nume: "santier1.jpeg", url: "blob:x", stare: "gata", eroare: "", randuri: [rand()], note: [],
  verificata: false, faraModel: false, ...p,
});
const o = { editeaza: null, destinatie: "rezidential" as const };

describe("pagina", () => {
  it("arata de unde vine suma si straturile pe intelesul omului", () => {
    const html = cardPagina(pagina(), 1, o);
    expect(html).toContain("14 + 20");
    expect(html).toContain("ø60 · Metri liniari");
    expect(straturi(rand({ izolatie: null, grosime_mm: null }))).toBe("Doar tablă aluminiu");
  });

  it("textul citit din poza nu injecteaza HTML", () => {
    const html = cardPagina(pagina({ randuri: [rand({ zona: "<img src=x onerror=alert(1)>" })], note: ["<b>x</b>"] }), 1, o);
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>x</b>");
  });

  it("un rand nesigur se confirma si opreste verificarea paginii", () => {
    const p = pagina({ randuri: [rand({ nesigur: true })] });
    expect(cardPagina(p, 1, o)).toContain('data-act="confirma"');
    expect(poateFiVerificata(p)).toBe(false);
    expect(cardPagina(p, 1, o)).toMatch(/data-act="verificata"[^>]*disabled/);
  });

  it("un rand fara diametru sau fara cantitate opreste verificarea, chiar scris de mana", () => {
    for (const r of [rand({ diametru_valoare: null }), rand({ cantitate: 0 }), rand({ izolatie: null, jacheta: null })]) {
      expect(lipsa(r)).not.toBeNull();
      expect(deVerificat(pagina({ randuri: [r] }))).toBe(1);
    }
    expect(poateFiVerificata(pagina({ randuri: [] }))).toBe(false);
    expect(poateFiVerificata(pagina())).toBe(true);
  });

  it("nota despre preturi industriale se arata cand oferta e rezidentiala", () => {
    const p = pagina({ note: ["Se vor calcula preturi INDUSTRIALE"] });
    expect(cardPagina(p, 1, o)).toContain("Alege sus „Industrială”");
    expect(cardPagina(p, 1, { ...o, destinatie: "industrial" })).not.toContain("Alege sus");
  });
});

describe("trimiterea", () => {
  it("merge doar cand toate paginile sunt verificate", () => {
    expect(cardTrimite({ pagini: [pagina()], titlu: "" })).toMatch(/type="submit"[^>]*disabled/);
    expect(cardTrimite({ pagini: [pagina({ verificata: true })], titlu: "" })).not.toMatch(/type="submit"[^>]*disabled/);
  });
});

describe("cand citirea nu merge", () => {
  it("pagina cu eroare are „Citește din nou” si „Scriu de mână”", () => {
    const html = cardPagina(pagina({ stare: "eroare", eroare: "Poza nu s-a putut citi.", randuri: [] }), 1, o);
    expect(html).toContain('data-act="reciteste"');
    expect(html).toContain('data-act="de-mana"');
    expect(html).not.toContain('data-act="verificata"');
  });

  it("dupa trimitere, ecranul spune unde a plecat lista", () => {
    expect(cardIncarca({ destinatie: "rezidential", eroare: "", trimisa: "Ecoterm - masuratori santier.xlsx" }))
      .toContain("Ecoterm - masuratori santier.xlsx");
  });
});

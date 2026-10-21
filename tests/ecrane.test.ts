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
import { grilaFoaie } from "../web/import/grila.js";
import { proceseazaRegistru } from "../src/import/nucleu.js";
import { parseFoi } from "../src/import/parse-workbook.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { CLIENTI, cuClienti } from "./conditii.js";
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

describe("importul în formatul ofertei (web/import/oferta-vizual.ts)", async () => {
  const { documentPeEcran, antetDinFisier } = await import("../web/import/oferta-vizual.js");
  const { documentOferta } = await import("../web/document-oferta.js");
  const linie = (index: number, text: string, cod: string | null, pret: number | null, necesitaValidare = false): LinieProcesata => ({
    bruta: { index, foaie: "Foaia 1", rand: 10 + index, text: cod ? `${cod} | ${text}` : text, um: "ml", cantitate: 10, celule: cod ? [cod, text] : [text] },
    extras: {
      index, sistem: "elastomer", diametru_valoare: 50, diametru_tip: "DN", grosime_mm: 13, forma: "ml",
      gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [], incredere: 0.99, motiv: "",
    },
    sursa: "regex", necesitaValidare,
    ...(pret === null ? { codEroare: "fara_diametru" as const } : { pret: { pret_unitar: pret, cantitate: 10, total: pret * 10 } as LinieProcesata["pret"] }),
  }) as LinieProcesata;
  const cerere = (linii: LinieProcesata[]) => ({
    linii,
    antet: { serie: "RAD", numar: "", data: "14.10.2026", persoana: INJECTIE, client: INJECTIE, obiectiv: "", firma: "RADOIA ISOLIRUNG SRL", localitate: "PALTINIS" },
    provenienta: { generatLa: "", destinatie: "rezidential", model: null, sesiune: "s", fisierSursa: "x.xlsx" },
  });

  it("textul, codul și antetul din fișier nu injectează HTML", () => {
    const linii = [linie(1, `Izolatie elastomer 13 mm DN50 ${INJECTIE}`, "E3.1.1.1", 8.84)];
    const html = documentPeEcran(documentOferta(cerere(linii)), {
      linii: new Map(linii.map((l) => [l.extras.index, l])), vizibile: null, editIdx: null, propunere: () => null, cuFoaie: true,
    });
    expect(html).not.toContain(INJECTIE);
  });

  it("aceeași numerotare și același total ca documentul din care se scrie Excelul", () => {
    const linii = [linie(1, "Izolatie elastomer 13 mm DN50", null, 8.84), linie(2, "Izolatie elastomer DN50", null, null),
      linie(3, "Izolatie elastomer 13 mm DN50", null, 8.84)];
    const d = documentOferta(cerere(linii));
    const html = documentPeEcran(d, {
      linii: new Map(linii.map((l) => [l.extras.index, l])), vizibile: null, editIdx: null, propunere: () => null, cuFoaie: false,
    });
    // Poziția fără preț stă la locul ei, fără număr; a treia e a doua în ofertă.
    expect([...html.matchAll(/class="of-nr"[^>]*>(\d+|<span)/g)].map((m) => m[1])).toEqual(["1", "<span", "2"]);
    expect(html).toContain("176,80 €");
    expect(html).toMatch(/Nu intră încă în ofertă: 0 de verificat și 1 fără preț/);
  });

  it("rândul de continuare iese întreg: descrierea, apoi ce are el în plus (Book15)", () => {
    const l = linie(1, "Same - Ø125 mm | Circular spiro duct, insulated with 30mm mineral wool", null, 10.87);
    const p = documentOferta(cerere([l])).capitole[0]!.pozitii[0]!;
    expect(p.textClient).toBe("Circular spiro duct, insulated with 30mm mineral wool — Ø125 mm");
  });

  it("beneficiarul și obiectivul se citesc din antetul fișierului", () => {
    const celula = (v: string) => ({ v, span: 1 });
    const foaie = {
      nume: "Izolatii", coloane: 4,
      antet: { rand: 4, celule: ["Nr.", "Denumire", "UM", "Cantitate"].map(celula) },
      randuri: [
        { rand: 1, celule: [celula("Lista de cantitati - Hala Chitila")] },
        { rand: 2, celule: [celula("Beneficiar: Construct Nord SRL")] },
        { rand: 3, celule: [celula("Obiectiv"), celula("Hala Logistica Chitila")] },
      ],
    } as unknown as Parameters<typeof antetDinFisier>[0][number];
    expect(antetDinFisier([foaie])).toEqual({ client: "Construct Nord SRL", obiectiv: "Hala Logistica Chitila" });
  });
});

describe("foaia clientului fără rând de antet (21 octombrie 2026)", () => {
  // Cererea TRANSAVIA n-are antet: ecranul scria „# A B D E”. Acum coloanele
  // au numele ofertelor firmei, după ce țin pe poziții.
  cuClienti("cererea TRANSAVIA: Rând, Cod, Denumire, UM, Cantitate, fără litere", async () => {
    const rez = await proceseazaRegistru(await parseFoi(`${CLIENTI}/cerere-de-oferta-transavia-abur.xlsx`),
      { stoc: stocInMemorie(), prag: 0.85 });
    const f = rez.foi[0]!;
    expect(f.antet).toBeUndefined();
    const html = grilaFoaie(f, new Map(rez.linii.map((l) => [l.extras.index, l])),
      { vizibile: null, editIdx: null, propunere: () => null, cuNumeFoaie: false });
    const capete = [...html.matchAll(/<th scope="col"[^>]*>([^<]*)</g)].map((m) => m[1]!.trim());
    expect(capete).toEqual(["Rând", "Cod", "Denumire", "UM", "Cantitate", "Preț Euro (total · unitar)", "Stare"]);
  });
});

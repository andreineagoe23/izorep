/**
 * Bucatile ecranului de import (`web/import/vizual.ts`), in Node.
 *
 * Nu se testeaza aspectul — ala se verifica in browser, pe latimi de ecran.
 * Se testeaza ce nu are voie sa se strice: textul din fisierul clientului nu
 * poate injecta HTML, fiecare stare are exact actiunea care o rezolva, iar
 * pasii la care nu se poate ajunge nu sunt butoane.
 */
import { describe, it, expect } from "vitest";
import type { LinieProcesata } from "../src/import/nucleu.js";
import type { LinieExtrasa } from "../src/import/schema.js";
import { cardPozitie, ecranStart, editorPozitie, numaraMotive, pasi } from "../web/import/vizual.js";
import { antetDocument, grilaFoaie } from "../web/import/grila.js";
import type { FoaieBruta } from "../src/import/parse-workbook.js";

const linie = (p: {
  text?: string; extras?: Partial<LinieExtrasa>; pret?: boolean; validare?: boolean; cod?: "grosime_ambigua";
} = {}): LinieProcesata => ({
  bruta: { index: 4, foaie: "Foaia 1", rand: 12, text: p.text ?? "Izolatie vata DN100", um: "ml", cantitate: 6, celule: [] },
  extras: {
    index: 4, sistem: "vata_minerala", diametru_valoare: 100, diametru_tip: "DN", grosime_mm: 50, forma: "ml",
    gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [], incredere: 0.99, motiv: "", ...p.extras,
  },
  sursa: "regex",
  necesitaValidare: p.validare ?? false,
  ...(p.pret ? { pret: { pret_unitar: 10, cantitate: 6, total: 60 } as NonNullable<LinieProcesata["pret"]> } : {}),
  ...(p.cod ? { codEroare: p.cod } : {}),
});

const actiuni = (html: string): string[] => [...html.matchAll(/data-act="([^"]+)"/g)].map((m) => m[1]!);

describe("cardul unei poziții", () => {
  it("textul clientului nu poate injecta HTML", () => {
    const html = cardPozitie(linie({ text: `<img src=x onerror="alert(1)"> Izolatie`, pret: true }),
      { propunere: null, editeaza: false, cuFoaie: true });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("gata: doar „Modifică”", () => {
    expect(actiuni(cardPozitie(linie({ pret: true }), { propunere: null, editeaza: false, cuFoaie: false })))
      .toEqual(["modifica"]);
  });

  it("de verificat: „Confirmă” înaintea lui „Modifică”", () => {
    expect(actiuni(cardPozitie(linie({ pret: true, validare: true }), { propunere: null, editeaza: false, cuFoaie: false })))
      .toEqual(["confirma", "modifica"]);
  });

  it("fără preț, cu grosime uzuală: butonul pune exact grosimea propusă", () => {
    const html = cardPozitie(linie({ validare: true, cod: "grosime_ambigua", extras: { grosime_mm: null } }),
      { propunere: 100, editeaza: false, cuFoaie: false });
    expect(actiuni(html)).toEqual(["pune-grosime", "modifica"]);
    expect(html).toContain('data-g="100"');
    expect(html).toContain("Lipsește grosimea");
    expect(html).not.toContain("grosime_ambigua<");
  });

  it("numele foii apare doar când registrul are mai multe", () => {
    const l = linie({ pret: true });
    expect(cardPozitie(l, { propunere: null, editeaza: false, cuFoaie: true })).toContain("Foaia 1");
    expect(cardPozitie(l, { propunere: null, editeaza: false, cuFoaie: false })).not.toContain("Foaia 1");
  });
});

describe("corectura", () => {
  it("la țeavă se văd diametrul și grosimea, golul e ascuns", () => {
    const html = editorPozitie(linie({ pret: true }));
    expect(html).toMatch(/class="imp-editor-teava">/);
    expect(html).toMatch(/class="imp-editor-gol" hidden>/);
  });

  it("la închiderea de gol se văd dimensiunile golului", () => {
    const html = editorPozitie(linie({ extras: { sistem: "goluri_foc", gol_latime_mm: 130, gol_inaltime_mm: 130 } }));
    expect(html).toMatch(/class="imp-editor-teava" hidden>/);
    expect(html).toContain('value="130"');
  });
});

describe("pașii și pornirea", () => {
  it("pasul curent e marcat, cei indisponibili nu sunt butoane", () => {
    const html = pasi(1, { 1: true, 2: false, 3: false });
    expect(html).toContain('aria-current="step"');
    expect(html).not.toContain("data-pas");
    expect(pasi(2, { 1: true, 2: true, 3: true })).toContain('data-pas="1"');
  });

  it("istoricul escapează numele fișierului și cere a doua apăsare la ștergere", () => {
    const intrare = { id: "a", nume: "<b>x</b>.xlsx", marime: 1, cand: "2026-09-13T10:00:00.000Z", model: null, pozitii: 3, tarifate: 2, valoare: 10 };
    const html = ecranStart({ destinatie: "rezidential", istoric: [intrare], stergeDe: null, eroare: "" });
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain(">Șterge<");
    expect(ecranStart({ destinatie: "rezidential", istoric: [intrare], stergeDe: "a", eroare: "" })).toContain("Sigur ștergi?");
  });

});

describe("motivele se numără", () => {
  it("descrescător, fiecare poziție la motivul ei", () => {
    const fara = (i: number) => ({ ...linie({ validare: true, cod: "grosime_ambigua" }), extras: { ...linie().extras, index: i } });
    expect(numaraMotive([fara(1), fara(2), linie({ pret: true })])).toEqual([["grosime_ambigua", 2]]);
  });
});

describe("antetul documentului din foaia clientului", () => {
  it("Oferta 284: titlul, liniile de detaliu și perechile etichetă–valoare", () => {
    // Randate ca atare ieșeau șase rânduri lipite unul sub altul.
    const a = antetDocument([
      ["OFERTA LUCRARI IZOLATII TERMICE"],
      ["Nr. 284 / 27.05.2026"],
      ["In atentia d-lui Vlad Emil"],
      ["Beneficiar : Grup Energoinstal SA"],
      ["Obiectiv : TRANSAVIA ALBA-IULIA"],
    ]);
    expect(a.titlu).toBe("OFERTA LUCRARI IZOLATII TERMICE");
    expect(a.linii).toEqual(["Nr. 284 / 27.05.2026", "In atentia d-lui Vlad Emil"]);
    expect(a.date).toEqual([["Beneficiar", "Grup Energoinstal SA"], ["Obiectiv", "TRANSAVIA ALBA-IULIA"]]);
  });

  it("Radoia: două celule pe rând sunt o pereche", () => {
    expect(antetDocument([["Nume proiect", "SPITAL REGINA MARIA"], ["Garantie:", "3 ani"], ["", ""]]).date)
      .toEqual([["Nume proiect", "SPITAL REGINA MARIA"], ["Garantie", "3 ani"]]);
  });

  it("titlul e cea mai lungă linie cu majuscule, nu prima", () => {
    const a = antetDocument([["IZOLATII"], ["OFERTA LUCRARI IZOLATII TERMICE"]]);
    expect(a.titlu).toBe("OFERTA LUCRARI IZOLATII TERMICE");
    expect(a.linii).toEqual(["IZOLATII"]);
  });

  it("fără nicio linie cu majuscule nu se inventează titlu", () => {
    expect(antetDocument([["Lista de cantitati bloc A"]]).titlu).toBeNull();
  });
});

describe("foaia ca în Excel", () => {
  const celula = (v: string | number) => ({ v, span: 1 });
  const foaie = (): FoaieBruta => ({
    nume: "Izolatii", coloane: 3,
    antet: { rand: 3, celule: [celula("Nr"), celula("Denumire"), celula("UM")] },
    randuri: [
      { rand: 1, celule: [{ v: "OFERTA <b>IZOLATII</b> TERMICE", span: 3 }] },
      { rand: 3, celule: [celula("Nr"), celula("Denumire"), celula("UM")] },
      { rand: 4, celule: [celula(1), celula("Izolatie <img src=x>"), celula("ml")],
        linie: { index: 4, foaie: "Izolatii", rand: 4, text: "Izolatie", celule: [] } },
      { rand: 5, celule: [{ v: "Capitol 2", span: 3 }] },
    ],
  });
  const harta = new Map([[4, linie({ pret: true, validare: true })]]);
  const opt = { editIdx: null, propunere: () => null, cuNumeFoaie: false };

  it("fără filtru: tot fișierul, antetul ca document, textul escapat", () => {
    const html = grilaFoaie(foaie(), harta, { ...opt, vizibile: null });
    expect(html).toContain('class="imp-doc-titlu"');
    expect(html).toContain(">5<");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>IZOLATII");
    expect(html).toContain('data-act="confirma"');
  });

  it("sub filtru rămân doar pozițiile vizibile, cu numărul lor din Excel", () => {
    const html = grilaFoaie(foaie(), harta, { ...opt, vizibile: new Set([4]) });
    expect(html).toContain('<td class="gutter">4</td>');
    expect(html).not.toContain('<td class="gutter">5</td>');
  });

  it("o foaie fără niciun rând sub filtru nu apare deloc", () => {
    expect(grilaFoaie(foaie(), harta, { ...opt, vizibile: new Set() })).toBe("");
  });

  it("coloana lată e cea cu descrieri la majoritatea pozițiilor, nu cea cu o notă lungă", () => {
    // Decis pe o singură celulă, un rând de total sau o notă de subsol lățea
    // coloane care altfel țin „IZOLATII" sau „buc".
    const lung = "Caseta izolatie armaturi cu flanse DN100 vata minerala gr. 50 mm";
    const f: FoaieBruta = {
      nume: "F", coloane: 3,
      antet: { rand: 1, celule: [celula("Nr"), celula("Denumire"), celula("UM")] },
      randuri: [
        { rand: 1, celule: [celula("Nr"), celula("Denumire"), celula("UM")] },
        { rand: 2, celule: [celula(1), celula(lung), celula("buc")], linie: { index: 4, foaie: "F", rand: 2, text: lung, celule: [] } },
        { rand: 3, celule: [celula("PENTRU PLATA FACTURII FISCALE IN TERMEN DE 5-7 ZILE"), celula(""), celula("")] },
      ],
    };
    const html = grilaFoaie(f, harta, { ...opt, vizibile: null });
    // Toata coloana descrierii e lata; coloana cu nota de subsol nu.
    expect(html).toMatch(/class="camp lung"[^>]*data-rand="2" data-cel="1"/);
    expect(html).not.toMatch(/class="camp lung"[^>]*data-cel="0"/);
  });

  it("corectura se deschide pe rândul de sub poziție, pe toată lățimea", () => {
    const html = grilaFoaie(foaie(), harta, { ...opt, vizibile: null, editIdx: 4 });
    expect(html).toContain('<tr class="imp-grila-editor"><td colspan="8">');
  });
});

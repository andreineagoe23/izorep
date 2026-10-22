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
import { patchDinCamp, verificarePeEcran } from "../web/import/verificare-vizual.js";
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
      { destinatie: "rezidential" });
    // Pagina are un <img> legitim, poza; cel injectat nu trebuie sa apara.
    expect(html).not.toContain(INJECTIE);
  });
});

describe("pagina de santier se corecteaza in tabel (21 octombrie 2026)", () => {
  it("fara „Modifică” și „Scoate”: câmpurile sunt in rand, iar randul se scoate cu ✕", () => {
    const html = cardPagina(pagina({ randuri: [rand({ nesigur: true })] }), 1, { destinatie: "rezidential" });
    expect(html).not.toMatch(/data-act="modifica"|>Scoate</);
    for (const ed of ["diam", "gros", "cant"]) expect(html).toContain(`data-ed="${ed}"`);
    for (const sc of ["diametru_tip", "element", "izolatie", "jacheta", "pret_dublu"]) expect(html).toContain(`data-sc="${sc}"`);
    expect(html).toMatch(/class="cel-scoate" data-act="scoate-rand"/);
    expect(html).toMatch(/data-act="confirma"/);
    // Poza e mica, cu „Mărește”; nu mai se deschide in alta fila.
    expect(html).toMatch(/data-act="mareste"/);
    expect(html).not.toMatch(/target="_blank"/);
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

describe("verificarea și „Cum iese oferta” (21 octombrie 2026)", async () => {
  const { exportPeEcran, antetDinFisier } = await import("../web/import/oferta-vizual.js");
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

  const optiuni = (linii: LinieProcesata[]) => ({
    linii: new Map(linii.map((l) => [l.extras.index, l])), vizibile: null, editIdx: null, propunere: () => null, cuFoaie: true,
  });

  it("textul, codul și antetul din fișier nu injectează HTML, în niciun tab", () => {
    const linii = [linie(1, `Izolatie elastomer 13 mm DN50 ${INJECTIE}`, "E3.1.1.1", 8.84)];
    const d = documentOferta(cerere(linii));
    expect(verificarePeEcran(d, optiuni(linii))).not.toContain(INJECTIE);
    expect(exportPeEcran(d)).not.toContain(INJECTIE);
  });

  it("verificarea arată toate pozițiile; „Cum iese oferta” doar pe cele gata, numerotate ca în Excel", () => {
    const linii = [linie(1, "Izolatie elastomer 13 mm DN50", null, 8.84), linie(2, "Izolatie elastomer DN50", null, null),
      linie(3, "Izolatie elastomer 13 mm DN50", null, 8.84)];
    const d = documentOferta(cerere(linii));
    expect([...verificarePeEcran(d, optiuni(linii)).matchAll(/class="ver-poz" data-idx="(\d+)"/g)].map((m) => m[1])).toEqual(["1", "2", "3"]);
    const ex = exportPeEcran(d);
    expect([...ex.matchAll(/<td data-eticheta="Nr.">(\d+)<\/td>/g)].map((m) => m[1])).toEqual(["1", "2"]);
    expect(ex).toContain("176,80 €");
    expect(ex).toMatch(/Nu intră încă: 0 de verificat și 1 fără preț/);
  });

  it("fără Total pe rând; UM-ul e listă când are celulă, al doilea strat stă sub primul", () => {
    const l = linie(1, "DN80 elastomer 13mm+40mm vata minerala", null, 44.35);
    l.extras.straturi_extra = [{ sistem: "vata_minerala", grosime_mm: 40 }, { sistem: "tabla", grosime_mm: null }];
    const d = documentOferta(cerere([l]));
    const html = verificarePeEcran(d, { ...optiuni([l]), um: () => ({ cel: 2, v: "buc." }) });
    expect(html).not.toContain("Total €");
    expect(html).toMatch(/<select data-um="1" data-idx="1"[^>]*>.*<option value="buc\." selected>/s);
    expect(html).toContain('data-vc="strat0"');
    expect(html).toContain('data-ed="stratg0"');
    // Stratul e un sub-rând întreg, cu protecția pe el și prețul rândului dedesubt.
    expect(html.match(/<tr class="ver-strat" data-idx="1"/g)).toHaveLength(1);
    expect(html).toMatch(/<tr class="ver-strat"[^]*data-vc="protectie"[^]*ver-strat-total/);
    expect(html.match(/data-vc="protectie"/g)).toHaveLength(1);
    // Jacheta rămâne la „Protecție”, nu apare ca strat în plus.
    expect(html).not.toContain('data-vc="strat1"');
    expect(verificarePeEcran(d, optiuni([l]))).not.toContain("data-um=");
  });

  it("✕ e un meniu pe rând: „Adaugă un strat” oprit la 4 straturi, „Scoate rândul” mereu", () => {
    const l = linie(1, "DN80 elastomer 13mm+40mm vata minerala", null, 44.35);
    l.extras.straturi_extra = [{ sistem: "vata_minerala", grosime_mm: 40 }, { sistem: "tabla", grosime_mm: null }];
    const html = verificarePeEcran(documentOferta(cerere([l])), optiuni([l]));
    expect(html).toMatch(/<button type="button" class="cel-meniu" data-act="meniu-rand" data-idx="1"/);
    expect(html).toMatch(/data-act="adauga-strat" data-idx="1">Adaugă un strat</);
    expect(html).toMatch(/data-act="scoate-pozitie" data-idx="1">Scoate rândul din ofertă</);
    l.extras.straturi_extra = [...l.extras.straturi_extra, { sistem: "elastomer", grosime_mm: 9 }];
    expect(verificarePeEcran(documentOferta(cerere([l])), optiuni([l]))).toMatch(/data-act="adauga-strat" data-idx="1" disabled>/);
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

  it("„In atentia d-nei …” fără două puncte: persoana cu tot cu formulă, ca în 118", () => {
    const celula = (v: string) => ({ v, span: 1 });
    const foaie = {
      nume: "Termice", coloane: 4,
      antet: { rand: 12, celule: ["Nr.", "Denumire", "UM", "Cantitate"].map(celula) },
      randuri: [
        { rand: 9, celule: [celula("In atentia d-nei Alina Maties")] },
        { rand: 10, celule: [celula("Beneficiar: NISAL SRL")] },
      ],
    } as unknown as Parameters<typeof antetDinFisier>[0][number];
    expect(antetDinFisier([foaie]).persoana).toBe("d-nei Alina Maties");
  });
});

describe("câmpurile din rândul de verificare (patchDinCamp)", () => {
  const e = {
    index: 1, sistem: "elastomer", diametru_valoare: 80, diametru_tip: "DN", grosime_mm: 13, forma: "ml",
    gol_latime_mm: null, gol_inaltime_mm: null, incredere: 1, motiv: "",
    straturi_extra: [{ sistem: "vata_minerala", grosime_mm: 40 }, { sistem: "tabla", grosime_mm: null }],
  } as LinieProcesata["extras"];

  it("protecția schimbă doar jacheta; vata de la mijloc rămâne (NISAL: elastomer + vată)", () => {
    expect(patchDinCamp(e, "protectie", "tabla_inox|0.5").straturi_extra)
      .toEqual([{ sistem: "vata_minerala", grosime_mm: 40 }, { sistem: "tabla_inox", grosime_mm: 0.5 }]);
    expect(patchDinCamp(e, "protectie", "").straturi_extra).toEqual([{ sistem: "vata_minerala", grosime_mm: 40 }]);
  });

  it("grosimea și diametrul se citesc românește; golit, diametrul pierde și notația", () => {
    expect(patchDinCamp(e, "grosime", "19")).toEqual({ grosime_mm: 19 });
    expect(patchDinCamp(e, "diam", "114,3")).toEqual({ diametru_valoare: 114.3, diametru_tip: "DN" });
    expect(patchDinCamp(e, "diam", "")).toEqual({ diametru_valoare: null, diametru_tip: null });
    expect(patchDinCamp(e, "sistem", "")).toEqual({ sistem: null });
  });

  it("al doilea strat: izolația și grosimea lui se schimbă, „Fără” îl scoate; jacheta rămâne", () => {
    expect(patchDinCamp(e, "strat0", "elastomer").straturi_extra)
      .toEqual([{ sistem: "elastomer", grosime_mm: 40 }, { sistem: "tabla", grosime_mm: null }]);
    expect(patchDinCamp(e, "stratg0", "50").straturi_extra)
      .toEqual([{ sistem: "vata_minerala", grosime_mm: 50 }, { sistem: "tabla", grosime_mm: null }]);
    expect(patchDinCamp(e, "strat0", "").straturi_extra).toEqual([{ sistem: "tabla", grosime_mm: null }]);
  });

  it("„Adaugă un strat”: vată sub protecție, fără grosime; cel mult 4 straturi pe rând", () => {
    expect(patchDinCamp(e, "adauga-strat", "").straturi_extra).toEqual([
      { sistem: "vata_minerala", grosime_mm: 40 }, { sistem: "vata_minerala", grosime_mm: null }, { sistem: "tabla", grosime_mm: null },
    ]);
    const plin = { ...e, straturi_extra: [...e.straturi_extra, { sistem: "elastomer", grosime_mm: 9 }] } as LinieProcesata["extras"];
    expect(patchDinCamp(plin, "adauga-strat", "")).toEqual({});
  });
});

describe("filele „Materiale” (21 octombrie 2026)", async () => {
  const { fileMateriale } = await import("../web/stoc-vizual.js");

  it("trei linkuri, fila de acum marcată, cifra doar unde e ceva de făcut", () => {
    const html = fileMateriale("comenzi", { deCumparat: 13, comenzi: 0 });
    expect([...html.matchAll(/href="#\/(\w+)"/g)].map((m) => m[1])).toEqual(["materiale", "comenzi", "depozit"]);
    expect(html).toMatch(/href="#\/comenzi" class="fila" aria-current="page">Comenzi</);
    expect(html).toContain("De cumpărat <b>13</b>");
    expect(html).not.toMatch(/Comenzi <b>/);
  });
});

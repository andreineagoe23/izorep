/**
 * Editorul unei poziții („Modifică"): straturile, grosimea tablei, forma,
 * descrierea, UM-ul și cantitatea.
 *
 * Până pe 15 septembrie 2026 editorul avea un singur material, diametrul și
 * grosimea: o jachetă citită din text nu se putea scoate, una lipsă nu se putea
 * adăuga, iar la inox grosimea ei nu se putea pune deloc — deci poziția rămânea
 * fără preț orice ar fi făcut omul. Marcajul și citirea formularului sunt
 * funcții pure, testate aici; drumul din browser se verifică cu aplicația pornită.
 */
import { describe, it, expect } from "vitest";
import type { LinieProcesata } from "../src/import/nucleu.js";
import type { LinieExtrasa } from "../src/import/schema.js";
import type { RandBrut } from "../src/import/parse-workbook.js";
import { campuriRand } from "../src/import/editare.js";
import { editorPozitie, patchDinFormular, randStrat } from "../web/import/vizual.js";

const linie = (extras: Partial<LinieExtrasa> = {}): LinieProcesata => ({
  bruta: { index: 4, foaie: "Foaia 1", rand: 12, text: "Izolatie vata DN100", um: "ml", cantitate: 6, celule: [] },
  extras: {
    index: 4, sistem: "vata_minerala", diametru_valoare: 100, diametru_tip: "DN", grosime_mm: 50, forma: "ml",
    gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [], incredere: 0.99, motiv: "", ...extras,
  },
  sursa: "regex",
  necesitaValidare: false,
});

const actiuni = (html: string): string[] => [...html.matchAll(/data-act="([^"]+)"/g)].map((m) => m[1]!);

describe("straturile în editor", () => {
  it("fiecare strat peste primul are materialul și grosimea lui", () => {
    const html = editorPozitie(linie({ straturi_extra: [{ sistem: "tabla_inox", grosime_mm: 0.5 }] }));
    expect(html.match(/class="imp-strat"/g)).toHaveLength(1);
    expect(html).toMatch(/name="strat_sistem"(?:(?!<\/select>).)*<option value="tabla_inox" selected>/s);
    expect(html).toMatch(/name="strat_grosime"[^>]*list="ed-g-4-tabla_inox"[^>]*value="0.5"/);
    expect(actiuni(html)).toEqual(expect.arrayContaining(["scoate-strat", "adauga-strat"]));
  });

  it("grosimile tablei sunt sugerate, inclusiv cele trei de inox", () => {
    const html = editorPozitie(linie());
    expect(html).toContain('<datalist id="ed-g-4-tabla_inox"><option value="0.4"></option>'
      + '<option value="0.5"></option><option value="0.6"></option></datalist>');
    expect(html).toContain('<datalist id="ed-g-4-tabla"><option value="0.6"></option>');
  });

  it("un strat nou nu poate fi închidere de gol: acolo prețul e aditiv, nu strat", () => {
    expect(randStrat(4, { sistem: "tabla", grosime_mm: null })).not.toContain("goluri_foc");
  });

  it("butonul de scos stratul are nume citit de cititorul de ecran", () => {
    expect(randStrat(4, { sistem: "tabla", grosime_mm: null }))
      .toContain('data-act="scoate-strat" title="Scoate stratul" aria-label="Scoate stratul"');
  });
});

describe("conversia diametrului, sub câmpul lui", () => {
  it("DN-ul arată în ce diametru exterior se traduce", () => {
    expect(editorPozitie(linie())).toContain("ø114,3 după tabelul de conversie");
  });

  it("iar când poziția are preț, și rândul din listă", () => {
    const l = linie();
    const cuPret = {
      ...l,
      pret: { pret_unitar: 1, cantitate: 1, total: 1, straturi: [{ rand_lista: 114 }] },
    } as unknown as typeof l;
    expect(editorPozitie(cuPret)).toContain("ø114,3 după tabelul de conversie · rândul 114 din listă");
  });
});

describe("forma", () => {
  it("se alege din listă, cu metrul liniar implicit", () => {
    expect(editorPozitie(linie({ forma: "cot" }))).toContain('<option value="cot" selected>cot</option>');
    expect(editorPozitie(linie({ forma: null }))).toContain('<option value="ml" selected>metru liniar</option>');
  });
});

describe("descrierea, UM-ul și cantitatea", () => {
  const campuri = {
    texte: [{ cel: 1, eticheta: "Denumire articol", v: "Izolatie <b>vata</b> DN100" }],
    um: { cel: 2, eticheta: "UM", v: "ml" },
    cantitate: { cel: 3, eticheta: "Cantitate", v: 6 },
  };

  it("se corectează în celulele lor, cu textul clientului escapat", () => {
    const html = editorPozitie(linie(), { campuri });
    expect(html).toContain('<textarea name="text" data-cel="1"');
    expect(html).toContain("Izolatie &lt;b&gt;vata&lt;/b&gt; DN100");
    expect(html).not.toContain("<b>vata");
    expect(html).toMatch(/name="um" data-cel="2" value="ml"/);
    expect(html).toMatch(/name="cantitate" data-cel="3"[^>]*value="6"/);
    expect(actiuni(html)).toContain("reciteste");
  });

  it("fără celulele rândului, editorul are doar câmpurile extrase", () => {
    const html = editorPozitie(linie());
    expect(html).not.toContain("<textarea");
    expect(actiuni(html)).not.toContain("reciteste");
  });

  it("găsește celulele după valorile citite de linie, cu capul coloanei", () => {
    const celula = (v: string | number) => ({ v, span: 1 });
    const antet: RandBrut = { rand: 1, celule: [celula("Nr"), celula("Denumire articol"), celula("UM"), celula("Cantitate")] };
    const rand: RandBrut = {
      rand: 2,
      celule: [celula(1), celula("Izolatie elastomer 13 mm DN25"), celula("ml"), celula(1)],
      linie: {
        index: 1, foaie: "Lista", rand: 2, text: "Izolatie elastomer 13 mm DN25", um: "ml", cantitate: 1,
        celule: [1, "Izolatie elastomer 13 mm DN25", "ml", 1],
      },
    };
    const c = campuriRand(rand, antet);
    expect(c.texte).toEqual([{ cel: 1, eticheta: "Denumire articol", v: "Izolatie elastomer 13 mm DN25" }]);
    expect(c.um).toEqual({ cel: 2, eticheta: "UM", v: "ml" });
    // Nr. crt. e tot 1: cantitatea e cea de lângă UM, nu prima celulă cu valoarea ei.
    expect(c.cantitate).toEqual({ cel: 3, eticheta: "Cantitate", v: 1 });

    // Fără antet, coloana se numește cu litera ei, ca în grilă: altfel două
    // celule cu text de pe același rând arătau amândouă „Descriere".
    const faraAntet = campuriRand({
      rand: 2,
      celule: [celula("IZOLATII"), celula("Izolatie elastomer 13 mm DN25"), celula("ml")],
      linie: {
        index: 1, foaie: "Lista", rand: 2, text: "IZOLATII | Izolatie elastomer 13 mm DN25", um: "ml",
        celule: ["IZOLATII", "Izolatie elastomer 13 mm DN25", "ml"],
      },
    });
    expect(faraAntet.texte.map((t) => t.eticheta)).toEqual(["Coloana A", "Coloana B"]);
  });
});

describe("formularul, înapoi în câmpuri", () => {
  it("straturile, forma și grosimea tablei ies în ordinea din formular", () => {
    const d = new FormData();
    d.set("sistem", "vata_minerala"); d.set("diametru_tip", "DN"); d.set("diametru", "80");
    d.set("grosime", "50"); d.set("forma", "cot");
    d.append("strat_sistem", "tabla_inox"); d.append("strat_grosime", "0,5");
    d.append("strat_sistem", "tabla"); d.append("strat_grosime", "");
    expect(patchDinFormular(d)).toEqual({
      sistem: "vata_minerala", diametru_valoare: 80, diametru_tip: "DN", grosime_mm: 50, forma: "cot",
      straturi_extra: [{ sistem: "tabla_inox", grosime_mm: 0.5 }, { sistem: "tabla", grosime_mm: null }],
    });
  });

  it("fără straturi, lista rămâne goală: jacheta scoasă nu se mai tarifează", () => {
    const d = new FormData();
    d.set("sistem", "elastomer"); d.set("diametru_tip", "exterior"); d.set("diametru", "20");
    d.set("grosime", "9"); d.set("forma", "ml");
    expect(patchDinFormular(d).straturi_extra).toEqual([]);
  });
});

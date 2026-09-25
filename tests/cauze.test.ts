/**
 * Cauzele netarifarii, ca valori stabile.
 *
 * Doua lucruri diferite se apara aici, si merita spus care de ce:
 *
 * 1. **Fiecare cod se produce de un caz real.** Un cod care nu se aprinde
 *    niciodata e o eticheta moarta care ramane in ecran si in `ETICHETE_BLOCAJ`
 *    la nesfarsit; unul care se aprinde din alt loc decat crede cineva e mai
 *    rau, fiindca gruparea de pe ecran devine minciuna. Tabelul de mai jos e
 *    exhaustiv fata de `CodNetarifare` — testul de la final refuza sa treaca
 *    daca se adauga un cod fara caz.
 *
 * 2. **`notatieContraziceMaterialul` ruleaza pe calea determinista.**
 *    `valideazaExtragere` nu se aplica liniilor `sursa: "regex"`, iar SPIRO e
 *    prins chiar de `RE_DN` din `extract-regex.ts` — deci pana acum nu trecea
 *    pe la niciun validator, si `DN125` se tarifa tacut pe seria de otel, cu
 *    +21%. Regresia asta are test propriu mai jos, prin nucleu, nu prin apelul
 *    direct al functiei: apelul direct ar trece si daca `nucleu.ts` ar uita s-o
 *    cheme, ceea ce e exact bug-ul reparat.
 */
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  multiplicator, randCelMaiApropiat, tarifeaza, tarifeazaSimplu,
} from "../src/pricing/engine.js";
import {
  pretBandaWrap, pretColier, suprafataGol, tarifeazaGolFoc,
} from "../src/pricing/goluri-foc.js";
import { PozitieNetarifata, type CodNetarifare } from "../src/pricing/types.js";
import { notatieContraziceMaterialul } from "../src/import/valideaza.js";
import { proceseazaRegistru, tarifeazaExtras } from "../src/import/nucleu.js";
import { parseFoiBuffer } from "../src/import/parse-workbook.js";
import type { LinieExtrasa } from "../src/import/schema.js";
import { stocInMemorie } from "../src/import/memorie.js";

/** Codul aruncat de `f`, sau `null` daca n-a aruncat `PozitieNetarifata`. */
function codAruncat(f: () => unknown): CodNetarifare | null {
  try {
    f();
    return null;
  } catch (e) {
    return e instanceof PozitieNetarifata ? e.cod : null;
  }
}

const extrasa = (p: Partial<LinieExtrasa>): LinieExtrasa => ({
  index: 1, sistem: "elastomer", diametru_valoare: 50, diametru_tip: "DN",
  grosime_mm: 13, forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null,
  straturi_extra: [], incredere: 0.99, motiv: "test",
  ...p,
});

/**
 * Cazurile care produc fiecare cod. Toate sunt situatii care apar in fisierele
 * reale de client, nu constructii de laborator — de-aia fiecare are comentariul
 * lui cu provenienta.
 */
const CAZURI: { cod: CodNetarifare; de: string; f: () => unknown }[] = [
  {
    cod: "grosime_inexistenta",
    de: "elastomerul nu se oferteaza in 40 mm (lista: 9, 13, 19, 25, 32)",
    f: () => tarifeazaSimplu("elastomer", 15, 40, "ml"),
  },
  {
    cod: "grosime_inexistenta",
    de: "o15 g40 vata pe ml: 40 e grosime valida, dar nici celula 15|40, nici 18|40 nu exista",
    f: () => tarifeaza({
      diametru: { valoare: 15, tip: "exterior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: 40 }],
      forma: "ml", cantitate: 1,
    }),
  },
  {
    cod: "grosime_ambigua",
    de: "tabla de inox are toate cele trei grosimi la fiecare rand (intrebarea 15)",
    f: () => tarifeazaSimplu("tabla_inox", 80, undefined, "ml"),
  },
  {
    cod: "peste_maximul_listei",
    de: "PVC-ul se opreste la o710 si n-are pret pe mp, deci nici formula firmei nu se aplica",
    f: () => tarifeaza({
      diametru: { valoare: 800, tip: "exterior" }, straturi: [{ sistem: "pvc" }], forma: "ml", cantitate: 1,
    }),
  },
  {
    cod: "fara_coeficient_de_forma",
    de: "cot de vata pe banda 18-60, fara jacheta deasupra (intrebarea 9)",
    f: () => tarifeaza({
      diametru: { valoare: 21, tip: "interior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: 30 }],
      forma: "cot", cantitate: 1,
    }),
  },
  {
    cod: "banda_inexistenta",
    de: "randul 5 nu cade in nicio banda de multiplicatori (prima incepe la 18)",
    f: () => multiplicator("elastomer", 5, "cot"),
  },
  {
    cod: "lista_goala",
    de: "o lista fara niciun rand nu poate da un rand",
    f: () => randCelMaiApropiat(50, []),
  },
  {
    cod: "pozitie_fara_straturi",
    de: "o pozitie fara niciun strat n-are ce tarifa",
    f: () => tarifeaza({
      diametru: { valoare: 50, tip: "DN" }, straturi: [], forma: "ml", cantitate: 1,
    }),
  },
  {
    cod: "fara_pret_pe_mp",
    de: "tabla are 0,6 mm in grosimi_mm, dar per_mp doar 0,8",
    f: () => tarifeazaSimplu("tabla", 100, 0.6, "mp"),
  },
  {
    cod: "gol_foc_in_matrice",
    de: "inchiderile la foc au pret aditiv; `tarifeaza` le refuza cu motiv, nu cu TypeError",
    f: () => tarifeaza({
      diametru: { valoare: 50, tip: "DN" },
      straturi: [{ sistem: "goluri_foc" }],
      forma: "ml", cantitate: 1,
    }),
  },
  {
    cod: "gol_dimensiuni_invalide",
    de: "un gol cu latura zero n-are suprafata, deci n-are prag de pret",
    f: () => suprafataGol({ latime_mm: 0, inaltime_mm: 130 }),
  },
  {
    cod: "banda_wrap_inexistenta",
    de: "banda WRAP se cauta pe diametru EXACT: o100 nu e in tabelul de plastic",
    f: () => pretBandaWrap(100, "plastic"),
  },
  {
    cod: "colier_inexistent",
    de: "colierul PROMASTOP e piesa de catalog, nu marime continua",
    f: () => pretColier(100, "urcare"),
  },
  {
    cod: "diametru_conducta_lipsa",
    de: "banda WRAP se tarifeaza pe diametrul conductei, care lipseste din linie",
    f: () => tarifeazaGolFoc({
      gol: { latime_mm: 130, inaltime_mm: 130 }, banda_wrap: true, cantitate: 1,
    }),
  },
  {
    cod: "material_conducta_lipsa",
    de: "la o140 banda e 12,19 pe otel si 65,67 pe plastic: un implicit ar ghici",
    f: () => tarifeazaGolFoc({
      gol: { latime_mm: 130, inaltime_mm: 130 },
      banda_wrap: true, diametru_conducta: 32, cantitate: 1,
    }),
  },
  {
    cod: "gol_fara_dimensiuni",
    de: "inchidere la foc fara `130/130`: pretul vine din suprafata golului",
    f: () => {
      const r = tarifeazaExtras(extrasa({ sistem: "goluri_foc" }), 1);
      if (r.codEroare) throw new PozitieNetarifata(r.codEroare, r.eroare ?? "", {});
      return r;
    },
  },
  {
    cod: "fara_diametru",
    de: "tubulatura rectangulara pe ml (A × B): n-are diametru, iar pe ml nu exista pret fara el "
      + "(pe m² se tarifeaza din `per_mp`, vezi „Luftleitg. eckig”)",
    f: () => {
      const r = tarifeazaExtras(
        extrasa({ sistem: "vata_minerala", diametru_valoare: null, diametru_tip: null, forma: "ml" }), 1);
      if (r.codEroare) throw new PozitieNetarifata(r.codEroare, r.eroare ?? "", {});
      return r;
    },
  },
  {
    cod: "protectie_foc_tubulatura",
    de: "canal de desfumare EI60 (Oferta 27.04.2026, semnat 48 €/m²): altă lucrare, fără listă (întrebarea 8)",
    f: () => {
      const r = tarifeazaExtras(extrasa({ sistem: "vata_minerala", diametru_valoare: null, diametru_tip: null,
        grosime_mm: 60, forma: "mp" }), 1, "rezidential", "tubulatura rectangulara, izolare la foc EI60, vata 60mm");
      if (r.codEroare) throw new PozitieNetarifata(r.codEroare, r.eroare ?? "", {});
      return r;
    },
  },
  {
    cod: "dn_necunoscut",
    de: "DN160 (care nu exista in seria de otel): `DiametruNecunoscut`, mapat la granita in `tarifeazaExtras`",
    f: () => {
      const r = tarifeazaExtras(extrasa({ diametru_valoare: 160, grosime_mm: 9 }), 1);
      if (r.codEroare) throw new PozitieNetarifata(r.codEroare, r.eroare ?? "", {});
      return r;
    },
  },
];

describe("fiecare cauza de netarifare are un cod stabil", () => {
  for (const { cod, de, f } of CAZURI) {
    it(`${cod}: ${de}`, () => {
      expect(codAruncat(f)).toBe(cod);
    });
  }

  it("niciun cod din CodNetarifare nu ramane fara caz", () => {
    // Lista e scrisa de mana, deliberat: `CodNetarifare` e un tip, deci nu
    // exista la runtime, iar un `Object.keys` peste o harta ar verifica harta,
    // nu tipul. Asa, TypeScript pica la compilare daca se adauga un cod si se
    // uita aici, iar testul pica daca se adauga aici si nu in CAZURI.
    const toate: CodNetarifare[] = [
      "grosime_inexistenta", "grosime_ambigua", "peste_maximul_listei",
      "fara_coeficient_de_forma", "banda_inexistenta", "lista_goala",
      "pozitie_fara_straturi", "fara_pret_pe_mp", "gol_fara_dimensiuni",
      "gol_dimensiuni_invalide", "banda_wrap_inexistenta", "colier_inexistent",
      "diametru_conducta_lipsa", "material_conducta_lipsa", "gol_foc_in_matrice",
      "fara_diametru", "dn_necunoscut", "protectie_foc_tubulatura",
    ];
    const acoperite = new Set(CAZURI.map((c) => c.cod));
    expect(toate.filter((c) => !acoperite.has(c))).toEqual([]);
  });

  it("mesajul citit de om ramane neschimbat langa cod", () => {
    // Codul e pentru grupat, `motiv` e pentru citit. Daca cineva ar inlocui
    // mesajele cu codurile "ca sa fie consecvent", omul de la validare ar
    // pierde singurul text care ii spune CE anume lipseste din lista.
    try {
      tarifeaza({ diametru: { valoare: 800, tip: "exterior" }, straturi: [{ sistem: "pvc" }], forma: "ml", cantitate: 1 });
      expect.unreachable("trebuia sa arunce");
    } catch (e) {
      expect(e).toBeInstanceOf(PozitieNetarifata);
      const p = e as PozitieNetarifata;
      expect(p.cod).toBe("peste_maximul_listei");
      expect(p.motiv).toBe("diametru peste maximul listei de preturi");
      expect(p.message).toBe(p.motiv);
    }
  });
});

describe("notatieContraziceMaterialul", () => {
  const text = (t: string, l: Partial<LinieExtrasa> = {}) =>
    notatieContraziceMaterialul(extrasa({ diametru_valoare: 160, ...l }), t);

  it("se aprinde pe tubulatura SPIRO scrisa cu DN", () => {
    const av = text("Zuluft Wickelfalzrohr starr SPIRO DN 160, Armaflex 9mm");
    expect(av.map((a) => a.cod)).toEqual(["notatie_contrazice_materialul"]);
  });

  it("se aprinde pe teava de plastic scrisa cu DN", () => {
    expect(text("Teava DN110 PEHD", { diametru_valoare: 110 })).toHaveLength(1);
    expect(text("Conducta PPR DN32", { diametru_valoare: 32 })).toHaveLength(1);
    expect(text("Teava PE-X DN20", { diametru_valoare: 20 })).toHaveLength(1);
  });

  it("tace pe teava de otel, unde DN chiar inseamna DN", () => {
    expect(text("Teava OL DN80", { diametru_valoare: 80 })).toEqual([]);
    expect(text("Izolatie vata minerala Dn 50 (60,3x3,6 - 2'')", { diametru_valoare: 50 })).toEqual([]);
  });

  it("tace cand diametrul NU e scris ca DN", () => {
    // Aici nu e nimic de reparat: notatia si materialul spun acelasi lucru.
    expect(text("Wickelfalzrohr SPIRO o160", { diametru_tip: "exterior" })).toEqual([]);
  });

  it("tace pe PVC: acolo cuvantul inseamna jacheta, nu teava", () => {
    // Sistemul `pvc` al motorului e jachetare peste izolatie. Inclus in lista
    // de materiale, avertismentul s-ar aprinde pe pozitii perfect corecte —
    // iar un avertisment care se aprinde mereu nu mai e citit de nimeni.
    expect(text("Izolatie DN50 cu protectie PVC", { diametru_valoare: 50 })).toEqual([]);
  });

  it("mesajul spune si materialul gasit, si diametrul citit gresit", () => {
    // Se raporteaza materialul care apare PRIMUL in text, nu unul ales dintr-o
    // lista: omul trebuie sa poata pune degetul pe cuvantul din linia lui.
    const av = text("Tubulatura SPIRO DN 125", { diametru_valoare: 125 });
    expect(av[0]!.mesaj).toContain("SPIRO");
    expect(av[0]!.mesaj).toContain("DN125");
    expect(text("Wickelfalzrohr starr SPIRO DN 125", { diametru_valoare: 125 })[0]!.mesaj)
      .toContain("Wickelfalzrohr");
  });
});

/* ------------------------------------------------------------------ *
 * Regresia: verificarea trebuie sa ruleze INDIFERENT de sursa.
 * ------------------------------------------------------------------ */

async function registru(randuri: (string | number | null)[][]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("izolatie");
  randuri.forEach((r, i) => { ws.getRow(i + 1).values = r as ExcelJS.CellValue[]; });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Textul real din `oferta-118-nisal.xlsx`, foaia Ventilatie. */
const SPIRO_125 = "Zuluft Wickelfalzrohr starr SPIRO DN 125, Armaflex 9mm";

describe("SPIRO se citeste ca diametru exterior", () => {
  it("DN125 pe spiro cade pe randul 125, nu pe seria de otel", async () => {
    // Istoricul acestui test conteaza. A fost scris cand NU stiam regula:
    // `RE_DN` prindea "SPIRO DN 125" ca DN de otel, il convertea la o139,7 si
    // il tarifa pe randul 140 (13,74) in loc de 125 (11,36) — cu +21%, in
    // tacere. Reparatia de atunci a fost un AVERTISMENT: pozitia isi pastra
    // pretul gresit, dar era marcata pentru om.
    //
    // Pe 11 septembrie 2026 firma a raspuns: "la spiro este doar diametru
    // exterior". Acum se citeste corect de la inceput, deci nu mai e nimic de
    // marcat — testul pazeste pretul, nu marcajul. Un avertisment e un bandaj;
    // regula e leacul.
    const foi = await parseFoiBuffer(await registru([
      ["Nr", "Denumire articol", "UM", "Cantitate"],
      [1, SPIRO_125, "ml", 10],
    ]));
    const rez = await proceseazaRegistru(foi, { stoc: stocInMemorie() });
    const linie = rez.linii.find((l) => l.bruta.text.includes("SPIRO"))!;

    expect(linie.extras.diametru_tip).toBe("exterior");
    expect(linie.extras.diametru_valoare).toBe(125);
    expect(linie.pret).toBeDefined();
    expect(linie.pret && "straturi" in linie.pret ? linie.pret.straturi[0]!.rand_lista : null).toBe(125);
    expect(linie.pret!.pret_unitar).toBeCloseTo(11.36, 2);
    // Nici avertisment, nici oprire la validare: nu mai e nimic incert.
    expect(linie.avertismente).toBeUndefined();
    expect(linie.necesitaValidare).toBe(false);
  });

  it("o teava de otel scrisa cu DN ramane pe seria de otel", async () => {
    // Gardul celalalt al aceleiasi reguli: exceptia e pentru SPIRO, nu pentru
    // orice "DN". Fara testul asta, o regula prea lata ar muta toate tevile de
    // otel pe diametrul exterior gresit.
    const foi = await parseFoiBuffer(await registru([
      ["Nr", "Denumire articol", "UM", "Cantitate"],
      [1, "Izolatie conducta otel DN 125, Armaflex 9mm", "ml", 10],
    ]));
    const rez = await proceseazaRegistru(foi, { stoc: stocInMemorie() });
    const linie = rez.linii.find((l) => l.bruta.text.includes("DN 125"))!;
    expect(linie.extras.diametru_tip).toBe("DN");
  });
});


/* ------------------------------------------------------------------ *
 * Regresia: o poziție fără preț nu mai poate rămâne fără cauză.
 * ------------------------------------------------------------------ */

describe("nicio poziție fără preț nu rămâne fără cauză", () => {
  it("sistemul cunoscut fără diametru primește cod, nu tăcere", () => {
    // Bug-ul: `tarifeazaExtras` intorcea `{}` cand sistemul era cunoscut dar
    // diametrul lipsea. Pozitia ramanea fara pret, fara eroare, fara cod si —
    // daca modelul raportase incredere peste prag — fara sa fie nici macar
    // marcata. Se vedea EXCLUSIV ca diferenta intre doua contoare de pe ecran,
    // adica exact felul de gol pe care blocul „Ce blocheaza N pozitii" a fost
    // construit sa-l arate.
    const r = tarifeazaExtras(
      extrasa({ sistem: "vata_minerala", diametru_valoare: null, diametru_tip: null }), 1);
    expect(r.pret).toBeUndefined();
    expect(r.codEroare).toBe("fara_diametru");
    expect(r.eroare).toBeTruthy();
  });

  it("un rând care nu e poziție de izolație rămâne tăcut, corect", () => {
    // `sistem: null` inseamna antet, nota sau total. Ala nu e o problema de
    // rezolvat, deci nu primeste cauza — altfel blocul s-ar umple de zgomot.
    const r = tarifeazaExtras(extrasa({ sistem: null }), 1);
    expect(r.pret).toBeUndefined();
    expect(r.codEroare).toBeUndefined();
    expect(r.eroare).toBeUndefined();
  });

  it("orice combinație de câmpuri lipsă dă ori preț, ori cauză — niciodată nimic", () => {
    // Cautarea exhaustiva peste campurile care intra in tarifare. Garantia pe
    // care o da blocul de pe ecran e „suma cauzelor acopera toate pozitiile
    // fara pret"; fara testul asta, garantia tine doar pentru combinatiile la
    // care s-a gandit cineva.
    const sisteme = ["elastomer", "vata_minerala", "tabla", "tabla_inox", "pvc", "goluri_foc"] as const;
    for (const sistem of sisteme) {
      for (const diametru_valoare of [null, 50, 999]) {
        for (const diametru_tip of [null, "DN", "exterior"] as const) {
          for (const grosime_mm of [null, 13, 48]) {
            for (const gol of [null, 130]) {
              const r = tarifeazaExtras(extrasa({
                sistem, diametru_valoare, diametru_tip, grosime_mm,
                gol_latime_mm: gol, gol_inaltime_mm: gol,
              }), 1);
              const context = `${sistem} ø${diametru_valoare}/${diametru_tip} g${grosime_mm} gol${gol}`;
              if (r.pret) expect(r.codEroare, context).toBeUndefined();
              else expect(r.codEroare, context).toBeTruthy();
            }
          }
        }
      }
    }
  });
});

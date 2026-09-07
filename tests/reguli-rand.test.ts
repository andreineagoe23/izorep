/**
 * Regulile de rand si de multiplicator pe strat, deduse din Oferta 284 / 27.05.2026
 * (Transavia Alba-Iulia, beneficiar Grup Energoinstal), oferta SEMNATA — 30 de
 * linii distincte vata minerala + tabla aluminiu, tarifate pe listele
 * REZIDENTIALE. Sursa fisierului si masuratoarea completa stau in
 * .claude/stare.md.
 *
 * Trei reguli noi fata de tests/pricing.test.ts (Oferta 118), care ramane
 * neatinsa:
 *   1. toleranta la capatul listei (0,5 mm — eroare de rotunjire a seriei ISO)
 *   2. seria de otel se recunoaste dupa VALOARE, nu dupa notatie ("interior")
 *   3. jacheta (ultimul strat) se rotunjeste IN SUS; multiplicatorul e PE
 *      STRAT, cu excluderea straturilor fara coeficient definit
 */
import { describe, it, expect } from "vitest";
import { tarifeaza, tarifeazaSimplu } from "../src/pricing/engine.js";
import { peSeriaDeOtel } from "../src/pricing/dn-table.js";
import { PozitieNetarifata } from "../src/pricing/types.js";

describe("toleranta la capatul listei (TOLERANTA_CAPAT_LISTA)", () => {
  it("DN200 elastomer (od 219,1) se tarifeaza acum pe randul 219, la 0,1 mm de capat", () => {
    const r = tarifeazaSimplu("elastomer", 200, 9, "ml");
    expect(r.straturi[0]!.rand_lista).toBe(219);
    expect(r.pret_unitar).toBe(15.46);
  });

  it("DN250 elastomer (od 273, la 54 mm de capatul de 219) ramane refuzat", () => {
    expect(() => tarifeazaSimplu("elastomer", 250, 9, "ml")).toThrow(PozitieNetarifata);
  });
});

describe("peSeriaDeOtel: regula de SERIE, nu de notatie", () => {
  it("Di49 si Di169, scrise cu notatia interior, sunt pe seria de otel (Di49=48,3 Di169=168,3)", () => {
    expect(peSeriaDeOtel(48.3)).toBe(true);
    expect(peSeriaDeOtel(168.3)).toBe(true);
  });

  it("o90 si o75 (tevi de plastic) NU se potrivesc pe seria de otel", () => {
    expect(peSeriaDeOtel(90)).toBe(false);
    expect(peSeriaDeOtel(75)).toBe(false);
  });
});

describe("cot/teu de vata minerala pe banda 18-60: 9/9 potriviri exacte cu Oferta 284", () => {
  /**
   * Vata minerala n-are coeficient de cot/teu definit pe banda 18-60
   * (intrebarea 9). Regula noua: stratul contribuie cu geometria lui la
   * jacheta (tabla), dar nu intra in pret — pretul e EXACT tabla la randul
   * geometric. Toate cele 9 pozitii sunt reale, din oferta semnata, forma
   * "interior" (Di), grosime 40mm.
   */
  const cazuri: [number, "cot" | "teu", number, number, number][] = [
    // [Di, forma, pret asteptat, rand vata (exclus), rand tabla (jacheta)]
    [21, "cot", 17.78, 22, 110],
    [21, "teu", 17.78, 22, 110],
    [27, "cot", 17.78, 28, 110],
    [27, "teu", 17.78, 28, 110],
    [34, "cot", 18.12, 35, 120],
    [34, "teu", 18.12, 35, 120],
    [49, "cot", 18.48, 48, 130],
    [60, "cot", 18.83, 60, 140],
    [60, "teu", 18.83, 60, 140],
  ];

  it.each(cazuri)("Di%i %s = %f EUR (vata rand %i exclus, tabla rand %i)", (di, forma, pret, randVata, randTabla) => {
    const r = tarifeaza({
      diametru: { valoare: di, tip: "interior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: 40 }, { sistem: "tabla" }],
      forma, cantitate: 1,
    });
    expect(r.pret_unitar).toBe(pret);

    const [vata, tabla] = r.straturi;
    expect(vata!.rand_lista).toBe(randVata);
    expect(vata!.inclus).toBe(false);
    expect(vata!.pret_unitar).toBe(0);

    expect(tabla!.rand_lista).toBe(randTabla);
    expect(tabla!.inclus).toBe(true);
    expect(tabla!.pret_unitar).toBe(pret);

    // Pozitia poarta nota de proveniente a regulii — omul trebuie sa o vada.
    expect(r.note).toBeDefined();
    expect(r.note![0]).toContain("vata_minerala nu are coeficient de " + forma);
    expect(r.note![0]).toContain("banda 18-60");
  });
});

describe("Di49 / Di169 / Di273 pe ml — vata + tabla, ambele incluse (multiplicator 1)", () => {
  const cazuri: [number, number, number][] = [
    // [Di, grosime vata mm, pret ml din oferta]
    [49, 40, 27.04],
    [169, 50, 51.44],
    [273, 60, 72.58],
  ];

  it.each(cazuri)("Di%i g%i ml = %f EUR/ml", (di, g, pret) => {
    const r = tarifeaza({
      diametru: { valoare: di, tip: "interior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: g }, { sistem: "tabla" }],
      forma: "ml", cantitate: 1,
    });
    expect(r.pret_unitar).toBe(pret);
    expect(r.straturi.every((s) => s.inclus)).toBe(true);
    expect(r.note).toBeUndefined();
  });
});

describe("strat exclus: nu se mai cauta in matrice", () => {
  it("Di21 g40 pe ml RAMANE netarifat: la ml vata are coeficient 1, deci intra in pret, iar celula 22|40 nu exista", () => {
    expect(() => tarifeaza({
      diametru: { valoare: 21, tip: "interior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: 40 }, { sistem: "tabla" }],
      forma: "ml", cantitate: 1,
    })).toThrow(PozitieNetarifata);
  });

  it("Di21 g40 pe cot SE tarifeaza la 17.78: vata exclusa, celula ei lipsa nu mai conteaza", () => {
    const r = tarifeaza({
      diametru: { valoare: 21, tip: "interior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: 40 }, { sistem: "tabla" }],
      forma: "cot", cantitate: 1,
    });
    expect(r.pret_unitar).toBe(17.78);
  });

  it("cot de vata pe banda 18-60 FARA jacheta (un singur strat) arunca PozitieNetarifata, nu 0", () => {
    expect(() => tarifeaza({
      diametru: { valoare: 40, tip: "interior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: 40 }],
      forma: "cot", cantitate: 1,
    })).toThrow(PozitieNetarifata);
  });
});

/**
 * Jacheta se recunoaste dupa MATERIAL (tabla, tabla_inox), nu dupa pozitia
 * stratului in lista. Regresie blocata: la o pozitie compusa unde jacheta e
 * ultimul strat, stratul din MIJLOC ramane pe `randCelMaiApropiat`, chiar daca
 * n-ar mai fi ultimul intr-o alta ordine. O pozitie artificiala cu jacheta
 * NU pe ultimul loc n-ar reproduce nicio oferta reala; testul de mai jos
 * verifica direct rezultatul care ar fi gresit daca predicatul ar redeveni
 * legat de pozitie ("ultimul strat") in loc de material: vata la DN80 ar
 * rotunji in sus, de la geometric 115 la randul 133, in loc de 114.
 */
describe("jacheta se recunoaste dupa MATERIAL, nu dupa pozitie (DN80 compus, Oferta 118)", () => {
  it("stratul de vata (mijloc, geometric 115) cade pe randul 114 — randCelMaiApropiat, NU 133 (randPentruJacheta rotunjit in sus)", () => {
    const r = tarifeaza({
      diametru: { valoare: 80, tip: "DN" },
      straturi: [
        { sistem: "elastomer", grosime_mm: 13 },
        { sistem: "vata_minerala", grosime_mm: 40 },
        { sistem: "tabla" },
      ],
      forma: "ml", cantitate: 345,
    });
    const vata = r.straturi[1]!;
    expect(vata.sistem).toBe("vata_minerala");
    expect(vata.rand_lista).toBe(114);
    expect(vata.rand_lista).not.toBe(133);
  });
});

/**
 * Un strat exclus din pret nu are nevoie de celula rand|grosime in matrice —
 * aia e informatie de TARIFARE, si tocmai am decis sa nu-l tarifam. Dar
 * grosimea lui trebuie sa fie una dintre grosimile pe care sistemul le
 * ofertaza (`grosimi_mm`) — aia e informatie FIZICA, de care depinde
 * geometria straturilor de deasupra. Cele doua cazuri reale din Oferta 284 /
 * Izolatii Transavia, care predicatul trebuie sa le separe:
 */
describe("strat exclus isi pastreaza obligatia de grosime valida (grosimi_mm)", () => {
  it("Di21 g40 cot (Oferta 284): 40 e in grosimi_mm al vatei — se tarifeaza la 17.78 EUR, desi celula 22|40 nu exista", () => {
    const r = tarifeaza({
      diametru: { valoare: 21, tip: "interior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: 40 }, { sistem: "tabla" }],
      forma: "cot", cantitate: 1,
    });
    expect(r.pret_unitar).toBe(17.78);
    expect(r.straturi[0]!.inclus).toBe(false);
  });

  it("Di60 g48 cot (Izolatii Transavia, linia 27): 48 NU e in grosimi_mm al vatei (lista: 20,30,40,50,60,80,100) — ramane netarifat", () => {
    expect(() => tarifeaza({
      diametru: { valoare: 60, tip: "interior" },
      straturi: [{ sistem: "vata_minerala", grosime_mm: 48 }, { sistem: "tabla" }],
      forma: "cot", cantitate: 1,
    })).toThrow(PozitieNetarifata);
  });
});

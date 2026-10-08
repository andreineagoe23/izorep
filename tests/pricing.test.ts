/**
 * Suita de referinta a motorului de preturi.
 *
 * Fiecare caz e o pozitie reala dintr-o oferta trimisa clientului, cu pretul
 * exact care a fost facturat. Daca un test de aici pica, motorul nu mai
 * reproduce ofertele istorice si NU se poate emite cu el.
 *
 * Sursa: Oferta 118 / 27.04.2026, beneficiar NISAL SRL, obiectiv
 * XXXLutz+Momax Balotesti. Fixture: tests/fixtures-oferta-118.json
 */
import { describe, it, expect } from "vitest";
import { tarifeaza, tarifeazaSimplu, randCelMaiApropiat, multiplicator } from "../src/pricing/engine.js";
import { PozitieNetarifata } from "../src/pricing/types.js";
import { diametre } from "../src/pricing/lists.js";

describe("conversie DN si potrivire pe rand", () => {
  it("alege randul cel mai apropiat", () => {
    expect(randCelMaiApropiat(21.3, [15, 18, 22, 28])).toBe(22);
    expect(randCelMaiApropiat(88.9, [76, 89, 114])).toBe(89);
    expect(randCelMaiApropiat(114.3, [89, 114, 133])).toBe(114);
  });

  it("la egalitate alege randul superior (jacheta trebuie sa incapa)", () => {
    expect(randCelMaiApropiat(195, [190, 200])).toBe(200);
    expect(randCelMaiApropiat(20, [18, 22])).toBe(22);
    expect(randCelMaiApropiat(25, [22, 28])).toBe(28);
  });

  it("refuza extrapolarea peste ultimul rand din lista", () => {
    expect(() => randCelMaiApropiat(315, diametre("elastomer"))).toThrow(PozitieNetarifata);
  });
});

describe("elastomer pe teava de otel (DN)", () => {
  const cazuri: [number, number, number][] = [
    // [DN, grosime, pret din oferta]
    [15, 13, 5.99], [20, 13, 6.20], [25, 13, 6.35], [32, 13, 8.66],
    [40, 25, 14.07], [50, 25, 16.42], [65, 25, 17.69], [80, 25, 17.91],
    [100, 32, 28.96], [125, 32, 29.99], [150, 32, 32.74],
  ];
  it("cele 11 pozitii din oferta, la banut", () => {
    const gresite = cazuri.filter(([dn, g, pret]) => tarifeazaSimplu("elastomer", dn, g, "ml").pret_unitar !== pret);
    expect(gresite).toEqual([]);
  });
});

describe("vata minerala pe teava de otel (DN)", () => {
  const cazuri: [number, number, number][] = [
    [32, 30, 7.13], [40, 30, 7.21], [50, 30, 7.38], [65, 30, 9.80], [80, 30, 9.97],
  ];
  it("cele 5 pozitii din oferta, la banut", () => {
    const gresite = cazuri.filter(([dn, g, pret]) => tarifeazaSimplu("vata_minerala", dn, g, "ml").pret_unitar !== pret);
    expect(gresite).toEqual([]);
  });
});

describe("conducte de plastic - dimensiunea nominala E diametrul exterior", () => {
  const cazuri: [number, number][] = [
    // [diametru exterior, pret din oferta] - toate cu elastomer 9mm
    [20, 5.79], [25, 5.99], [32, 6.15], [40, 8.29], [50, 8.64],
    [56, 8.88], [63, 9.10], [75, 9.26], [110, 11.12],
    [125, 11.36], [160, 14.37], [200, 15.46],
  ];
  it("cele 12 pozitii din oferta, la banut", () => {
    const gresite = cazuri.filter(([od, pret]) => tarifeaza({
      diametru: { valoare: od, tip: "exterior" },
      straturi: [{ sistem: "elastomer", grosime_mm: 9 }],
      forma: "ml", cantitate: 1,
    }).pret_unitar !== pret);
    expect(gresite).toEqual([]);
  });
});

describe("tevi in toli, convertite prin DN", () => {
  const cazuri: [number, number][] = [
    [15, 5.79],  // 1/2"
    [20, 5.99],  // 3/4"
    [25, 6.15],  // 1"
    [32, 8.29],  // 1 1/4"
    [40, 8.45],  // 1 1/2"
    [50, 8.88],  // 2"
  ];
  it("cele 6 pozitii din oferta, la banut", () => {
    const gresite = cazuri.filter(([dn, pret]) => tarifeazaSimplu("elastomer", dn, 9, "ml").pret_unitar !== pret);
    expect(gresite).toEqual([]);
  });
});

describe("pozitii compuse - straturile se aduna, diametrul creste", () => {
  it("DN80: elastomer 13 + vata 40 + tabla = 44.35 EUR/ml", () => {
    const r = tarifeaza({
      diametru: { valoare: 80, tip: "DN" },
      straturi: [
        { sistem: "elastomer", grosime_mm: 13 },
        { sistem: "vata_minerala", grosime_mm: 40 },
        { sistem: "tabla" },
      ],
      forma: "ml", cantitate: 345,
    });
    expect(r.straturi.map((s) => s.pret_unitar)).toEqual([11.20, 12.20, 20.95]);
    expect(r.straturi.map((s) => s.rand_lista)).toEqual([89, 114, 200]);
    expect(r.pret_unitar).toBe(44.35);
    expect(r.total).toBe(15300.75); // exact totalul din oferta
  });

  it("DN100: elastomer 13 + vata 40 + tabla = 57.82 EUR/ml", () => {
    const r = tarifeaza({
      diametru: { valoare: 100, tip: "DN" },
      straturi: [
        { sistem: "elastomer", grosime_mm: 13 },
        { sistem: "vata_minerala", grosime_mm: 40 },
        { sistem: "tabla" },
      ],
      forma: "ml", cantitate: 60,
    });
    expect(r.straturi.map((s) => s.pret_unitar)).toEqual([11.84, 14.79, 31.19]);
    expect(r.straturi.map((s) => s.rand_lista)).toEqual([114, 140, 220]);
    expect(r.pret_unitar).toBe(57.82);
    expect(r.total).toBe(3469.20);
  });
});

describe("tubulatura rectangulara - tarifare pe mp", () => {
  it("vata 50 + tabla = 79.73 EUR/mp", () => {
    const r = tarifeaza({
      diametru: { valoare: 100, tip: "DN" }, // irelevant la mp, dar cerut de schema
      straturi: [{ sistem: "vata_minerala", grosime_mm: 50 }, { sistem: "tabla", grosime_mm: 0.8 }],
      forma: "mp", cantitate: 460,
    });
    expect(r.pret_unitar).toBe(79.73);
    expect(r.total).toBe(36675.80);
  });
});

describe("elemente speciale - multiplicatori peste pretul pe ml", () => {
  it("banda 76-114: cot = X, robinet = X*2, pompa = X*2.5", () => {
    expect(multiplicator("elastomer", 114, "cot")).toBe(1);
    expect(multiplicator("elastomer", 114, "robinet")).toBe(2);
    expect(multiplicator("elastomer", 114, "filtru")).toBe(2.5);
    expect(multiplicator("elastomer", 114, "manseta")).toBe(0.5);
  });

  it("banda 18-60 nu are multiplicator de cot definit", () => {
    expect(() => multiplicator("elastomer", 42, "cot")).toThrow(PozitieNetarifata);
  });

  it("aplica multiplicatorul peste pretul stratului", () => {
    const ml = tarifeazaSimplu("elastomer", 100, 19, "ml").pret_unitar;
    const robinet = tarifeazaSimplu("elastomer", 100, 19, "robinet").pret_unitar;
    expect(robinet).toBe(Math.round(ml * 2 * 100) / 100);
  });
});

describe("pozitii care NU se pot tarifa - se semnaleaza, nu se ghicesc", () => {
  it("combinatie inexistenta in matrice", () => {
    // randul ø15 nu are coloana de 19mm: celula e goala in lista
    expect(() => tarifeaza({
      diametru: { valoare: 15, tip: "exterior" },
      straturi: [{ sistem: "elastomer", grosime_mm: 19 }],
      forma: "ml", cantitate: 1,
    })).toThrow(PozitieNetarifata);
  });

  it("diametru peste lista (ø250, ø315 din oferta 118): formula firmei, dar marcat", () => {
    // Pana pe 25 septembrie 2026 aruncau. Firma a dat regula scrisa pe mp:
    // (φ + 2g) / 1000 × 3,14 × pret/mp. Oferta semnata are 16,36 si 20,30 —
    // 0,13 € peste formula ei, deci pretul nu e sigur si pozitia merge la om.
    const pret = (od: number) => tarifeaza({
      diametru: { valoare: od, tip: "exterior" },
      straturi: [{ sistem: "elastomer", grosime_mm: 9 }],
      forma: "ml", cantitate: 1,
    });
    expect(pret(250).pret_unitar).toBe(16.23);
    expect(pret(315).pret_unitar).toBe(20.17);
    expect(pret(250).motiveDeVerificat).toContain("peste_lista");
  });

  it("peste lista, fara pret pe mp (PVC peste o710): ramane refuzat", () => {
    expect(() => tarifeaza({
      diametru: { valoare: 800, tip: "exterior" },
      straturi: [{ sistem: "pvc" }],
      forma: "ml", cantitate: 1,
    })).toThrow(PozitieNetarifata);
  });

  it("DN inexistent in tabelul de conversie", () => {
    expect(() => tarifeazaSimplu("elastomer", 37, 13, "ml")).toThrow();
  });

  it("inchiderile de goluri la foc au alta structura de pret", () => {
    // Pret aditiv (gol dupa suprafata + banda WRAP + colier), nu matrice
    // ø × grosime. Fara verificarea explicita din `tarifeaza`, lista cu alta
    // forma pica intr-un TypeError opac, iar in ecranul de import pozitia
    // aparea fara pret si fara motiv.
    expect(() => tarifeaza({
      diametru: { valoare: 100, tip: "exterior" },
      straturi: [{ sistem: "goluri_foc" }],
      forma: "ml", cantitate: 1,
    })).toThrow(PozitieNetarifata);
  });
});

describe("abateri cunoscute fata de ofertele istorice", () => {
  /**
   * Pozitiile de mai jos sunt tarifate diferit in oferta trimisa clientului
   * fata de ce da regula determinista. Nu sunt bug-uri in motor: sunt
   * inconsecvente de tarifare manuala, pastrate aici ca sa fie vizibile si
   * ca sa poata fi puse pe masa la discutia cu firma.
   *
   * Cand firma confirma regula corecta, cazul se muta in suita principala.
   */
  it("ø90 PEHD, elastomer 9mm: motorul rotunjeste in sus, oferta a rotunjit in jos", () => {
    const r = tarifeaza({
      diametru: { valoare: 90, tip: "exterior" },
      straturi: [{ sistem: "elastomer", grosime_mm: 9 }],
      forma: "ml", cantitate: 1,
    });
    expect(r.pret_unitar).toBe(11.12);   // rand 114
    const inOferta = 10.57;              // rand 89
    expect(r.pret_unitar - inOferta).toBeCloseTo(0.55, 2);
    // Firma, 5 octombrie 2026: „randul de sus". Oferta semnata s-a abatut de
    // la regula, deci pozitia nu se mai marcheaza.
    expect(r.noteDeVerificat).toBeUndefined();
  });

  it("ø160: tarifat 14.37 ca teava PEHD si 14.16 ca tubulatura SPIRO, in aceeasi oferta", () => {
    const caPEHD = tarifeaza({
      diametru: { valoare: 160, tip: "exterior" },
      straturi: [{ sistem: "elastomer", grosime_mm: 9 }], forma: "ml", cantitate: 1,
    });
    expect(caPEHD.pret_unitar).toBe(14.37); // rand 169, ca in oferta la PEHD
    // Aceeasi oferta tarifeaza SPIRO DN160 la 14.16 (randul 159). Regula
    // firmei („randul de sus") da 14.37 pentru ambele; diferenta e de 0.21 EUR/ml.
    expect(caPEHD.noteDeVerificat).toBeUndefined();
  });
});

/**
 * Ce NU e o poziție de izolație, și ce numere nu sunt grosimi.
 *
 * Toate cazurile de aici vin din `cerere-de-oferta-book15.xlsx` și `oferta-118-nisal.xlsx`,
 * unde extragerea producea zgomot: rânduri de altă meserie citite ca izolație,
 * diametre citite ca grosimi, unități citite din densitatea zincului. Zgomotul
 * ăsta nu se vedea ca greșeală — se vedea ca **muncă**, fiindcă fiecare rând
 * fals ajungea pe ecranul omului de la tehnic, cu cauză și tot.
 *
 * De-aia sunt teste separate de restul: aici nu se verifică un preț, ci că
 * sistemul **tace** unde trebuie să tacă.
 */
import { describe, it, expect } from "vitest";
import { extrageDeterminist } from "../src/import/extract-regex.js";

const extrage = (text: string, um?: string, cant?: number) =>
  extrageDeterminist(0, text, um, undefined, cant).linie;

describe("livrarea de tubulatură nu e izolație", () => {
  // Textul real din Book15, scurtat. Descrie tubulatura prin materialul din
  // care e FĂCUTĂ — exact ce prinde regula de `tabla`.
  const LIVRARE =
    "Circular spiro duct system and special parts for stale air exhaust. - Made of hot-dip "
    + "galvanized sheet with a zinc layer thickness of at least 275 g/m2 - tablă zincată la cald "
    + "conform SR-EN 1506; garnituri duble EPDM; certificare EUROVENT. Diameter: Ø100 mm.";

  it("un rând de livrare nu primește sistem", () => {
    expect(extrage(LIVRARE, "lm", 14).sistem).toBeNull();
  });

  it("dar jachetarea adevărată rămâne poziție", () => {
    // Gardul celălalt: regula taie livrări, nu jachetări. Fără el, ar dispărea
    // exact munca firmei.
    expect(extrage("Supply and installation of aluminum sheet jacketing with a thickness of 0.6 mm "
      + "for outdoor ventilation ductwork", "m2", 1850).sistem).toBe("tabla");
    expect(extrage("Sistem complet de protectie mecanica a izolatiilor din tabla zincata", "mp", 10).sistem)
      .toBe("tabla");
  });
});

describe("un diametru nu e o grosime", () => {
  it("„Diameter: Ø100 mm” nu devine grosime de 100", () => {
    // 100 e o grosime plauzibilă de vată, deci se strecura ca atare.
    const l = extrage("Izolatii cu vata minerala pentru tubulatura. Diameter: Ø100 mm", "mp", 5);
    expect(l.grosime_mm).toBeNull();
  });

  it("dar o grosime scrisă ca atare se citește", () => {
    expect(extrage("Izolatii cu vata minerala Ø100 mm, grosime 50 mm", "ml", 5).grosime_mm).toBe(50);
  });
});

describe("unitatea de măsură nu se citește din densitatea zincului", () => {
  it("„275 g/m2” nu face forma mp", () => {
    const l = extrage("Izolatie vata minerala Ø100, tabla zincata 275 g/m2, grosime 50 mm", "lm", 14);
    expect(l.forma).not.toBe("mp");
  });

  it("`lm` e metru liniar", () => {
    // Parserul accepta `lm` ca unitate de masura de mult, dar tabelul de forme
    // nu-l avea — deci randul cadea pe textul liniei.
    expect(extrage("Izolatie vata minerala Ø100, grosime 50 mm", "lm", 14).forma).toBe("ml");
  });
});

describe("fiecare material își ia grosimea lui", () => {
  it("„Elastomer 13mm + MW 40mm” dă 13 la elastomer și 40 la vată", () => {
    // Euristica generala ia ULTIMA masura de pe rand, deci elastomerul primea
    // 40 mm — grosime pe care firma nici n-o ofertaza la elastomer
    // (9/13/19/25/32) — si pozitia iesea netarifata.
    const l = extrage("Wärmeisolierung DN80 Elastomer 13mm + vata minerala 40mm", "ml", 345);
    expect(l.sistem).toBe("elastomer");
    expect(l.grosime_mm).toBe(13);
    expect(l.straturi_extra).toEqual([{ sistem: "vata_minerala", grosime_mm: 40 }]);
  });

  it("pe un rând cu un singur material nu se schimbă nimic", () => {
    // Acolo euristica generala e mai buna: prinde si formularile in care
    // grosimea sta INAINTEA materialului.
    const l = extrage("Izolatii cu vata minerala si protectie cu tabla de aluminiu Di21, g40", "ml", 5);
    expect(l.sistem).toBe("vata_minerala");
    expect(l.grosime_mm).toBe(40);
  });
});

describe("tabla din care e făcută tubulatura nu e jachetă", () => {
  it("tubulatura SPIRO din Book15: vata rămâne singurul strat", () => {
    // Citit ca vată + jachetă de aluminiu, prețul urca de la 16,17 la
    // 30,77-56,08 €/ml, fără nicio marcă. „Tablă zincată" e din ce e făcută
    // tubulatura clientului, nu ce punem noi peste izolație.
    const l = extrage("Sistem de tubulatură circulară tip SPIRO, izolat cu vată minerală de 30 mm. "
      + "Caracteristici: realizat din tablă zincată la cald, cu un strat de zinc de minimum 275 g/m². "
      + "Diameter: Ø100 mm", "lm", 14);
    expect(l.sistem).toBe("vata_minerala");
    expect(l.straturi_extra).toEqual([]);
  });

  it("protecția la foc a tubulaturii nu e poziție de izolație", () => {
    expect(extrage("Protectie la foc EI 60 pentru tubulaturile din tabla zincata - torcret Parafoc 20 mm", "mp", 120)
      .sistem).toBeNull();
  });

  it("dar jacheta rămâne jachetă, oricum ar fi scrisă", () => {
    const straturi = (text: string, um: string) => extrage(text, um, 10).straturi_extra.map((s) => s.sistem);
    expect(straturi("Caseta izolatie armaturi cu flanse DN100 din tabla aluminiu si vata minerala", "buc"))
      .toEqual(["tabla"]);
    expect(straturi("Izolatie tubulatura circulara montata la interior cu armaflex de 40 mm, "
      + "protejata cu tabla zincata de 0.6 mm", "mp")).toEqual(["tabla"]);
    expect(straturi("Tubulatura realizata din tabla zincata, izolata cu vata minerala 50 mm "
      + "si jacketing de tabla de aluminiu", "mp")).toEqual(["tabla"]);
  });
});

describe("treceri prin pereți fără foc nu sunt închideri de gol", () => {
  it("țeava de instalații din Radoia nu devine închidere de gol", () => {
    expect(extrage("Teava din otel zincata serie medie, Dn 1\", imbinata prin cuplaje rapide,inclusiv fitinguri, "
      + "treceri prin pereti si plansee cu teava de protectie si etansari corespunzatoare", "m", 32).sistem)
      .toBeNull();
  });

  it("antetul de secțiune cu foc rămâne închidere de gol", () => {
    const l = extrageDeterminist(0, "Teava OL/OLZN DN15 | 130/130", "buc", "Teceri prin pereti rezistenti la foc EI30", 4).linie;
    expect(l.sistem).toBe("goluri_foc");
    expect(l.gol_latime_mm).toBe(130);
  });
});

describe("țolii sunt DN", () => {
  // Oferta 27.04.2026: toate șase ieșeau pe primul rând al listei (5,70 €/ml),
  // fiindcă „Ø1/2"" se citea ca diametrul exterior 1.
  it.each([
    ["Wärmeiso. aus expand. synthet. Kautschuk, d=9mm, Ø1/2\"", 15],
    ["Wärmeiso. aus expand. synthet. Kautschuk, d=9mm, Ø1 1/4\"", 32],
    ["Wärmeiso. aus expand. synthet. Kautschuk, d=9mm, Ø2\"", 50],
    ["Izolatie Armaflex 13 mm, teava avand diametrul Dn 2 1/2\"", 65],
    ["Izolatie Armaflex 13 mm Ф 57 x 3,5 mm (Dn 2\")", 50],
  ])("%s → DN%i", (text, dn) => {
    const l = extrage(text, "ml", 10);
    expect(l.diametru_tip).toBe("DN");
    expect(l.diametru_valoare).toBe(dn);
  });

  it("tolii din paranteză nu bat DN-ul scris", () => {
    expect(extrage("Armaflex ACE Plus sau similar Dn 25 (1'') 13 mm", "ml", 10).diametru_valoare).toBe(25);
  });

  it("fără ghilimea nu sunt țoli", () => {
    // „130/130" e o dimensiune de gol, nu 1/2".
    expect(extrage("Izolatie Armaflex 13 mm Ø 130/130", "ml", 10).diametru_valoare).toBe(130);
  });
});

describe("țeava PEHD cu grosimea peretelui lipită", () => {
  it("„PEHD D40x3.0” e diametrul exterior 40", () => {
    const l = extrage("Isolierung Armaflex PEHD D40x3.0 - Vakuumentwässerung | Izolatie Armaflex 9mm pentru tub PEHD D40", "m", 5);
    expect(l.diametru_tip).toBe("exterior");
    expect(l.diametru_valoare).toBe(40);
    expect(l.grosime_mm).toBe(9);
  });
});

describe("grosimea scrisă înaintea materialului", () => {
  it("rândul real DN80 din Oferta 27.04: elastomer 13 + vată 40 + tablă", () => {
    // Semnat 44,35 €/ml. Vata n-are niciun număr DUPĂ nume („...40mm vata
    // minerala + Fir incalzitor"), deci ieșea fără grosime, iar poziția cu
    // „grosime ambiguă".
    const l = extrage("Wärmeisolierung DN80 Elastomer 13mm + MW 40mm + Heizkabel | Izolarea termica a conductelor "
      + "cu cauciuc sintetic cu celule inchise (elastomer) cu bariera de vapori ridicata + vata minerala prevazuta "
      + "cu folie de aluminiu, protejata la exterior cu tabla zincata; complet cu adeziv, cu urmatoarele "
      + "grosimi:DN80 elastomer 13mm+40mm vata minerala + Fir incalzitor", "m", 345);
    expect(l.sistem).toBe("elastomer");
    expect(l.grosime_mm).toBe(13);
    expect(l.straturi_extra).toEqual([
      { sistem: "vata_minerala", grosime_mm: 40 },
      { sistem: "tabla", grosime_mm: null },
    ]);
  });

  it("o grosime a altui sistem nu se împrumută", () => {
    // 13 e grosime de elastomer; vata n-o are, deci nu i se dă.
    expect(extrage("Elastomer 13mm vata minerala DN50", "ml", 10).straturi_extra)
      .toEqual([{ sistem: "vata_minerala", grosime_mm: null }]);
  });
});

describe("unitățile de climatizare sunt altă meserie", () => {
  it("„Air conditioning unit” nu devine poziție de elastomer", () => {
    expect(extrage("Air conditioning unit, direct expansion type, with wall-mounted indoor unit, including "
      + "copper refrigerant piping insulated with elastomeric foam", "pcs", 4).sistem).toBeNull();
  });
});

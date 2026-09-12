/**
 * Ce NU e o poziție de izolație, și ce numere nu sunt grosimi.
 *
 * Toate cazurile de aici vin din `Book15.xlsx` și `Oferta 27.04.2026.xlsx`,
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

/**
 * Preferinta de bara laterala, in `localStorage`.
 *
 * Aceeasi regula ca la memoria de sabloane: depozitul e best-effort. In
 * fereastra privata sau cu stocarea blocata orice apel arunca, iar meniul NU
 * are voie sa se opreasca din asta — preferinta se pierde, navigatia ramane.
 */
import { describe, it, expect } from "vitest";
import {
  citesteMeniu, scrieMeniu, inverseaza, laCerere, stareEfectiva, FARA_CERERE, CHEIE_MENIU,
} from "../web/meniu-stare.js";

const depozitFals = (initial: Record<string, string> = {}): Storage => {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
    clear: () => { m.clear(); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
};

/** Depozit care arunca la orice atingere: fereastra privata, cookies blocate. */
const depozitStricat = (): Storage => new Proxy({} as Storage, {
  get() { throw new Error("acces refuzat"); },
});

describe("starea barei laterale", () => {
  it("implicitul e extins", () => {
    expect(citesteMeniu(depozitFals())).toBe("extins");
  });

  it("valoare necunoscuta in depozit nu inseamna pliat", () => {
    // O cheie ramasa de la o versiune veche nu are voie sa ascunda meniul.
    expect(citesteMeniu(depozitFals({ [CHEIE_MENIU]: "da" }))).toBe("extins");
  });

  it("pliat se scrie si se citeste inapoi", () => {
    const d = depozitFals();
    scrieMeniu("pliat", d);
    expect(d.getItem(CHEIE_MENIU)).toBe("pliat");
    expect(citesteMeniu(d)).toBe("pliat");
  });

  it("extins sterge cheia in loc s-o scrie", () => {
    // Implicitul nu are ce cauta in depozit: absenta si valoarea implicita
    // citesc la fel, dar cheia scrisa ar supravietui unei schimbari de implicit.
    const d = depozitFals({ [CHEIE_MENIU]: "pliat" });
    scrieMeniu("extins", d);
    expect(d.getItem(CHEIE_MENIU)).toBeNull();
  });

  it("un depozit care arunca nu opreste nimic", () => {
    expect(() => scrieMeniu("pliat", depozitStricat())).not.toThrow();
    expect(citesteMeniu(depozitStricat())).toBe("extins");
  });

  it("inverseaza comuta intre cele doua stari", () => {
    expect(inverseaza("extins")).toBe("pliat");
    expect(inverseaza("pliat")).toBe("extins");
  });
});

describe("plierea cerută de ecranul de import", () => {
  it("pliază temporar bara deschisă, fără să schimbe preferința", () => {
    const s = laCerere(FARA_CERERE, true, "extins", false);
    expect(stareEfectiva("extins", s)).toBe("pliat");
    expect(laCerere(s, false, "extins", false)).toEqual(FARA_CERERE);
    expect(stareEfectiva("extins", FARA_CERERE)).toBe("extins");
  });

  it("o redesenare nu închide din nou meniul redeschis de om", () => {
    const pliat = laCerere(FARA_CERERE, true, "extins", false);
    const redeschis = { ...pliat, pliatTemporar: false };
    const dupaRedesenare = laCerere(redeschis, true, "extins", false);
    expect(stareEfectiva("extins", dupaRedesenare)).toBe("extins");
  });

  it("pe telefon nu atinge nimic: acolo meniul e sertar și e deja închis", () => {
    expect(laCerere(FARA_CERERE, true, "extins", true).pliatTemporar).toBe(false);
  });

  it("bara pliată din preferință rămâne pliată și după retragerea cererii", () => {
    const s = laCerere(FARA_CERERE, true, "pliat", false);
    expect(s.pliatTemporar).toBe(false);
    expect(stareEfectiva("pliat", laCerere(s, false, "pliat", false))).toBe("pliat");
  });
});

/**
 * Memoria de sabloane a demo-ului, in `localStorage`.
 *
 * Testul are un `localStorage` fals: in Node nu exista, iar in browser accesul
 * la el poate arunca — fereastra privata, cookies blocate, capturi automate de
 * ecran. Memoria e o optimizare, nu o garantie: un depozit care crapa NU are
 * voie sa opreasca importul.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { stocLocal } from "../web/stoc-local.js";
import { invata } from "../src/import/memorie.js";
import type { LinieExtrasa } from "../src/import/schema.js";

const extras: LinieExtrasa = {
  index: 0, sistem: "elastomer", diametru_valoare: 25, diametru_tip: "DN",
  grosime_mm: 13, forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null,
  straturi_extra: [], incredere: 1, motiv: "corectat de om",
};
const TEXT = "Izolatie elastomer 13 mm pe teava DN25";

const localStorageFals = (): Storage => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
    clear: () => { m.clear(); },
    key: (i) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
};

const localStorageCareCrapa = (): Storage => ({
  getItem() { throw new Error("acces refuzat"); },
  setItem() { throw new Error("acces refuzat"); },
  removeItem() { throw new Error("acces refuzat"); },
  clear() { throw new Error("acces refuzat"); },
  key() { throw new Error("acces refuzat"); },
  length: 0,
} as unknown as Storage);

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageFals(), configurable: true, writable: true,
  });
});

describe("stocLocal", () => {
  it("pastreaza sablonul intre doua deschideri ale ecranului", () => {
    const s = invata(TEXT, extras)!;
    stocLocal().pune(s);
    // Alt obiect de depozit, aceeasi cheie: exact ce se intampla la reimport.
    expect(stocLocal().toate()).toEqual([s]);
  });

  it("reinvatarea inlocuieste sablonul, nu il dubleaza", () => {
    const stoc = stocLocal();
    stoc.pune(invata(TEXT, extras)!);
    // Rolul se schimba, nu valorile: 19 nu apare in TEXT, deci `invata` ar
    // refuza sablonul — exact cum trebuie.
    stoc.pune(invata(TEXT, { ...extras, sistem: "vata_minerala" })!);
    expect(stoc.toate()).toHaveLength(1);
  });

  it("sterge un sablon", () => {
    const stoc = stocLocal();
    const s = invata(TEXT, extras)!;
    stoc.pune(s);
    stoc.sterge(s.tipar);
    expect(stoc.toate()).toEqual([]);
  });

  it("se poarta ca un depozit gol cand localStorage arunca", () => {
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageCareCrapa(), configurable: true, writable: true,
    });
    const stoc = stocLocal();
    expect(stoc.toate()).toEqual([]);
    // Scrierea nu are voie sa arunce mai departe: ar opri importul.
    expect(() => stoc.pune(invata(TEXT, extras)!)).not.toThrow();
    expect(stoc.toate()).toEqual([]);
  });

  it("nu crapa pe continut stricat in localStorage", () => {
    localStorage.setItem("izorep-sabloane", "{ nu e json");
    expect(stocLocal().toate()).toEqual([]);
  });
});

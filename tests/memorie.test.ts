/**
 * L4: memoria de sabloane.
 *
 * Deduplicarea (`sabloane.test.ts`) lucreaza in interiorul unui import.
 * Memoria e acelasi mecanism peste importuri: ce a corectat omul o data nu se
 * mai intreaba. Testele de aici pazesc cele doua reguli care o fac sigura —
 * se invata doar de la om, si se memoreaza rolul, nu valorile.
 */
import { describe, it, expect } from "vitest";
import { aplicaMemorie, invata, stocInMemorie } from "../src/import/memorie.js";
import type { LinieExtrasa } from "../src/import/schema.js";

const linie = (p: Partial<LinieExtrasa> = {}): LinieExtrasa => ({
  index: 0, sistem: null, diametru_valoare: null, diametru_tip: null,
  grosime_mm: null, forma: null, gol_latime_mm: null, gol_inaltime_mm: null,
  straturi_extra: [], incredere: 0.9, motiv: "test", ...p,
});

const TEXT_A = "Izolatie elastomer 13 mm pe teava DN25 apa rece";
const TEXT_B = "Izolatie elastomer 19 mm pe teava DN80 apa rece";

const corectat = linie({
  index: 7, sistem: "elastomer", diametru_valoare: 25, diametru_tip: "DN",
  grosime_mm: 13, forma: "ml", incredere: 1,
});

describe("invatarea", () => {
  it("retine rolul si harta sloturilor, nu valorile", () => {
    const s = invata(TEXT_A, corectat)!;
    expect(s.tipar).toBe("izolatie elastomer # mm pe teava dn# apa rece");
    expect(s.harta.map((h) => h.camp)).toEqual(["diametru_valoare", "grosime_mm"]);
    expect(s.exemplu).toContain("DN25");
  });

  it("refuza sablonul ale carui valori nu se leaga de sloturi", () => {
    // DN50 dedus din 2'' e corect, dar nu se poate reciti pe alta linie.
    const dinToli = linie({ sistem: "elastomer", diametru_valoare: 50, diametru_tip: "DN", grosime_mm: 13 });
    expect(invata('Izolatie elastomer 13 mm pe teava 2"', dinToli)).toBeNull();
  });
});

describe("aplicarea", () => {
  it("rezolva o linie noua cu VALORILE ei, nu cu ale exemplului", () => {
    const stoc = stocInMemorie([invata(TEXT_A, corectat)!]);
    const { rezolvate, ramase } = aplicaMemorie([{ index: 3, text: TEXT_B }], stoc);
    expect(ramase).toEqual([]);
    const r = rezolvate[0]!;
    expect(r.sistem).toBe("elastomer");
    expect(r.diametru_tip).toBe("DN");
    expect(r.forma).toBe("ml");
    expect(r.diametru_valoare).toBe(80);
    expect(r.grosime_mm).toBe(19);
    expect(r.index).toBe(3);
    expect(r.motiv).toContain("corectie umana");
  });

  it("lasa mai departe liniile pe care nu le stie", () => {
    const stoc = stocInMemorie([invata(TEXT_A, corectat)!]);
    const linii = [{ index: 1, text: TEXT_B }, { index: 2, text: "Cu totul altceva, 40 mm" }];
    const { rezolvate, ramase } = aplicaMemorie(linii, stoc);
    expect(rezolvate.map((r) => r.index)).toEqual([1]);
    expect(ramase.map((l) => l.index)).toEqual([2]);
  });

  it("un sablon reinvatat il inlocuieste pe cel vechi", () => {
    const stoc = stocInMemorie([invata(TEXT_A, corectat)!]);
    stoc.pune(invata(TEXT_A, { ...corectat, sistem: "vata_minerala" })!);
    expect(stoc.toate()).toHaveLength(1);
    expect(aplicaMemorie([{ index: 3, text: TEXT_B }], stoc).rezolvate[0]!.sistem).toBe("vata_minerala");
  });

  it("memoria goala nu schimba nimic", () => {
    const linii = [{ index: 1, text: TEXT_A }];
    const { rezolvate, ramase } = aplicaMemorie(linii, stocInMemorie());
    expect(rezolvate).toEqual([]);
    expect(ramase).toEqual(linii);
  });
});

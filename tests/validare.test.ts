/**
 * Fluxul de validare din ecranul de import: filtrele si confirmarea in masa.
 * Logica sta in `web/validare.ts`, pura si fara DOM, exact ca sa poata fi
 * testata direct aici.
 */
import { describe, it, expect } from "vitest";
import { anuleaza, confirma, potrivit, type Filtru } from "../web/validare.js";
import type { LinieProcesata } from "../src/import/nucleu.js";
import type { LinieExtrasa, Sursa } from "../src/import/schema.js";

const extrasa = (p: Partial<LinieExtrasa> & { index: number }): LinieExtrasa => ({
  sistem: "elastomer", diametru_valoare: 50, diametru_tip: "DN", grosime_mm: 13,
  forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [],
  incredere: 0.9, motiv: "test",
  ...p,
});

const bruta = (index: number, text = "linie") => ({ index, text });

const linie = (p: {
  index: number;
  sursa?: Sursa;
  necesitaValidare?: boolean;
  extras?: Partial<LinieExtrasa>;
  /** true = pozitia are deja un pret calculat (continutul exact nu conteaza aici). */
  arePret?: boolean;
}): LinieProcesata => {
  const l: LinieProcesata = {
    bruta: bruta(p.index) as LinieProcesata["bruta"],
    extras: extrasa({ index: p.index, ...p.extras }),
    sursa: p.sursa ?? "regex",
    necesitaValidare: p.necesitaValidare ?? false,
  };
  if (p.arePret) {
    l.pret = { pret_unitar: 10, cantitate: 1, total: 10 } as NonNullable<LinieProcesata["pret"]>;
  }
  return l;
};

describe("potrivit", () => {
  it("'toate' selecteaza orice linie, indiferent de stare", () => {
    const l1 = linie({ index: 1, necesitaValidare: true });
    const l2 = linie({ index: 2, necesitaValidare: false });
    expect(potrivit(l1, "toate")).toBe(true);
    expect(potrivit(l2, "toate")).toBe(true);
  });

  it("'de_validat' urmeaza exact necesitaValidare", () => {
    const daValidat = linie({ index: 1, necesitaValidare: true });
    const nuValidat = linie({ index: 2, necesitaValidare: false });
    expect(potrivit(daValidat, "de_validat")).toBe(true);
    expect(potrivit(nuValidat, "de_validat")).toBe(false);
  });

  it("'netarifate' cere pozitie de izolatie (sistem non-null) fara pret", () => {
    const faraPret = linie({ index: 1, extras: { sistem: "elastomer" } });
    const cuPret = linie({ index: 2, extras: { sistem: "elastomer" }, arePret: true });
    expect(potrivit(faraPret, "netarifate")).toBe(true);
    expect(potrivit(cuPret, "netarifate")).toBe(false);
  });

  it("o linie care nu e pozitie de izolatie nu intra la 'netarifate', chiar fara pret", () => {
    // Un antet de sectiune sau un rand de total n-are sistem si n-are pret —
    // dar nu e o problema de rezolvat, e zgomot. Filtrul trebuie sa-l ignore.
    const notaSauAntet = linie({ index: 1, extras: { sistem: null } });
    expect(potrivit(notaSauAntet, "netarifate")).toBe(false);
  });

  it("acopera toate valorile lui Filtru", () => {
    const filtre: Filtru[] = ["toate", "de_validat", "netarifate"];
    const l = linie({ index: 1 });
    for (const f of filtre) expect(() => potrivit(l, f)).not.toThrow();
  });
});

describe("confirma", () => {
  it("pune sursa 'om' si intoarce instantaneul cu valorile vechi", () => {
    const rezolvate = new Map<number, { extras: LinieExtrasa; sursa: Sursa }>([
      [1, { extras: extrasa({ index: 1, sistem: "elastomer" }), sursa: "model" }],
      [2, { extras: extrasa({ index: 2, sistem: "vata_minerala" }), sursa: "sablon" }],
    ]);

    const inst = confirma([1, 2], rezolvate);

    expect(rezolvate.get(1)!.sursa).toBe("om");
    expect(rezolvate.get(2)!.sursa).toBe("om");
    // Valorile extrase raman neatinse: confirmarea schimba doar sursa.
    expect(rezolvate.get(1)!.extras.sistem).toBe("elastomer");
    expect(rezolvate.get(2)!.extras.sistem).toBe("vata_minerala");

    expect(inst.intrari).toHaveLength(2);
    expect(inst.intrari.find((i) => i.index === 1)?.sursa).toBe("model");
    expect(inst.intrari.find((i) => i.index === 2)?.sursa).toBe("sablon");
  });

  it("o linie deja 'om' e no-op si nu intra in instantaneu", () => {
    const original = extrasa({ index: 1, sistem: "elastomer" });
    const rezolvate = new Map<number, { extras: LinieExtrasa; sursa: Sursa }>([
      [1, { extras: original, sursa: "om" }],
    ]);

    const inst = confirma([1], rezolvate);

    expect(inst.intrari).toHaveLength(0);
    expect(rezolvate.get(1)).toEqual({ extras: original, sursa: "om" });
  });

  it("ignora indecsi care nu exista in rezolvate", () => {
    const rezolvate = new Map<number, { extras: LinieExtrasa; sursa: Sursa }>();
    const inst = confirma([99], rezolvate);
    expect(inst.intrari).toHaveLength(0);
  });

  it("un amestec de linii noi si deja confirmate: doar cele noi intra in instantaneu", () => {
    const rezolvate = new Map<number, { extras: LinieExtrasa; sursa: Sursa }>([
      [1, { extras: extrasa({ index: 1 }), sursa: "model" }],
      [2, { extras: extrasa({ index: 2 }), sursa: "om" }],
    ]);

    const inst = confirma([1, 2], rezolvate);

    expect(inst.intrari.map((i) => i.index)).toEqual([1]);
    expect(rezolvate.get(1)!.sursa).toBe("om");
    expect(rezolvate.get(2)!.sursa).toBe("om");
  });
});

describe("anuleaza", () => {
  it("restaureaza exact starea dinainte, inclusiv sursa", () => {
    const extrasVechi = extrasa({ index: 1, sistem: "elastomer", diametru_valoare: 50 });
    const rezolvate = new Map<number, { extras: LinieExtrasa; sursa: Sursa }>([
      [1, { extras: extrasVechi, sursa: "model" }],
    ]);

    const inst = confirma([1], rezolvate);
    // Intre confirmare si anulare linia ar putea fi editata din nou de om —
    // simulam prin inlocuirea din map, ca sa verificam ca anuleaza() pune
    // inapoi EXACT ce era in instantaneu, nu ce e in map la momentul apelului.
    rezolvate.set(1, { extras: extrasa({ index: 1, sistem: "vata_minerala" }), sursa: "om" });

    anuleaza(inst, rezolvate);

    expect(rezolvate.get(1)).toEqual({ extras: extrasVechi, sursa: "model" });
  });

  it("nu atinge liniile din afara instantaneului", () => {
    const rezolvate = new Map<number, { extras: LinieExtrasa; sursa: Sursa }>([
      [1, { extras: extrasa({ index: 1 }), sursa: "model" }],
      [2, { extras: extrasa({ index: 2 }), sursa: "regex" }],
    ]);

    const inst = confirma([1], rezolvate);
    anuleaza(inst, rezolvate);

    expect(rezolvate.get(2)!.sursa).toBe("regex");
  });

  it("confirma urmata de anuleaza da starea initiala", () => {
    const rezolvate = new Map<number, { extras: LinieExtrasa; sursa: Sursa }>([
      [1, { extras: extrasa({ index: 1 }), sursa: "model" }],
      [2, { extras: extrasa({ index: 2 }), sursa: "sablon" }],
      [3, { extras: extrasa({ index: 3 }), sursa: "memorie" }],
    ]);
    const initial = new Map(rezolvate);

    const inst = confirma([1, 2, 3], rezolvate);
    expect([...rezolvate.values()].every((r) => r.sursa === "om")).toBe(true);

    anuleaza(inst, rezolvate);
    expect(rezolvate).toEqual(initial);
  });
});

/**
 * Fluxul de validare din ecranul de import: filtrele si confirmarea in masa.
 * Logica sta in `web/validare.ts`, pura si fara DOM, exact ca sa poata fi
 * testata direct aici.
 */
import { describe, it, expect } from "vitest";
import {
  anuleaza, confirma, potrivit,
} from "../web/validare.js";
import { imparte } from "../web/oferta.js";
import type { Avertisment, CodNetarifare } from "../src/import/nucleu.js";
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
  codEroare?: CodNetarifare;
  avertismente?: Avertisment[];
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
  if (p.codEroare) l.codEroare = p.codEroare;
  if (p.avertismente) l.avertismente = p.avertismente;
  return l;
};


describe("potrivit", () => {
  it("'gata' e exact ce pleaca in oferta: pret, fara marcaj, pozitie de izolatie", () => {
    expect(potrivit(linie({ index: 1, arePret: true }), "gata")).toBe(true);
    expect(potrivit(linie({ index: 2, arePret: true, necesitaValidare: true }), "gata")).toBe(false);
    expect(potrivit(linie({ index: 3 }), "gata")).toBe(false);
    expect(potrivit(linie({ index: 4, arePret: true, extras: { sistem: null } }), "gata")).toBe(false);
  });

  it("gramezile sunt cele din `imparte`: fiecare pozitie cade in exact una", () => {
    const linii = [
      linie({ index: 1, arePret: true }),
      linie({ index: 2, arePret: true, necesitaValidare: true }),
      linie({ index: 3, necesitaValidare: true }),
      linie({ index: 4 }),
      linie({ index: 5, extras: { sistem: null } }),
    ];
    const { oferta, deValidat, netarifate } = imparte(linii);
    expect(linii.filter((l) => potrivit(l, "gata"))).toEqual(oferta);
    expect(linii.filter((l) => potrivit(l, "de_validat"))).toEqual(deValidat);
    expect(linii.filter((l) => potrivit(l, "netarifate"))).toEqual(netarifate);
    for (const l of linii.filter((x) => x.extras.sistem !== null)) {
      expect((["gata", "de_validat", "netarifate"] as const).filter((f) => potrivit(l, f))).toHaveLength(1);
    }
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

});

describe("anuleaza", () => {
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


/* ------------------------------------------------------------------ *
 * Lentila pe cauza si blocul „Ce blocheaza N pozitii"
 * ------------------------------------------------------------------ */

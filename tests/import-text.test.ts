/**
 * Cuvintele ecranului de import (`web/import/text.ts`).
 *
 * Ecranul il folosesc oameni care nu lucreaza cu termenii nostri. Testele de
 * aici apara doua lucruri: niciun cod intern nu ajunge pe ecran fara traducere,
 * iar starea unei pozitii e aceeasi cu foaia registrului in care pleaca.
 */
import { describe, it, expect } from "vitest";
import type { Avertisment, CodNetarifare, LinieProcesata } from "../src/import/nucleu.js";
import type { LinieExtrasa } from "../src/import/schema.js";
import { ETICHETE_BLOCAJ } from "../web/validare.js";
import { imparte } from "../web/oferta.js";
import { MOTIV, diametruText, inteles, motiveLinie, stareLinie } from "../web/import/text.js";

const extrasa = (p: Partial<LinieExtrasa> = {}): LinieExtrasa => ({
  index: 1, sistem: "vata_minerala", diametru_valoare: 100, diametru_tip: "DN", grosime_mm: 50,
  forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [], incredere: 0.99, motiv: "",
  ...p,
});

const linie = (p: {
  extras?: Partial<LinieExtrasa>; pret?: boolean; validare?: boolean;
  cod?: CodNetarifare; avertismente?: Avertisment[]; motive?: ("grosime_propusa" | "segment_diferit")[];
} = {}): LinieProcesata => ({
  bruta: { index: 1, foaie: "F", rand: 7, text: "t", celule: [] },
  extras: extrasa(p.extras),
  sursa: "regex",
  necesitaValidare: p.validare ?? false,
  ...(p.pret ? { pret: { pret_unitar: 1, cantitate: 1, total: 1, motiveDeVerificat: p.motive ?? [] } as unknown as NonNullable<LinieProcesata["pret"]> } : {}),
  ...(p.cod ? { codEroare: p.cod } : {}),
  ...(p.avertismente ? { avertismente: p.avertismente } : {}),
});

describe("niciun cod intern pe ecran", () => {
  it("fiecare cauza din registru are si varianta scurta, fara cod", () => {
    for (const cod of Object.keys(ETICHETE_BLOCAJ) as (keyof typeof ETICHETE_BLOCAJ)[]) {
      expect(MOTIV[cod], cod).toBeTruthy();
      expect(MOTIV[cod], cod).not.toMatch(/_/);
    }
  });

  it("motivele de verificare au text", () => {
    for (const m of ["segment_diferit", "rotunjire_neconfirmata", "grosime_propusa", "citit_nesigur", "pret_necunoscut"] as const) {
      expect(MOTIV[m]).toBeTruthy();
    }
  });
});

describe("ce am înțeles din rând", () => {
  it("material cu grosime, stratul de deasupra, diametrul și piesa", () => {
    expect(inteles(extrasa({
      forma: "flansa", straturi_extra: [{ sistem: "tabla", grosime_mm: null }],
    }))).toEqual(["Vată minerală 50 mm", "+ Tablă aluminiu", "DN100", "flanșă"]);
  });

  it("metrul liniar nu se mai scrie; grosimea lipsă nici ea", () => {
    expect(inteles(extrasa({ grosime_mm: null, diametru_tip: "exterior", diametru_valoare: 160 })))
      .toEqual(["Vată minerală", "Ø160"]);
  });

  it("închiderea la foc arată golul, nu diametrul", () => {
    expect(inteles(extrasa({ sistem: "goluri_foc", gol_latime_mm: 130, gol_inaltime_mm: 130 })))
      .toEqual(["Închidere gol la foc", "gol 130×130 mm"]);
  });

  it("un rând care nu e izolație nu are ce arăta", () => {
    expect(inteles(extrasa({ sistem: null }))).toEqual([]);
  });

  it("zecimalele cu virgulă, ca în România", () => {
    expect(diametruText({ diametru_valoare: 60.3, diametru_tip: "exterior" })).toBe("Ø60,3");
    expect(diametruText({ diametru_valoare: 60, diametru_tip: "interior" })).toBe("Di60");
  });
});

describe("starea și motivul", () => {
  const gata = linie({ pret: true });
  const deVerificat = linie({ pret: true, validare: true, motive: ["grosime_propusa"] });
  const nesigur = linie({ pret: true, validare: true });
  const faraPret = linie({ validare: true, cod: "grosime_ambigua" });

  it("starea e foaia registrului în care pleacă poziția", () => {
    const linii = [gata, deVerificat, nesigur, faraPret];
    const { oferta, deValidat, netarifate } = imparte(linii);
    expect(linii.filter((l) => stareLinie(l) === "gata")).toEqual(oferta);
    expect(linii.filter((l) => stareLinie(l) === "de_validat")).toEqual(deValidat);
    expect(linii.filter((l) => stareLinie(l) === "netarifate")).toEqual(netarifate);
  });

  it("motivele vin din cod, nu din text", () => {
    expect(motiveLinie(gata)).toEqual([]);
    expect(motiveLinie(faraPret)).toEqual(["grosime_ambigua"]);
    expect(motiveLinie(deVerificat)).toEqual(["grosime_propusa"]);
    expect(motiveLinie(linie({ pret: true, validare: true, avertismente: [{ cod: "diametru_necitat", mesaj: "x" }] })))
      .toEqual(["diametru_necitat"]);
  });

  it("o poziție marcată fără motiv explicit e „citită nesigur”, nu goală", () => {
    expect(motiveLinie(nesigur)).toEqual(["citit_nesigur"]);
  });

  it("fără preț și fără cod: tot un motiv, nu nimic", () => {
    expect(motiveLinie(linie({ validare: true }))).toEqual(["pret_necunoscut"]);
  });
});

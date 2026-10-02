/**
 * Măsurătorile din timpul lucrării, puse pe pozițiile planului
 * (`src/lucrari/potrivire.ts`).
 *
 * Ce se apără: un rând executat ajunge pe poziția lui doar când e aceeași
 * lucrare (același import, aceleași straturi), oricum ar fi fost scris; când
 * sunt mai multe poziții posibile și zona nu decide, nu se ghicește.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseFoiBuffer } from "../src/import/parse-workbook.js";
import { proceseazaRegistru } from "../src/import/nucleu.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { registruCerere } from "../src/santier/registru.js";
import { spreCerere, type LinieCerere } from "../src/santier/spre-cerere.js";
import type { RandSantier } from "../src/santier/agrega.js";
import { executatDinMasuratori, potriveste } from "../src/lucrari/potrivire.js";
import { situatieNoua, totalSituatie, valoareOferta } from "../src/lucrari/situatii.js";
import { planDinOferta, type AntetOferta } from "../web/oferta.js";

const ANTET: AntetOferta = {
  serie: "RAD", numar: "1", data: "02.10.2026", persoana: "", client: "Client", obiectiv: "Test",
  firma: "RADOIA ISOLIRUNG SRL", localitate: "PALTINIS",
};

/** Planul unei oferte făcute din liniile date ca cerere, cu toate pozițiile confirmate. */
async function planDin(linii: LinieCerere[]) {
  const foi = await parseFoiBuffer(await registruCerere(linii, "Cerere"));
  const rez = await proceseazaRegistru(foi, { stoc: stocInMemorie() });
  const confirmate = rez.linii.map((l) => ({ ...l, necesitaValidare: false }));
  return planDinOferta(
    { linii: confirmate, antet: ANTET, provenienta: { generatLa: "2026-10-02T10:00:00.000Z", destinatie: "rezidential", model: null, sesiune: "s", fisierSursa: "cerere.xlsx" } },
    "S-1", new Map(rez.brute.map((b) => [b.index, b.sectiune ?? ""])),
  );
}

const rand = (r: Partial<RandSantier>): RandSantier => ({
  id: "", zona: "Zona 1", diametru_valoare: 60, diametru_tip: "exterior", izolatie: "vata_minerala", grosime_mm: 50,
  jacheta: "aluminiu", element: "ml", pret_dublu: false, cantitate: 10, termeni: [], nesigur: false, ...r,
});

describe("potrivirea măsurătorilor cu planul", () => {
  it("Ecoterm: oferta făcută din poze, apoi aceleași poze ca executat tot → situația dă exact valoarea ofertei", async () => {
    const ref = JSON.parse(readFileSync("tests/fixtures-santier-ecoterm.json", "utf8")) as {
      pagini: { randuri: (Omit<RandSantier, "id" | "termeni" | "nesigur"> & { nesigur?: boolean })[] }[];
    };
    const randuri = ref.pagini.flatMap((p) => p.randuri.map((r) => ({ ...r, id: "", termeni: [], nesigur: false })));
    const plan = await planDin(spreCerere(randuri));
    const p = potriveste(plan, await executatDinMasuratori(randuri, "rezidential"));
    expect(p.nepotrivite).toEqual([]);
    expect(p.deAles).toEqual([]);
    const s = { ...situatieNoua(plan, "x", "2026-10-02"), cantitati: p.cantitati };
    expect(totalSituatie(plan, s).curent.total).toBe(valoareOferta(plan).total);
  });

  it("notația nu contează: DN50 în cererea clientului, ø60 în carnet", async () => {
    const plan = await planDin([
      { zona: "Subsol", text: "Izolatii cu vata minerala 50 mm si protectie cu tabla de aluminiu DN50", um: "ml", cantitate: 40 },
    ]);
    const p = potriveste(plan, await executatDinMasuratori([rand({ diametru_valoare: 60, cantitate: 12 })], "rezidential"));
    expect(p.cantitati).toEqual({ 1: 12 });
  });

  it("alt diametru, altă grosime sau cot în loc de metru: nu e aceeași poziție", async () => {
    const plan = await planDin([{ zona: "Z", text: "Izolatie conducta ø60 cu vata minerala 50 mm si protectie cu tabla de aluminiu", um: "ml", cantitate: 40 }]);
    const p = potriveste(plan, await executatDinMasuratori([
      rand({ diametru_valoare: 89 }), rand({ grosime_mm: 30 }), rand({ element: "cot", cantitate: 4 }),
    ], "rezidential"));
    expect(p.cantitati).toEqual({});
    expect(p.nepotrivite).toHaveLength(3);
  });

  it("aceeași lucrare pe două zone: decide zona; fără zonă potrivită, alege omul", async () => {
    const text = "Izolatie conducta ø60 cu vata minerala 50 mm si protectie cu tabla de aluminiu";
    const plan = await planDin([
      { zona: "Parter", text, um: "ml", cantitate: 40 },
      { zona: "Etaj 1", text, um: "ml", cantitate: 30 },
    ]);
    const p = potriveste(plan, await executatDinMasuratori([
      rand({ zona: "Etaj 1", cantitate: 7 }), rand({ zona: "Acoperiș", cantitate: 3 }),
    ], "rezidential"));
    expect(p.cantitati).toEqual({ 2: 7 });
    expect(p.deAles.map((x) => x.pozitii)).toEqual([[1, 2]]);
  });

  it("planul făcut înainte de amprente: nimic nu se pune, și se spune de ce", async () => {
    const plan = await planDin([{ zona: "Z", text: "Izolatie conducta ø60 cu vata minerala 50 mm si protectie cu tabla de aluminiu", um: "ml", cantitate: 40 }]);
    const vechi = { ...plan, pozitii: plan.pozitii.map(({ amprenta: _a, zona: _z, ...x }) => x) };
    const p = potriveste(vechi, await executatDinMasuratori([rand({})], "rezidential"));
    expect(p.planVechi).toBe(true);
    expect(p.cantitati).toEqual({});
    expect(p.nepotrivite).toHaveLength(1);
  });
});

/**
 * Lista clientului față de măsurătorile de pe teren (întrebarea tehnică 1:
 * „și, și” — firma măsoară și când clientul a trimis o listă).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseFoiBuffer } from "../src/import/parse-workbook.js";
import { proceseazaRegistru } from "../src/import/nucleu.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { redeschideImport } from "../src/import/redeschide.js";
import { registruCerere } from "../src/santier/registru.js";
import { spreCerere, type LinieCerere } from "../src/santier/spre-cerere.js";
import type { RandSantier } from "../src/santier/agrega.js";
import { executatDinMasuratori } from "../src/lucrari/potrivire.js";
import { comparaCuLista, randuriDinLista } from "../src/lucrari/comparatie.js";

async function lista(linii: LinieCerere[]) {
  const buf = await registruCerere(linii, "Cerere");
  return (await proceseazaRegistru(await parseFoiBuffer(buf), { stoc: stocInMemorie() })).linii;
}

const rand = (r: Partial<RandSantier>): RandSantier => ({
  id: "", zona: "Zona 1", diametru_valoare: 60, diametru_tip: "exterior", izolatie: "vata_minerala", grosime_mm: 50,
  jacheta: "aluminiu", element: "ml", pret_dublu: false, cantitate: 10, termeni: [], nesigur: false, ...r,
});

describe("lista clientului față de măsurători", () => {
  it("Ecoterm: aceleași pagini ca listă și ca măsurători → toate la fel", async () => {
    const ref = JSON.parse(readFileSync("tests/fixtures-santier-ecoterm.json", "utf8")) as {
      pagini: { randuri: (Omit<RandSantier, "id" | "termeni" | "nesigur">)[] }[];
    };
    const randuri = ref.pagini.flatMap((p) => p.randuri.map((r) => ({ ...r, id: "", termeni: [], nesigur: false })));
    const c = comparaCuLista(randuriDinLista(await lista(spreCerere(randuri))), await executatDinMasuratori(randuri, "rezidential"));
    expect(c.necomparabile).toEqual([]);
    expect(c.pozitii.length).toBeGreaterThan(10);
    expect(c.pozitii.filter((p) => p.stare !== "la_fel")).toEqual([]);
  });

  it("DN50 în listă și ø60 în carnet sunt aceeași poziție; cantitățile se adună pe zone", async () => {
    const l = await lista([
      { zona: "Subsol", text: "Izolatii cu vata minerala 50 mm si protectie cu tabla de aluminiu DN50", um: "ml", cantitate: 40 },
    ]);
    const m = await executatDinMasuratori([
      rand({ zona: "Subsol", cantitate: 30 }), rand({ zona: "Parter", cantitate: 15 }),
    ], "rezidential");
    const [p] = comparaCuLista(randuriDinLista(l), m).pozitii;
    expect(p).toMatchObject({ lista: 40, masurat: 45, stare: "diferit" });
  });

  it("ce lipsește dintr-o parte se vede: nemăsurat, sau uitat din listă", async () => {
    const l = await lista([
      { zona: "Z", text: "Izolatii cu vata minerala 50 mm si protectie cu tabla de aluminiu DN50", um: "ml", cantitate: 40 },
    ]);
    const m = await executatDinMasuratori([rand({ diametru_valoare: 89, cantitate: 12 })], "rezidential");
    const stari = comparaCuLista(randuriDinLista(l), m).pozitii.map((p) => p.stare);
    expect(stari).toEqual(["doar_in_lista", "doar_masurat"]);
  });

  it("diferența de rotunjire (sub 1%) nu e cantitate diferită", async () => {
    const l = await lista([
      { zona: "Z", text: "Izolatii cu vata minerala 50 mm si protectie cu tabla de aluminiu DN50", um: "ml", cantitate: 100 },
    ]);
    const m = await executatDinMasuratori([rand({ cantitate: 100.5 })], "rezidential");
    expect(comparaCuLista(randuriDinLista(l), m).pozitii[0]!.stare).toBe("la_fel");
  });
});

describe("importul salvat, refăcut fără model", () => {
  it("dă aceleași poziții ca importul inițial, iar extragerile salvate bat recitirea", async () => {
    const buf = await registruCerere([
      { zona: "Z", text: "Izolatii cu vata minerala 50 mm si protectie cu tabla de aluminiu DN50", um: "ml", cantitate: 40 },
      { zona: "Z", text: "Izolatie elastomer 13 mm pe teava DN25 apa rece", um: "ml", cantitate: 10 },
    ], "Cerere");
    const initial = await proceseazaRegistru(await parseFoiBuffer(buf), { stoc: stocInMemorie() });
    const elastomer = initial.linii.find((l) => l.extras.sistem === "elastomer")!;
    // Omul a corectat grosimea elastomerului la 19 mm, în ecranul de import.
    const extrase = [{ index: elastomer.extras.index, extras: { ...elastomer.extras, grosime_mm: 19 }, sursa: "om" as const, text: elastomer.bruta.text }];
    const rez = await redeschideImport({ fisier: buf, editari: [], extrase }, { stoc: stocInMemorie() });
    expect(rez.linii.filter((l) => l.extras.sistem !== null)).toHaveLength(2);
    expect(rez.linii.find((l) => l.extras.sistem === "elastomer")!.extras.grosime_mm).toBe(19);
  });
});

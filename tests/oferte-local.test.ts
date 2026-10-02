/**
 * Ofertele descărcate, pe importul lor (`web/oferte-local.ts`): ce se șterge
 * dintr-un loc dispare și din „Cereri și oferte”.
 */
import { describe, it, expect } from "vitest";
import { citesteOferte, noteazaOferta, uitaOferta, type OfertaEmisa } from "../web/oferte-local.js";

const memorie = (): Storage => {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k),
    clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; },
  };
};
const oferta = (numar: string): OfertaEmisa => ({
  numar, data: "02.10.2026", client: "C", obiectiv: "", valoare: 100, pozitii: 1, cand: "2026-10-02T10:00:00.000Z",
});

describe("ofertele descărcate", () => {
  it("ultima ofertă din același import o înlocuiește pe cea veche; ștearsă, dispare doar ea", () => {
    const d = memorie();
    noteazaOferta("a", oferta("RAD1"), d);
    noteazaOferta("a", oferta("RAD2"), d);
    noteazaOferta("b", oferta("RAD3"), d);
    expect(citesteOferte(d)["a"]!.numar).toBe("RAD2");
    uitaOferta("a", d);
    expect(Object.keys(citesteOferte(d))).toEqual(["b"]);
  });

  it("stocare stricată sau lipsă: lista e goală, nu cade", () => {
    const d = memorie();
    d.setItem("izorep-oferte-emise", "{nu e json");
    expect(citesteOferte(d)).toEqual({});
  });
});

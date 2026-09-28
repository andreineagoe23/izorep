/** Pastrarea locala a prototipului de stoc (`web/depozit-local.ts`). */
import { describe, it, expect } from "vitest";
import { CHEIE_DEPOZIT, citesteDepozit, scrieDepozit, type StareDepozit } from "../web/depozit-local.js";
import { articolDin } from "../src/stoc/registru.js";

class Memorie implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const blocat = new Proxy({} as Storage, { get() { throw new Error("SecurityError"); } });

describe("stocul prototipului, în browser", () => {
  it("ce se scrie se citește înapoi", () => {
    const d = new Memorie();
    const s: StareDepozit = {
      miscari: [{ id: "a", data: "2026-09-29", tip: "intrare", cantitate: 3, spre: "central",
        articol: articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 114 }) }],
      necesare: [],
    };
    expect(scrieDepozit(s, d)).toBe(true);
    expect(citesteDepozit(d)).toEqual(s);
  });

  it("gol, stricat sau blocat: pornește gol, nu cade", () => {
    const d = new Memorie();
    expect(citesteDepozit(d)).toEqual({ miscari: [], necesare: [] });
    d.setItem(CHEIE_DEPOZIT, "{nu e json");
    expect(citesteDepozit(d)).toEqual({ miscari: [], necesare: [] });
    expect(citesteDepozit(blocat)).toEqual({ miscari: [], necesare: [] });
    expect(scrieDepozit({ miscari: [], necesare: [] }, blocat)).toBe(false);
  });
});

/**
 * `web/date.ts`, Faza 6: situatia salvata scrie consumul, stearsa il anuleaza.
 * Pe server pleaca doar operatia situatiei (consumul il calculeaza serverul,
 * cu aceleasi id-uri); pe linkul demo, totul ramane in browser.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanSantier } from "../src/lucrari/situatii.js";
import type { MaterialNecesar } from "../src/stoc/necesar.js";
import { articolDin, solduri, type Miscare } from "../src/stoc/registru.js";

const cereri: string[] = [];
let server = true;

const tub: MaterialNecesar = {
  cheie: "elastomer|tub|19|22", sistem: "elastomer", grosime_mm: 19, rand: 22, categorie: "tub",
  ml: 40, m2: 0, piese: 0, piesePresupuse: 0, pierdere: 0, pozitii: 1, pePozitie: [{ pozitie: 1, peUnitate: 1 }], valoareOferta: 300,
};
const plan: PlanSantier = {
  id: "S-1", creat: "2026-10-11T08:00:00.000Z", denumire: "T", client: "C", firma: "RADOIA ISOLIRUNG SRL",
  oferta: "", fisier: "t.xlsx", destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0,
  pozitii: [{ nr: 1, denumire: "p", um: "ml", cantitate: 40, pretUnitar: 5, foc: false }], situatii: [],
};
const intrare: Miscare = { id: "i1", data: "2026-10-11T08:00:00.000Z", tip: "intrare", articol: articolDin(tub), cantitate: 42, spre: "S-1" };
const stare = () => ({
  planuri: [plan],
  depozit: { miscari: [intrare], necesare: [{ id: "n1", creat: "x", fisier: "t.xlsx", obiectiv: "T", santier: "S-1", materiale: [tub], faraNecesar: 0 }] },
  oferte: {},
});

beforeEach(() => {
  cereri.length = 0;
  vi.resetModules();
  const mem = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0,
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const metoda = init?.method ?? "GET";
    if (metoda !== "GET") cereri.push(`${metoda} ${url}`);
    if (!server) return new Response("", { status: 404 });
    const json = (c: unknown) => new Response(JSON.stringify(c), { status: 200, headers: { "content-type": "application/json" } });
    if (url === "/api/stare") return json({ firma: "RADOIA" });
    if (url === "/api/date") return json(stare());
    return json({ ok: true, consum: 1 });
  }));
});

const toata = { id: "s1", nr: 1, data: "2026-10-11T12:00:00.000Z", cantitati: { 1: 40 } };

describe("situația și consumul ei, în web/date.ts", () => {
  it("pe server: pleacă doar situația; copia are consumul; ștearsă, pleacă DELETE și copia are storno-ul", async () => {
    server = true;
    const d = await import("../web/date.js");
    expect(await d.porneste()).toBe("server");
    expect(d.salveazaSituatie("S-1", toata)).toEqual({ consum: 1 });
    const consum = d.citesteDepozit().miscari.filter((m) => m.situatieId === "s1");
    expect(consum.map((m) => [m.cantitate, m.din])).toEqual([[40, "S-1"]]);
    // O scriere a depozitului din ecran nu retrimite consumul.
    d.scrieDepozit(d.citesteDepozit());
    expect(d.stergeUltimaSituatie("S-1")).toBeNull();
    expect(solduri(d.citesteDepozit().miscari).map((s) => s.cantitate)).toEqual([42]);
    expect(d.citestePlanuri()[0]!.situatii).toEqual([]);
    await new Promise((r) => setTimeout(r, 20));
    expect(cereri).toEqual(["POST /api/santiere/S-1/situatii", "DELETE /api/santiere/S-1/situatii/1?id=s1"]);
  });

  it("pe linkul demo: situația și consumul stau în browser, la fel", async () => {
    server = false;
    const d = await import("../web/date.js");
    expect(await d.porneste()).toBe("browser");
    // Ce era în browser: șantierul, necesarul, intrarea.
    const { scriePlanuri } = await import("../web/lucrari-local.js");
    const { scrieDepozit } = await import("../web/depozit-local.js");
    scriePlanuri([plan]);
    scrieDepozit(stare().depozit);
    expect(d.salveazaSituatie("S-1", toata)).toEqual({ consum: 1 });
    expect(solduri(d.citesteDepozit().miscari).map((s) => s.cantitate)).toEqual([2]);
    expect(d.citestePlanuri()[0]!.situatii).toHaveLength(1);
    expect(d.stergeUltimaSituatie("S-1")).toBeNull();
    expect(solduri(d.citesteDepozit().miscari).map((s) => s.cantitate)).toEqual([42]);
    expect(cereri).toEqual([]);
  });
});

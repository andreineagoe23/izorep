/**
 * Coloanele foilor la import (planul UX, Faza 6, punctul 1): ce se întreabă
 * modelul, foaia pe fir, alegerea omului verificată ca maparea modelului, și
 * ruta de pe server (`/api/mapare`, `/api/mapari`) cu un model fals.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { parseFoiBuffer } from "../src/import/parse-workbook.js";
import {
  coloaneCitite, coloaneFoaie, foaieDinFir, foaiePeFir, foiDeCitit, literaColoana, mapareAleasa, problemaAlegerii,
} from "../src/import/coloane.js";
import { amprentaFoaie, type MapareFoaie } from "../src/import/mapare.js";
import { proceseazaRegistru } from "../src/import/nucleu.js";
import { stocInMemorie } from "../src/import/memorie.js";
import type { MapareSalvata } from "../src/import/cache-mapari.js";
import type { FoaieBruta } from "../src/import/parse-workbook.js";
import { caTenant, conecteaza, purjeazaTenant, URL_PROPRIETAR } from "../src/db/client.js";
import { firma, tenant } from "../src/db/schema.js";
import { ANTET_CSRF, type OptiuniServer } from "../src/server/app.js";
import { serverCuCont } from "./cu-cont.js";
import { bazaDisponibila } from "./conditii.js";

/**
 * O listă de cantități ca de la un client nou: cantitatea în coloana E, după
 * prețul unitar (D). Euristica „primul număr după UM” ia prețul.
 */
async function foaieNoua(nume = "Lista"): Promise<FoaieBruta[]> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(nume);
  ws.addRow(["Nr.", "Descriere articol", "UM", "Pret unitar", "Necesar"]);
  ws.addRow([1, "Izolatie elastomerica 19 mm DN25", "ml", 12.5, 140]);
  ws.addRow([2, "Izolatie elastomerica 19 mm DN32", "ml", 13.5, 85]);
  ws.addRow([3, "Izolatie vata minerala 50 mm cu tabla aluminiu DN100", "ml", 40, 62]);
  return parseFoiBuffer((await wb.xlsx.writeBuffer()) as ArrayBuffer);
}

describe("coloanele unei foi", () => {
  it("literele ca în Excel", () => {
    expect([0, 5, 25, 26, 27].map(literaColoana)).toEqual(["A", "F", "Z", "AA", "AB"]);
  });

  it("se întreabă doar foile cu poziții și antet necunoscut, o dată pe antet", async () => {
    const [f] = await foaieNoua();
    const [g] = await foaieNoua("A doua");
    expect(foiDeCitit([f!, f!], new Set())).toHaveLength(1);
    expect(foiDeCitit([f!], new Set([amprentaFoaie(f!)]))).toEqual([]);
    expect(amprentaFoaie(g!)).toBe(amprentaFoaie(f!));
  });

  it("foaia pe fir are aceeași amprentă și aceleași celule", async () => {
    const [f] = await foaieNoua();
    const g = foaieDinFir(JSON.parse(JSON.stringify(foaiePeFir(f!))));
    expect(amprentaFoaie(g)).toBe(amprentaFoaie(f!));
    expect(g.randuri.map((r) => r.celule)).toEqual(f!.randuri.map((r) => r.celule));
  });

  it("alegerea omului: cantitatea în E, denumirea în B, iar cantitățile ies din E", async () => {
    const [f] = (await foaieNoua()) as [FoaieBruta];
    expect(coloaneFoaie(f).map((c) => `${c.litera}:${c.eticheta}`)).toEqual([
      "A:Nr.", "B:Descriere articol", "C:UM", "D:Pret unitar", "E:Necesar",
    ]);
    const m = mapareAleasa(f, undefined, { cantitate: 4, denumire: 1 });
    expect(problemaAlegerii(f, m)).toBeNull();
    expect(coloaneCitite(m)).toEqual({ cantitate: 4, denumire: 1 });
    expect(m.roluri[2]).toBe("um");
    const mapari = new Map<string, MapareSalvata>([[amprentaFoaie(f), {
      amprenta: amprentaFoaie(f), mapare: m, fisier: "x", foaie: f.nume, model: "om", generat: "",
    }]]);
    const poz = async (o: Parameters<typeof proceseazaRegistru>[1]) =>
      (await proceseazaRegistru(await foaieNoua(), o)).linii.filter((l) => l.extras.sistem !== null).map((l) => l.bruta.cantitate);
    // Fără coloane alese, regula veche ia prețul unitar drept cantitate.
    expect(await poz({ stoc: stocInMemorie() })).toEqual([12.5, 13.5, 40]);
    expect(await poz({ stoc: stocInMemorie(), mapari })).toEqual([140, 85, 62]);
  });

  it("o coloană de text aleasă drept cantitate e refuzată, cu motivul", async () => {
    const [f] = await foaieNoua();
    const m = mapareAleasa(f!, undefined, { cantitate: 1, denumire: 4 });
    expect(problemaAlegerii(f!, m)).toMatch(/coloana B nu sunt cifre/);
  });
});

/* ------------------------------------------------------------- serverul */

const app$ = conecteaza();
const prop = conecteaza(URL_PROPRIETAR);
const disponibila = bazaDisponibila(await app$.db.execute(sql`select 1`).then(() => true, () => false), "testele coloanelor pe server");
const daca = () => (disponibila ? it : it.skip);
const sufix = Date.now();
let tA = "";
let tB = "";

async function tenantNou(nume: string): Promise<string> {
  const [t] = await prop.db.insert(tenant).values({ denumire: `${nume}-${sufix}` }).returning();
  await caTenant(prop.db, t!.id, (tx) => tx.insert(firma).values({ tenantId: t!.id, cod: "radoia", denumire: "RADOIA", serieOferta: "RAD" }));
  return t!.id;
}

beforeAll(async () => {
  if (!disponibila) return;
  tA = await tenantNou("col-A");
  tB = await tenantNou("col-B");
});
afterAll(async () => {
  if (disponibila) for (const t of [tA, tB]) if (t) await purjeazaTenant(prop.db, t);
  await app$.inchide();
  await prop.inchide();
});

describe("coloanele pe server", () => {
  const apeluri: string[] = [];
  const BUNA: MapareFoaie = { rand_antet: 0, rand_start: 1, roluri: ["nr", "denumire", "um", "pret_unitar", "cantitate"], motiv: "test" };
  const server = (tenantId: string, raspuns: unknown, extra: Partial<OptiuniServer["model"] & object> = {}) => serverCuCont({
    db: app$.db, tenantId,
    model: {
      cheie: "test", model: "m-test", modelPoze: "m", prag: 0.85, lot: 25, concurenta: 4,
      mapeaza: async (f) => { apeluri.push(f.nume); return raspuns; }, ...extra,
    },
  });
  const cere = async (s: ReturnType<typeof serverCuCont>, cale: string, metoda = "GET", corp?: unknown, csrf = true) => {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (csrf) h[ANTET_CSRF] = "1";
    const r = await s.request(cale, { method: metoda, headers: h, ...(corp !== undefined ? { body: JSON.stringify(corp) } : {}) });
    return { status: r.status, corp: await r.json() as Record<string, unknown> };
  };

  daca()("antetul nou se citește o dată, se ține pe firmă, iar firma cealaltă nu-l vede", async () => {
    const [f] = await foaieNoua();
    const s = server(tA, BUNA);
    apeluri.length = 0;
    expect((await cere(s, "/api/mapare", "POST", { foaie: foaiePeFir(f!) }, false)).status).toBe(403);
    const r = await cere(s, "/api/mapare", "POST", { foaie: foaiePeFir(f!), fisier: "nou.xlsx" });
    expect(r).toMatchObject({ status: 200, corp: { amprenta: amprentaFoaie(f!), acceptata: true, mapare: BUNA } });
    // Al doilea import cu același antet: din bază, fără model.
    await cere(server(tA, BUNA), "/api/mapare", "POST", { foaie: foaiePeFir(f!) });
    expect(apeluri).toEqual(["Lista"]);
    const toate = (await cere(s, "/api/mapari")).corp as unknown as { amprenta: string; sursa: string }[];
    expect(toate.map((m) => [m.amprenta, m.sursa])).toEqual([[amprentaFoaie(f!), "model"]]);
    expect((await cere(server(tB, BUNA), "/api/mapari")).corp).toEqual([]);
  });

  daca()("o mapare pe care verificarea o respinge se ține ca respinsă; un răspuns stricat dă 502", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Alta");
    ws.addRow(["Poz", "Text", "Unitate", "Buc"]);
    ws.addRow([1, "Izolatie elastomerica 13 mm DN20", "ml", 30]);
    const f = (await parseFoiBuffer((await wb.xlsx.writeBuffer()) as ArrayBuffer))[0]!;
    const proasta = { rand_antet: 0, rand_start: 1, roluri: ["nr", "cantitate", "um", "denumire"], motiv: "test" };
    expect((await cere(server(tB, { roluri: "nu" }), "/api/mapare", "POST", { foaie: foaiePeFir(f) })).status).toBe(502);
    expect((await cere(server(tB, proasta), "/api/mapare", "POST", { foaie: foaiePeFir(f) })).corp).toMatchObject({ acceptata: false });
    const toate = (await cere(server(tB, proasta), "/api/mapari")).corp as unknown as { acceptata: boolean }[];
    expect(toate.map((m) => m.acceptata)).toEqual([false]);
  });

  daca()("fără model: 503; peste plafon: 429 cu mesajul pentru om", async () => {
    const [f] = await foaieNoua("Fara model");
    const fara = serverCuCont({ db: app$.db, tenantId: tB, model: { model: "m", modelPoze: "m", prag: 0.85, lot: 25, concurenta: 4 } });
    const g = { ...foaiePeFir(f!), randuri: foaiePeFir(f!).randuri.map((r, i) => (i === 0 ? { ...r, celule: [...r.celule, { v: "Obs", span: 1 }] } : r)), coloane: 6 };
    expect((await cere(fara, "/api/mapare", "POST", { foaie: g })).status).toBe(503);
    const plin = server(tB, BUNA, { limita: async () => false });
    const r = await cere(plin, "/api/mapare", "POST", { foaie: g });
    expect(r.status).toBe(429);
    expect(String(r.corp["eroare"])).toMatch(/limita de azi/);
  });

  daca()("alegerea omului se verifică, se ține ca „om” și se poate scoate", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Om");
    ws.addRow(["Cod", "Articol", "U.M.", "Cant.", "Valoare"]);
    ws.addRow(["A1", "Izolatie elastomerica 13 mm DN20", "ml", 30, 100]);
    const f = (await parseFoiBuffer((await wb.xlsx.writeBuffer()) as ArrayBuffer))[0]!;
    const s = server(tA, BUNA);
    const rea = mapareAleasa(f, undefined, { cantitate: 1, denumire: 4 });
    expect((await cere(s, "/api/mapari", "PUT", { foaie: foaiePeFir(f), mapare: rea })).status).toBe(400);
    const buna = mapareAleasa(f, undefined, { cantitate: 3, denumire: 1 });
    expect((await cere(s, "/api/mapari", "PUT", { foaie: foaiePeFir(f), mapare: buna })).status).toBe(200);
    let toate = (await cere(s, "/api/mapari")).corp as unknown as { amprenta: string; sursa: string }[];
    expect(toate.find((m) => m.amprenta === amprentaFoaie(f))?.sursa).toBe("om");
    expect((await cere(s, "/api/mapari", "PUT", { foaie: foaiePeFir(f), mapare: null })).status).toBe(200);
    toate = (await cere(s, "/api/mapari")).corp as unknown as { amprenta: string; sursa: string }[];
    expect(toate.find((m) => m.amprenta === amprentaFoaie(f))).toBeUndefined();
  });
});

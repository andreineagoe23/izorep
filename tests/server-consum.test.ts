/**
 * Faza 6 pe server, pe Postgres real (ca tests/server.test.ts): situatia
 * salvata scrie consumul in aceeasi tranzactie, stearsa il anuleaza cu storno;
 * browserul nu poate scrie singur consum „din situatie”; mutarea din browser
 * nu dubleaza consumul si il completeaza pe situatiile de dinainte de faza.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bazaDisponibila } from "./conditii.js";
import { sql } from "drizzle-orm";
import { caTenant, conecteaza, purjeazaTenant, URL_PROPRIETAR } from "../src/db/client.js";
import { firma, tenant } from "../src/db/schema.js";
import { creeazaServer, ANTET_CSRF } from "../src/server/app.js";
import type { DateComune, Mutare } from "../src/server/contract.js";
import type { PlanSantier, Situatie } from "../src/lucrari/situatii.js";
import type { MaterialNecesar } from "../src/stoc/necesar.js";
import { articolDin, solduri, type Miscare } from "../src/stoc/registru.js";
import { consumDinSituatie, consumSantier } from "../src/stoc/consum.js";
import type { NecesarLucrare } from "../web/depozit-local.js";

const app$ = conecteaza();
const prop = conecteaza(URL_PROPRIETAR);
const disponibila = bazaDisponibila(await app$.db.execute(sql`select 1`).then(() => true, () => false), "testele consumului pe server");
const daca = () => (disponibila ? it : it.skip);

let tenantId = "";
let server: ReturnType<typeof creeazaServer>;

async function cere(cale: string, init: { method?: string; body?: unknown } = {}) {
  const r = await server.request(cale, {
    method: init.method ?? "GET", headers: { "content-type": "application/json", [ANTET_CSRF]: "1" },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await r.text();
  return { status: r.status, corp: text ? JSON.parse(text) as unknown : null };
}

beforeAll(async () => {
  if (!disponibila) return;
  const [t] = await prop.db.insert(tenant).values({ denumire: `F6-${Date.now()}` }).returning();
  tenantId = t!.id;
  await caTenant(prop.db, tenantId, (tx) => tx.insert(firma).values({ tenantId, cod: "radoia", denumire: "RADOIA ISOLIRUNG SRL", serieOferta: "RAD" }));
  server = creeazaServer({ db: app$.db, tenantId });
});

afterAll(async () => {
  if (disponibila && tenantId) await purjeazaTenant(prop.db, tenantId);
  await app$.inchide();
  await prop.inchide();
});

const zi = "2026-10-11T12:00:00.000Z";
const tub: MaterialNecesar = {
  cheie: "vata_minerala|tub|50|114", sistem: "vata_minerala", grosime_mm: 50, rand: 114, categorie: "tub",
  ml: 106.67, m2: 0, piese: 20, piesePresupuse: 0, pierdere: 0, pozitii: 2,
  pePozitie: [{ pozitie: 1, peUnitate: 1 }, { pozitie: 2, peUnitate: 0.3333 }], valoareOferta: 2000,
};
const planul = (id: string): PlanSantier => ({
  id, creat: zi, denumire: `Hala ${id}`, client: "C", firma: "RADOIA ISOLIRUNG SRL", oferta: "", fisier: `${id}.xlsx`,
  destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0, situatii: [],
  pozitii: [
    { nr: 1, denumire: "Di114 g50", um: "ml", cantitate: 100, pretUnitar: 30, foc: false },
    { nr: 2, denumire: "Di114 g50 - COT", um: "buc", cantitate: 20, pretUnitar: 60, foc: false },
  ],
});
const necesarul = (santier: string): NecesarLucrare => ({
  id: `n-${santier}`, creat: zi, fisier: `${santier}.xlsx`, obiectiv: santier, santier, materiale: [tub], faraNecesar: 0,
});
let nrSit = 0;
const sit = (nr: number, cantitati: Record<number, number>): Situatie => ({ id: `f6-sit-${++nrSit}`, nr, data: zi, cantitati });
const date = async (): Promise<DateComune> => (await cere("/api/date")).corp as DateComune;

describe("Faza 6: consumul din situații, pe server", () => {
  daca()("situația scrie consumul în aceeași tranzacție, ca browserul; ștearsă, îl anulează", async () => {
    const S = "S-f6";
    expect((await cere(`/api/santiere/${S}`, { method: "PUT", body: planul(S) })).status).toBe(200);
    expect((await cere(`/api/necesare/n-${S}`, { method: "PUT", body: necesarul(S) })).status).toBe(200);
    const intrari: Miscare[] = [
      { id: "f6-k", data: zi, tip: "intrare", articol: articolDin(tub, "K-Flex"), cantitate: 60, spre: S },
      { id: "f6-r", data: zi, tip: "intrare", articol: articolDin(tub, "Rockwool"), cantitate: 50, spre: S },
    ];
    for (const m of intrari) expect((await cere("/api/miscari", { method: "POST", body: m })).status).toBe(200);

    // Ce ar scrie browserul, pe aceleași date: serverul scrie exact asta.
    const s1 = sit(1, { 1: 100, 2: 20 });
    const asteptat = consumDinSituatie({ ...planul(S), situatii: [s1] }, [tub], intrari, s1);
    const r = await cere(`/api/santiere/${S}/situatii`, { method: "POST", body: s1 });
    expect(r).toEqual({ status: 200, corp: { ok: true, consum: 2 } });
    const d = await date();
    const consum = d.depozit.miscari.filter((m) => m.situatieId === s1.id);
    expect(consum.map((m) => [m.id, m.articol.marca, m.cantitate])).toEqual(asteptat.map((m) => [m.id, m.articol.marca, m.cantitate]));
    const c = consumSantier(d.planuri.find((p) => p.id === S)!, [tub], d.depozit.miscari);
    expect(c.materiale[0]).toMatchObject({ trimis: 110, ramas: 3.33, consumCalculat: 106.67, pierdere: 0 });

    // Ștearsă: storno pe fiecare, în aceeași tranzacție; stocul se întoarce întreg.
    expect((await cere(`/api/santiere/${S}/situatii/1?id=${s1.id}`, { method: "DELETE" })).status).toBe(200);
    const d2 = await date();
    expect(d2.depozit.miscari.filter((m) => m.anuleaza && m.situatieId === s1.id)).toHaveLength(2);
    expect(solduri(d2.depozit.miscari).filter((x) => x.depozit === S).map((x) => x.cantitate)).toEqual([60, 50]);
  });

  daca()("consumul „din situație” nu se scrie din browser; în bază, doar consumul poartă situația", async () => {
    const m: Miscare = { id: "f6-x", data: zi, tip: "consum", articol: articolDin(tub), cantitate: 1, din: "S-f6", situatieId: "falsa" };
    const r = await cere("/api/miscari", { method: "POST", body: m });
    expect(r.status).toBe(400);
    await expect(caTenant(app$.db, tenantId, (tx) => tx.execute(sql`insert into miscare (tenant_id, id, data, tip, articol_cheie, cantitate, spre, situatie_id)
      values (${tenantId}, 'f6-y', now(), 'intrare', ${tub.cheie}, 1, 'central', 'x')`))).rejects.toThrow();
  });

  daca()("mutarea din browser: consumul scris acolo nu se dublează; o situație fără consum îl primește", async () => {
    const A = "S-f6-mut-a";
    const B = "S-f6-mut-b";
    const intrareA: Miscare = { id: "f6-ma", data: zi, tip: "intrare", articol: articolDin(tub), cantitate: 110, spre: A };
    const intrareB: Miscare = { id: "f6-mb", data: zi, tip: "intrare", articol: articolDin(tub), cantitate: 110, spre: B };
    const sa = sit(1, { 1: 50 });
    const sb = sit(1, { 1: 100, 2: 20 });
    const planA = { ...planul(A), situatii: [sa] };
    // Pe A, browserul (după Faza 6) scrisese deja consumul; B e de dinainte.
    const consumA = consumDinSituatie(planA, [tub], [intrareA], sa);
    const d: Mutare = {
      cereri: [], oferte: {}, planuri: [planA, { ...planul(B), situatii: [sb] }],
      depozit: { miscari: [intrareA, intrareB, ...consumA], necesare: [necesarul(A), necesarul(B)] },
    };
    expect((await cere("/api/mutare", { method: "POST", body: d })).status).toBe(200);
    expect((await cere("/api/mutare", { method: "POST", body: d })).status).toBe(200);
    const dupa = await date();
    const scris = (s: string) => dupa.depozit.miscari.filter((m) => m.tip === "consum" && m.din === s).map((m) => m.cantitate);
    expect(scris(A)).toEqual(consumA.map((m) => m.cantitate));
    expect(scris(B)).toEqual([106.67]);
  });
});

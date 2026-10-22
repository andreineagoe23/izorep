/**
 * Ștergerea de tot (`POST /api/stergere`, `web/stergere.ts`), pe Postgres real:
 * o cerere cu oferta, șantierul făcut din ea, situația, necesarul, comanda
 * trimisă cu avizul atașat și mișcările de stoc pleacă toate, într-o
 * tranzacție, deși trigger-ele de imutabilitate le refuză altfel. Ce nu ține
 * de ea (alt șantier, stocul din central) rămâne.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bazaDisponibila } from "./conditii.js";
import { sql } from "drizzle-orm";
import { caTenant, conecteaza, purjeazaTenant, URL_PROPRIETAR } from "../src/db/client.js";
import { firma, oferta, tenant } from "../src/db/schema.js";
import { ANTET_CSRF } from "../src/server/app.js";
import { serverCuCont } from "./cu-cont.js";
import type { DateComune } from "../src/server/contract.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";
import { articolDin, type Miscare } from "../src/stoc/registru.js";

const app$ = conecteaza();
const prop = conecteaza(URL_PROPRIETAR);
const disponibila = bazaDisponibila(await app$.db.execute(sql`select 1`).then(() => true, () => false), "testele stergerii pe server");
const daca = () => (disponibila ? it : it.skip);

let tenantId = "";
let server: ReturnType<typeof serverCuCont>;

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
  const [t] = await prop.db.insert(tenant).values({ denumire: `ST-${Date.now()}` }).returning();
  tenantId = t!.id;
  await caTenant(prop.db, tenantId, (tx) =>
    tx.insert(firma).values({ tenantId, cod: "radoia", denumire: "RADOIA ISOLIRUNG SRL", serieOferta: "RAD" }).then(() => undefined));
  server = serverCuCont({ db: app$.db, tenantId });
});

afterAll(async () => {
  if (disponibila && tenantId) await purjeazaTenant(prop.db, tenantId);
  await app$.inchide();
  await prop.inchide();
});

const ZI = "2026-10-01T08:00:00.000Z";
const vata = articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 114 });
const plan = (id: string, cerere?: string): PlanSantier => ({
  id, creat: ZI, denumire: `Hala ${id}`, client: "C", firma: "RADOIA ISOLIRUNG SRL", oferta: "", fisier: `${id}.xlsx`,
  ...(cerere ? { cerere } : {}),
  destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0,
  pozitii: [{ nr: 1, denumire: "Vată 50 Di114", um: "ml", cantitate: 100, pretUnitar: 25.68, foc: false }], situatii: [],
});
const cerereTest = {
  id: "C-ST", nume: "S-ST.xlsx", marime: 4, cand: ZI, model: null, pozitii: 1, tarifate: 1, valoare: 0,
  extrase: [], editari: [], fisier: Buffer.from("test").toString("base64"),
};

async function pregateste(): Promise<void> {
  expect((await cere(`/api/cereri/${cerereTest.id}`, { method: "PUT", body: cerereTest })).status).toBe(200);
  const continut = { linii: [], antet: { serie: "RAD", numar: "7", data: "01.10.2026", client: "C", obiectiv: "O" }, provenienta: {} };
  expect((await cere(`/api/cereri/${cerereTest.id}/oferte`, { method: "POST", body: { firma: "radoia", continut } })).status).toBe(200);
  expect((await cere(`/api/santiere/S-ST`, { method: "PUT", body: plan("S-ST", cerereTest.id) })).status).toBe(200);
  expect((await cere(`/api/santiere/S-ALT`, { method: "PUT", body: plan("S-ALT") })).status).toBe(200);

  const miscari: Miscare[] = [
    { id: "st-central", data: ZI, tip: "intrare", articol: vata, cantitate: 50, spre: "central", pret: { valoare: 7 } },
    { id: "st-transfer", data: ZI, tip: "transfer", articol: vata, cantitate: 20, din: "central", spre: "S-ST" },
    { id: "st-intrare", data: ZI, tip: "intrare", articol: vata, cantitate: 30, spre: "S-ST", pret: { valoare: 7 } },
    { id: "st-greseala", data: ZI, tip: "intrare", articol: vata, cantitate: 5, spre: "S-ST", pret: { valoare: 7 } },
    { id: "st-storno", data: ZI, tip: "intrare", articol: vata, cantitate: 5, spre: "S-ST", anuleaza: "st-greseala", pret: { valoare: 7 } },
    { id: "st-alt", data: ZI, tip: "intrare", articol: vata, cantitate: 8, spre: "S-ALT", pret: { valoare: 7 } },
  ];
  for (const m of miscari) expect((await cere("/api/miscari", { method: "POST", body: m })).status, m.id).toBe(200);
  expect((await cere(`/api/santiere/S-ST/situatii`, { method: "POST", body: { id: "st-s1", nr: 1, data: ZI, cantitati: { 1: 10 } } })).status).toBe(200);
  const necesar = { id: "N-ST", creat: ZI, fisier: cerereTest.nume, obiectiv: "O", santier: "S-ST", materiale: [], faraNecesar: 0 };
  expect((await cere(`/api/necesare/N-ST`, { method: "PUT", body: necesar })).status).toBe(200);
  const comanda = {
    id: "K-ST", creat: ZI, furnizor: "ISOLINE", firma: "RADOIA ISOLIRUNG SRL", santier: "S-ST", spre: "S-ST",
    linii: [{ id: "l1", articol: vata, cantitate: 10 }],
  };
  expect((await cere(`/api/comenzi/K-ST`, { method: "PUT", body: comanda })).status).toBe(200);
  expect((await cere(`/api/comenzi/K-ST/trimite`, { method: "POST", body: { cand: ZI } })).status).toBe(200);
  const aviz = { id: "D-ST", tip: "aviz", numar: "1", nume: "aviz.pdf", fisier: `data:application/pdf;base64,${Buffer.from("%PDF").toString("base64")}` };
  expect((await cere(`/api/comenzi/K-ST/documente`, { method: "POST", body: aviz })).status).toBe(200);
}

describe("ștergerea de tot, pe server", () => {
  daca()("fără operația de ștergere, oferta și mișcările rămân de neatins", async () => {
    await pregateste();
    await expect(caTenant(app$.db, tenantId, (tx) => tx.delete(oferta))).rejects.toThrow();
    // Ștergerea veche a șantierului refuză în continuare un șantier cu situații.
    expect((await cere(`/api/santiere/S-ST`, { method: "DELETE" })).status).toBe(409);
  });

  daca()("cererea pleacă cu tot ce s-a făcut din ea; restul rămâne", async () => {
    const r = await cere("/api/stergere", { method: "POST", body: { cerere: cerereTest.id } });
    expect(r.status).toBe(200);
    const s = r.corp as { santiere: { id: string }[]; miscari: string[]; comenzi: { id: string; trimisa: boolean }[]; documente: string[] };
    expect(s.santiere.map((x) => x.id)).toEqual(["S-ST"]);
    expect(s.miscari.sort()).toEqual(["st-greseala", "st-intrare", "st-storno", "st-transfer"]);
    expect(s.comenzi).toEqual([{ id: "K-ST", furnizor: "ISOLINE", trimisa: true }]);
    expect(s.documente).toEqual(["D-ST"]);

    const d = (await cere("/api/date")).corp as DateComune;
    expect(d.planuri.map((p) => p.id)).toEqual(["S-ALT"]);
    expect(d.depozit.miscari.map((m) => m.id).sort()).toEqual(["st-alt", "st-central"]);
    expect(d.depozit.necesare).toEqual([]);
    expect(d.depozit.comenzi ?? []).toEqual([]);
    expect(d.depozit.documente ?? []).toEqual([]);
    expect(d.oferte[cerereTest.id]).toBeUndefined();
    expect(((await cere("/api/cereri")).corp as { id: string }[]).map((c) => c.id)).not.toContain(cerereTest.id);
    // Local, proprietarul e superuser și vede toți tenanții: numărătoarea e pe tenantul testului.
    const ramase = await prop.db.execute(sql`
      select (select count(*) from oferta where tenant_id = ${tenantId}) o,
             (select count(*) from situatie where tenant_id = ${tenantId}) s,
             (select count(*) from depozit where tenant_id = ${tenantId} and id = 'S-ST') d`);
    expect(ramase[0]).toEqual({ o: "0", s: "0", d: "0" });
  });

  daca()("șantierul singur: cererea și oferta rămân", async () => {
    await pregateste();
    const r = await cere("/api/stergere", { method: "POST", body: { santier: "S-ST" } });
    expect(r.status).toBe(200);
    const d = (await cere("/api/date")).corp as DateComune;
    expect(d.planuri.map((p) => p.id)).toEqual(["S-ALT"]);
    expect(d.oferte[cerereTest.id]?.numar).toBe("RAD7");
    expect(((await cere("/api/cereri")).corp as { id: string }[]).map((c) => c.id)).toContain(cerereTest.id);
    expect((await cere("/api/stergere", { method: "POST", body: { santier: "S-ST" } })).status).toBe(404);
  });

  daca()("același fișier importat de două ori: ștergerea unei cereri nu ia șantierul celeilalte", async () => {
    // 16 octombrie 2026: legătura era și după numele fișierului, iar ștergerea
    // unei cereri reimportate lua șantierul închis al celei dintâi.
    for (const id of ["C-1", "C-2"]) {
      expect((await cere(`/api/cereri/${id}`, { method: "PUT", body: { ...cerereTest, id, nume: "acelasi.xlsx" } })).status).toBe(200);
      const p = { ...plan(`S-${id}`, id), fisier: "acelasi.xlsx" };
      expect((await cere(`/api/santiere/${p.id}`, { method: "PUT", body: p })).status).toBe(200);
      const necesar = { id: `N-${id}`, creat: ZI, fisier: "acelasi.xlsx", obiectiv: "O", santier: p.id, materiale: [], faraNecesar: 0 };
      expect((await cere(`/api/necesare/N-${id}`, { method: "PUT", body: necesar })).status).toBe(200);
    }
    const r = await cere("/api/stergere", { method: "POST", body: { cerere: "C-2" } });
    expect(r.status).toBe(200);
    expect((r.corp as { santiere: { id: string }[] }).santiere.map((x) => x.id)).toEqual(["S-C-2"]);
    const d = (await cere("/api/date")).corp as DateComune;
    expect(d.planuri.map((p) => p.id)).toContain("S-C-1");
    expect(d.planuri.map((p) => p.id)).not.toContain("S-C-2");
    expect(d.depozit.necesare.map((n) => n.id)).toEqual(["N-C-1"]);
  });

  daca()("după ștergere, aplicația e iar oprită de trigger-e", async () => {
    await expect(caTenant(app$.db, tenantId, (tx) => tx.delete(oferta))).rejects.toThrow();
  });
});

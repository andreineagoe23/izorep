/**
 * Faza 7 pe server, pe Postgres real (ca tests/server.test.ts): închiderea e o
 * operație calculată din bază, cu id-urile browserului, iar șantierul închis nu
 * mai primește situații sau mișcări — nici prin aplicație, nici direct în bază
 * (trigger, migrarea 0012).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bazaDisponibila } from "./conditii.js";
import { sql } from "drizzle-orm";
import { caTenant, conecteaza, purjeazaTenant, URL_PROPRIETAR } from "../src/db/client.js";
import { firma, miscare, situatie, tenant } from "../src/db/schema.js";
import { creeazaServer, ANTET_CSRF } from "../src/server/app.js";
import type { DateComune } from "../src/server/contract.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";
import { miscariInchidere, stocSantier, stocZero, type Inchidere } from "../src/lucrari/inchidere.js";
import { articolDin, type Miscare } from "../src/stoc/registru.js";

const app$ = conecteaza();
const prop = conecteaza(URL_PROPRIETAR);
const disponibila = bazaDisponibila(await app$.db.execute(sql`select 1`).then(() => true, () => false), "testele inchiderii pe server");
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
  const [t] = await prop.db.insert(tenant).values({ denumire: `F7-${Date.now()}` }).returning();
  tenantId = t!.id;
  await caTenant(prop.db, tenantId, (tx) =>
    tx.insert(firma).values({ tenantId, cod: "radoia", denumire: "RADOIA ISOLIRUNG SRL", serieOferta: "RAD" }).then(() => undefined));
  server = creeazaServer({ db: app$.db, tenantId });
});

afterAll(async () => {
  if (disponibila && tenantId) await purjeazaTenant(prop.db, tenantId);
  await app$.inchide();
  await prop.inchide();
});

const ZI = "2026-10-01T08:00:00.000Z";
const plan: PlanSantier = {
  id: "S-F7", creat: ZI, denumire: "Hala F7", client: "C", firma: "RADOIA ISOLIRUNG SRL", oferta: "", fisier: "t.xlsx",
  destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0,
  pozitii: [{ nr: 1, denumire: "Vată 50 Di114", um: "ml", cantitate: 100, pretUnitar: 25.68, foc: false }], situatii: [],
};
const vata = articolDin({ sistem: "vata_minerala", grosime_mm: 50, rand: 114 });
const tabla = articolDin({ sistem: "tabla", grosime_mm: 0.8, rand: null });

describe("închiderea șantierului, pe server", () => {
  daca()("se închide o dată, cu stoc zero; apoi nu mai primește nimic", async () => {
    expect((await cere(`/api/santiere/${plan.id}`, { method: "PUT", body: plan })).status).toBe(200);
    const intrari: Miscare[] = [
      { id: "f7-i1", data: ZI, tip: "intrare", articol: vata, cantitate: 110, spre: plan.id, pret: { valoare: 7.49 } },
      { id: "f7-i2", data: ZI, tip: "intrare", articol: tabla, cantitate: 60, spre: plan.id, pret: { valoare: 9 } },
      { id: "f7-c1", data: ZI, tip: "consum", articol: vata, cantitate: 100, din: plan.id },
      { id: "f7-c2", data: ZI, tip: "consum", articol: tabla, cantitate: 55, din: plan.id },
    ];
    for (const m of intrari) expect((await cere("/api/miscari", { method: "POST", body: m })).status).toBe(200);
    const s1 = { id: "f7-s1", nr: 1, data: ZI, cantitati: { 1: 100 } };
    expect((await cere(`/api/santiere/${plan.id}/situatii`, { method: "POST", body: s1 })).status).toBe(200);

    // Ce a numărat șeful de lucrare: 10 ml de vată înapoi în central, 4 m² de tablă la reciclat (lipsea 1).
    const d0 = (await cere("/api/date")).corp as DateComune;
    const stoc = stocSantier(d0.depozit.miscari, plan.id);
    const inc: Inchidere = {
      santier: plan.id,
      inventar: stoc.map((s) => s.articol.cheie === vata.cheie
        ? { cheie: s.articol.cheie, scriptic: s.cantitate, numarat: 10, destinatii: [{ unde: { fel: "depozit" as const, depozit: "central" }, cantitate: 10 }] }
        : { cheie: s.articol.cheie, scriptic: s.cantitate, numarat: 4, destinatii: [{ unde: { fel: "reciclat" as const }, cantitate: 4 }] }),
    };
    let k = 0;
    const data = "2026-10-11T12:00:00.000Z";
    const noi = miscariInchidere(inc, d0.depozit.miscari, () => `f7-x${++k}`, data);
    const corp = { inventar: inc.inventar, ids: noi.map((m) => m.id), data };

    // Un stoc numărat greșit nu închide nimic.
    const gresit = { ...corp, inventar: corp.inventar.map((r) => ({ ...r, scriptic: r.scriptic + 1 })) };
    expect((await cere(`/api/santiere/${plan.id}/inchide`, { method: "POST", body: gresit })).status).toBe(409);

    const r1 = await cere(`/api/santiere/${plan.id}/inchide`, { method: "POST", body: corp });
    expect(r1).toEqual({ status: 200, corp: { scrise: noi.length } });
    // Trimisă din nou: nimic în plus.
    expect((await cere(`/api/santiere/${plan.id}/inchide`, { method: "POST", body: corp })).corp).toEqual({ scrise: 0 });

    const d = (await cere("/api/date")).corp as DateComune;
    const p = d.planuri.find((x) => x.id === plan.id)!;
    expect(p.inchis).toBe(data);
    expect(stocZero(d.depozit.miscari, plan.id)).toBe(true);
    // Mișcările din bază sunt exact cele calculate în browser, cu aceleași id-uri.
    expect(d.depozit.miscari.filter((m) => m.id.startsWith("f7-x")).map((m) => [m.id, m.tip, m.cantitate, m.motiv ?? null]))
      .toEqual(noi.map((m) => [m.id, m.tip, m.cantitate, m.motiv ?? null]));

    // Închis: nici situație, nici mișcare, nici plan schimbat, nici șters.
    const s2 = { id: "f7-s2", nr: 2, data, cantitati: { 1: 1 } };
    expect((await cere(`/api/santiere/${plan.id}/situatii`, { method: "POST", body: s2 })).status).toBe(409);
    expect((await cere(`/api/santiere/${plan.id}/situatii/1?id=f7-s1`, { method: "DELETE" })).status).toBe(409);
    const intrare = { id: "f7-nou", data, tip: "intrare", articol: vata, cantitate: 1, spre: plan.id, pret: { valoare: 1 } };
    const r = await cere("/api/miscari", { method: "POST", body: intrare });
    expect(r.status).toBe(409);
    expect((r.corp as { eroare: string }).eroare).toMatch(/Hala F7 e închis/);
    // O mișcare scrisă înainte, retrimisă, nu e refuzată.
    expect((await cere("/api/miscari", { method: "POST", body: intrari[0] })).status).toBe(200);
    expect((await cere(`/api/santiere/${plan.id}`, { method: "PUT", body: { ...plan, denumire: "Alt nume", situatii: [] } })).status).toBe(409);
    expect((await cere(`/api/santiere/${plan.id}`, { method: "DELETE" })).status).toBe(409);
  });

  daca()("trigger-ul ține și fără aplicație: direct în bază, nimic nou pe șantierul închis", async () => {
    await expect(caTenant(app$.db, tenantId, (tx) => tx.insert(miscare).values({
      tenantId, id: "f7-direct", data: new Date(), tip: "transfer", articolCheie: vata.cheie, cantitate: "1", din: "central", spre: plan.id,
    }))).rejects.toThrow();
    await expect(caTenant(app$.db, tenantId, (tx) => tx.insert(situatie).values({
      tenantId, santierId: plan.id, nr: 2, id: "f7-direct-s", data: new Date(), cantitati: { 1: 1 },
    }))).rejects.toThrow();
    // Un transfer între alte locuri trece.
    await caTenant(app$.db, tenantId, (tx) => tx.insert(miscare).values({
      tenantId, id: "f7-alt", data: new Date(), tip: "transfer", articolCheie: vata.cheie, cantitate: "1", din: "central", spre: "atelier",
    }));
  });
});

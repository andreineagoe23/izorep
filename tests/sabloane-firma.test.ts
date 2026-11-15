/**
 * Memoria de șabloane pe firmă (planul UX, Faza 6, punctul 2): a treia
 * implementare a lui `StocSabloane`, peste `/api/sabloane`. Corectura unui om
 * rezolvă linia colegului, pe alt calculator; ce era în browser se mută o
 * dată, fără dubluri; firma cealaltă nu vede nimic.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { aplicaMemorie, invata, type SablonInvatat } from "../src/import/memorie.js";
import type { LinieExtrasa } from "../src/import/schema.js";
import { caTenant, conecteaza, purjeazaTenant, URL_PROPRIETAR } from "../src/db/client.js";
import { firma, tenant } from "../src/db/schema.js";
import { ANTET_CSRF } from "../src/server/app.js";
import { stocPeServer } from "../web/stoc-sabloane.js";
import { serverCuCont } from "./cu-cont.js";
import { bazaDisponibila } from "./conditii.js";

const linie = (p: Partial<LinieExtrasa> = {}): LinieExtrasa => ({
  index: 0, sistem: null, diametru_valoare: null, diametru_tip: null,
  grosime_mm: null, forma: null, gol_latime_mm: null, gol_inaltime_mm: null,
  straturi_extra: [], incredere: 0.9, motiv: "test", ...p,
});
const TEXT_A = "Izolatie spumă 13 mm pe teava DN25 apa rece";
const TEXT_B = "Izolatie spumă 19 mm pe teava DN80 apa rece";
const sablonA = (): SablonInvatat => invata(TEXT_A, linie({
  index: 7, sistem: "elastomer", diametru_valoare: 25, diametru_tip: "DN", grosime_mm: 13, forma: "ml", incredere: 1,
}))!;

describe("copia din pagină", () => {
  it("pune și scoate pe loc, iar scrierile pleacă la server", () => {
    const trimise: string[] = [];
    const stoc = stocPeServer([], async (m, cale, corp) => {
      trimise.push(`${m} ${cale} ${(corp as { tipar: string }).tipar}`);
      return new Response("{}");
    });
    const s = sablonA();
    stoc.pune(s);
    expect(stoc.toate().map((x) => x.tipar)).toEqual([s.tipar]);
    stoc.sterge(s.tipar);
    expect(stoc.toate()).toEqual([]);
    expect(trimise).toEqual([`PUT /api/sabloane ${s.tipar}`, `DELETE /api/sabloane ${s.tipar}`]);
  });

  it("un server care nu răspunde nu oprește importul", () => {
    const stoc = stocPeServer([], () => Promise.reject(new Error("fara retea")));
    expect(() => stoc.pune(sablonA())).not.toThrow();
    expect(stoc.toate()).toHaveLength(1);
  });
});

const app$ = conecteaza();
const prop = conecteaza(URL_PROPRIETAR);
const disponibila = bazaDisponibila(await app$.db.execute(sql`select 1`).then(() => true, () => false), "testele memoriei pe server");
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
  tA = await tenantNou("sab-A");
  tB = await tenantNou("sab-B");
});
afterAll(async () => {
  if (disponibila) for (const t of [tA, tB]) if (t) await purjeazaTenant(prop.db, t);
  await app$.inchide();
  await prop.inchide();
});

describe("șabloanele pe server", () => {
  const cere = async (s: ReturnType<typeof serverCuCont>, cale: string, metoda = "GET", corp?: unknown) => {
    const r = await s.request(cale, {
      method: metoda, headers: { "content-type": "application/json", [ANTET_CSRF]: "1" },
      ...(corp !== undefined ? { body: JSON.stringify(corp) } : {}),
    });
    return { status: r.status, corp: await r.json() as unknown };
  };

  daca()("corectura unui om rezolvă linia colegului, pe alt calculator; firma cealaltă nu o vede", async () => {
    const om1 = serverCuCont({ db: app$.db, tenantId: tA }, "Primul");
    const om2 = serverCuCont({ db: app$.db, tenantId: tA }, "Colegul");
    expect((await cere(om1, "/api/sabloane", "PUT", sablonA())).status).toBe(200);
    const deLaServer = (await cere(om2, "/api/sabloane")).corp as SablonInvatat[];
    const { rezolvate, ramase } = aplicaMemorie([{ index: 3, text: TEXT_B }], stocPeServer(deLaServer));
    expect(ramase).toEqual([]);
    expect(rezolvate[0]).toMatchObject({ sistem: "elastomer", diametru_valoare: 80, grosime_mm: 19 });
    expect((await cere(serverCuCont({ db: app$.db, tenantId: tB }), "/api/sabloane")).corp).toEqual([]);
  });

  daca()("ce era în browser se mută o dată, fără dubluri și fără să scrie peste firmă", async () => {
    const om = serverCuCont({ db: app$.db, tenantId: tB });
    const s = sablonA();
    const alt = invata("Izolatie spumă 9 mm pe teava DN15 pluviale", linie({
      index: 1, sistem: "elastomer", diametru_valoare: 15, diametru_tip: "DN", grosime_mm: 9, forma: "ml", incredere: 1,
    }))!;
    expect((await cere(om, "/api/sabloane", "PUT", s)).status).toBe(200);
    const vechi = { ...s, exemplu: "din browser" };
    const r = await cere(om, "/api/sabloane/mutare", "POST", { sabloane: [vechi, alt, { tipar: "stricat" }] });
    expect(r.corp).toEqual({ mutate: 1, primite: 3 });
    expect((await cere(om, "/api/sabloane/mutare", "POST", { sabloane: [vechi, alt] })).corp).toMatchObject({ mutate: 0 });
    const toate = (await cere(om, "/api/sabloane")).corp as SablonInvatat[];
    expect(toate).toHaveLength(2);
    expect(toate.find((x) => x.tipar === s.tipar)!.exemplu).toBe(s.exemplu);
    expect((await cere(om, "/api/sabloane", "DELETE", { tipar: alt.tipar })).status).toBe(200);
    expect(((await cere(om, "/api/sabloane")).corp as SablonInvatat[]).map((x) => x.tipar)).toEqual([s.tipar]);
  });

  daca()("un șablon stricat nu intră", async () => {
    const om = serverCuCont({ db: app$.db, tenantId: tA });
    expect((await cere(om, "/api/sabloane", "PUT", { ...sablonA(), extras: { sistem: "beton" } })).status).toBe(400);
  });
});

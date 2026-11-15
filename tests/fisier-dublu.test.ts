/**
 * Același fișier încărcat a doua oară (planul UX, Faza 6, punctul 8): pe
 * server, cererile cu exact fișierul ăsta se găsesc după amprenta conținutului,
 * socotită în bază; amprenta din browser e aceeași.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { caTenant, conecteaza, purjeazaTenant, URL_PROPRIETAR } from "../src/db/client.js";
import { firma, tenant } from "../src/db/schema.js";
import { ANTET_CSRF } from "../src/server/app.js";
import { amprentaFisier } from "../web/import/fisier-dublu.js";
import { serverCuCont } from "./cu-cont.js";
import { bazaDisponibila } from "./conditii.js";

const BYTES = Buffer.from("PK fisierul clientului, de doua ori");

describe("amprenta fișierului", () => {
  it("e SHA-256 al conținutului, ca în bază", async () => {
    const buf = BYTES.buffer.slice(BYTES.byteOffset, BYTES.byteOffset + BYTES.length);
    expect(await amprentaFisier(buf)).toBe(createHash("sha256").update(BYTES).digest("hex"));
  });
});

const app$ = conecteaza();
const prop = conecteaza(URL_PROPRIETAR);
const disponibila = bazaDisponibila(await app$.db.execute(sql`select 1`).then(() => true, () => false), "testele dublurii pe server");
const daca = () => (disponibila ? it : it.skip);
const sufix = Date.now();
let tA = "";
let tB = "";
async function tenantNou(nume: string): Promise<string> {
  const [t] = await prop.db.insert(tenant).values({ denumire: `${nume}-${sufix}` }).returning();
  await caTenant(prop.db, t!.id, (tx) => tx.insert(firma).values({ tenantId: t!.id, cod: "radoia", denumire: "RADOIA", serieOferta: "RAD" }));
  return t!.id;
}
beforeAll(async () => { if (disponibila) { tA = await tenantNou("dub-A"); tB = await tenantNou("dub-B"); } });
afterAll(async () => {
  if (disponibila) for (const t of [tA, tB]) if (t) await purjeazaTenant(prop.db, t);
  await app$.inchide();
  await prop.inchide();
});

describe("cererile cu același fișier, pe server", () => {
  const cere = async (s: ReturnType<typeof serverCuCont>, cale: string, metoda = "GET", corp?: unknown) => {
    const r = await s.request(cale, {
      method: metoda, headers: { "content-type": "application/json", [ANTET_CSRF]: "1" },
      ...(corp !== undefined ? { body: JSON.stringify(corp) } : {}),
    });
    return { status: r.status, corp: await r.json() as unknown };
  };
  const cerereCu = (id: string, fisier: Buffer) => ({
    id, nume: "transavia.xlsx", marime: fisier.length, cand: new Date().toISOString(), model: null,
    pozitii: 0, tarifate: 0, valoare: 0, extrase: [], editari: [], fisier: fisier.toString("base64"),
  });

  daca()("găsește cererea după conținut, nu după nume; firma cealaltă nu o vede", async () => {
    const a = serverCuCont({ db: app$.db, tenantId: tA });
    const amprenta = createHash("sha256").update(BYTES).digest("hex");
    expect((await cere(a, `/api/cereri-dupa-fisier?amprenta=${amprenta}`)).corp).toEqual([]);
    expect((await cere(a, "/api/cereri/c1", "PUT", cerereCu("c1", BYTES))).status).toBe(200);
    expect((await cere(a, "/api/cereri/c2", "PUT", cerereCu("c2", Buffer.from("alt fisier")))).status).toBe(200);
    expect((await cere(a, `/api/cereri-dupa-fisier?amprenta=${amprenta}`)).corp).toEqual(["c1"]);
    expect((await cere(serverCuCont({ db: app$.db, tenantId: tB }), `/api/cereri-dupa-fisier?amprenta=${amprenta}`)).corp).toEqual([]);
    expect((await cere(a, "/api/cereri-dupa-fisier?amprenta=nu-e")).status).toBe(400);
  });
});

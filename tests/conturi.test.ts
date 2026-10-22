/**
 * Conturile pe Postgres real (21 octombrie 2026): intrarea cu email și parolă,
 * blocarea după parole greșite, parola temporară, ieșirea, contul
 * dezactivat; versiunea pe cerere și necesar (doi oameni nu se mai
 * suprascriu); jurnalul „cine a schimbat ce”.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { bazaDisponibila } from "./conditii.js";
import { caTenant, conecteaza, purjeazaTenant, URL_PROPRIETAR } from "../src/db/client.js";
import { firma, tenant, utilizator } from "../src/db/schema.js";
import { ANTET_CSRF, creeazaServer } from "../src/server/app.js";
import { hashParola } from "../src/server/parola.js";
import { COOKIE } from "../src/server/securitate.js";
import { PRAG_BLOCARE } from "../src/server/intrare.js";
import { serverCuCont } from "./cu-cont.js";
import type { CererePeFir } from "../src/server/contract.js";

const app$ = conecteaza();
const prop = conecteaza(URL_PROPRIETAR);
const disponibila = bazaDisponibila(await app$.db.execute(sql`select 1`).then(() => true, () => false), "testele conturilor");
const daca = () => (disponibila ? it : it.skip);

let tenantId = "";
let server: ReturnType<typeof creeazaServer>;
const PAROLA = "o-parola-buna-7";

beforeAll(async () => {
  if (!disponibila) return;
  const [t] = await prop.db.insert(tenant).values({ denumire: `CONTURI-${Date.now()}` }).returning();
  tenantId = t!.id;
  await caTenant(prop.db, tenantId, (tx) => tx.insert(firma).values({ tenantId, cod: "radoia", denumire: "RADOIA ISOLIRUNG SRL", serieOferta: "RAD" }));
  server = creeazaServer({ db: app$.db, tenantId });
});

afterAll(async () => {
  if (disponibila && tenantId) await purjeazaTenant(prop.db, tenantId);
  await app$.inchide();
  await prop.inchide();
});

let n = 0;
async function cont(p: { temporara?: boolean; nume?: string } = {}): Promise<string> {
  const email = `om${++n}-${Date.now()}@izorep.test`;
  await caTenant(app$.db, tenantId, async (tx) => tx.insert(utilizator).values({
    tenantId, email, nume: p.nume ?? `Om ${n}`, rol: "birou", parolaHash: await hashParola(PAROLA), parolaTemporara: p.temporara ?? false,
  }));
  return email;
}

const json = { "content-type": "application/json", [ANTET_CSRF]: "1" };
async function intra(email: string, parola = PAROLA) {
  const r = await server.request("/api/intrare", { method: "POST", headers: json, body: JSON.stringify({ email, parola }) });
  const setCookie = r.headers.get("set-cookie") ?? "";
  return { status: r.status, corp: await r.json() as { eroare?: string }, setCookie, cookie: new RegExp(`${COOKIE}=([^;]*)`).exec(setCookie)?.[1] ?? "" };
}
const cuCookie = (cookie: string, init: RequestInit = {}) => ({ ...init, headers: { ...json, ...(init.headers as object), cookie: `${COOKIE}=${cookie}` } });

describe("intrarea", () => {
  daca()("bună: sesiune în cookie HttpOnly, SameSite; /api/stare spune cine; datele se deschid", async () => {
    const email = await cont({ nume: "Ion Tehnic" });
    const r = await intra(email.toUpperCase());
    expect(r.status).toBe(200);
    expect(r.setCookie).toMatch(/HttpOnly/);
    expect(r.setCookie).toMatch(/SameSite=Lax/);
    expect(r.setCookie).not.toMatch(/Secure/);
    const stare = await (await server.request("/api/stare", cuCookie(r.cookie))).json();
    expect(stare.eu).toMatchObject({ nume: "Ion Tehnic", email, parolaTemporara: false });
    expect((await server.request("/api/date", cuCookie(r.cookie))).status).toBe(200);
    const jurnal = await (await server.request("/api/jurnal", cuCookie(r.cookie))).json();
    expect(jurnal[0]).toMatchObject({ cine: "Ion Tehnic", actiune: "a intrat în aplicație" });
  });

  daca()("pe https cookie-ul e Secure", async () => {
    const email = await cont();
    const r = await server.request("/api/intrare", {
      method: "POST", headers: { ...json, "x-forwarded-proto": "https" }, body: JSON.stringify({ email, parola: PAROLA }),
    });
    expect(r.headers.get("set-cookie")).toMatch(/Secure/);
  });

  daca()("email necunoscut și parolă greșită: același răspuns, ca să nu se afle ce adrese au cont", async () => {
    const email = await cont();
    const gresita = await intra(email, "nu-e-parola-1");
    const necunoscut = await intra("nimeni@izorep.test", "nu-e-parola-1");
    expect(gresita.status).toBe(401);
    expect(necunoscut.status).toBe(401);
    expect(gresita.corp).toEqual(necunoscut.corp);
    expect(gresita.cookie).toBe("");
  });

  daca()(`după ${PRAG_BLOCARE} parole greșite contul se blochează, iar nici parola bună nu mai trece`, async () => {
    const email = await cont();
    for (let i = 1; i < PRAG_BLOCARE; i++) expect((await intra(email, "gresita-123")).status).toBe(401);
    const blocat = await intra(email, "gresita-123");
    expect(blocat.status).toBe(423);
    expect(blocat.corp.eroare).toContain("blocat până la");
    expect((await intra(email)).status).toBe(423);
  });

  daca()("cu parola temporară nu se vede nimic până nu-și alege alta; apoi da", async () => {
    const email = await cont({ temporara: true });
    const { cookie } = await intra(email);
    expect((await server.request("/api/date", cuCookie(cookie))).status).toBe(403);
    const slaba = await server.request("/api/parola", cuCookie(cookie, { method: "POST", body: JSON.stringify({ veche: PAROLA, noua: "scurta" }) }));
    expect(slaba.status).toBe(400);
    const buna = await server.request("/api/parola", cuCookie(cookie, { method: "POST", body: JSON.stringify({ veche: PAROLA, noua: "parola-mea-noua-9" }) }));
    expect(buna.status).toBe(200);
    expect((await server.request("/api/date", cuCookie(cookie))).status).toBe(200);
    expect((await intra(email)).status).toBe(401);
    expect((await intra(email, "parola-mea-noua-9")).status).toBe(200);
  });

  daca()("schimbarea parolei închide celelalte sesiuni; ieșirea o închide pe a ei", async () => {
    const email = await cont();
    const unu = (await intra(email)).cookie;
    const doi = (await intra(email)).cookie;
    await server.request("/api/parola", cuCookie(unu, { method: "POST", body: JSON.stringify({ veche: PAROLA, noua: "alta-parola-buna-3" }) }));
    expect((await server.request("/api/date", cuCookie(doi))).status).toBe(401);
    expect((await server.request("/api/date", cuCookie(unu))).status).toBe(200);
    await server.request("/api/iesire", cuCookie(unu, { method: "POST", body: "{}" }));
    expect((await server.request("/api/date", cuCookie(unu))).status).toBe(401);
  });

  daca()("contul dezactivat nu mai intră, iar sesiunea lui nu mai merge", async () => {
    const email = await cont();
    const { cookie } = await intra(email);
    await caTenant(app$.db, tenantId, (tx) => tx.update(utilizator).set({ activ: false }).where(eq(utilizator.email, email)));
    expect((await server.request("/api/date", cuCookie(cookie))).status).toBe(401);
    expect((await intra(email)).status).toBe(401);
  });

  daca()("un cookie inventat nu deschide nimic", async () => {
    expect((await server.request("/api/date", cuCookie("inventat"))).status).toBe(401);
  });
});

describe("doi oameni pe același lucru", () => {
  const cerere = (id: string, versiune?: number): CererePeFir => ({
    id, nume: "dublu.xlsx", marime: 3, cand: "2026-10-21T08:00:00.000Z", model: null,
    pozitii: 0, tarifate: 0, valoare: 0, extrase: [], editari: [], fisier: Buffer.from("abc").toString("base64"),
    ...(versiune !== undefined ? { versiune } : {}),
  });

  daca()("cererea: al doilea care salvează peste o versiune veche primește 409, cu numele primului", async () => {
    const ana = serverCuCont({ db: app$.db, tenantId }, "Ana Birou");
    const dan = serverCuCont({ db: app$.db, tenantId }, "Dan Tehnic");
    const put = (s: typeof ana, c: CererePeFir) => s.request(`/api/cereri/${c.id}`, { method: "PUT", headers: json, body: JSON.stringify(c) });
    const unu = await put(ana, cerere("dublu-1"));
    expect(await unu.json()).toEqual({ ok: true, versiune: 1 });
    // Amândoi au deschis versiunea 1. Dan salvează primul.
    expect(await (await put(dan, cerere("dublu-1", 1))).json()).toEqual({ ok: true, versiune: 2 });
    const ana2 = await put(ana, cerere("dublu-1", 1));
    expect(ana2.status).toBe(409);
    expect((await ana2.json()).eroare).toContain("de Dan Tehnic");
    // Pe versiunea lui Dan, Ana salvează.
    expect(await (await put(ana, cerere("dublu-1", 2))).json()).toEqual({ ok: true, versiune: 3 });
    // Jurnalul spune cine a salvat.
    const j = await (await ana.request("/api/jurnal")).json() as { cine: string; actiune: string; obiect: string }[];
    expect(j.filter((r) => r.obiect === "dublu-1").map((r) => r.cine)).toEqual(["Ana Birou", "Dan Tehnic", "Ana Birou"]);
  });

  daca()("necesarul, la fel", async () => {
    const ana = serverCuCont({ db: app$.db, tenantId }, "Ana Birou");
    const dan = serverCuCont({ db: app$.db, tenantId }, "Dan Tehnic");
    const nec = (versiune?: number) => ({ id: "nec-dublu", creat: "2026-10-21", fisier: "x.xlsx", obiectiv: "O", materiale: [], ...(versiune ? { versiune } : {}) });
    const put = (s: typeof ana, v?: number) => s.request("/api/necesare/nec-dublu", { method: "PUT", headers: json, body: JSON.stringify(nec(v)) });
    expect(await (await put(ana)).json()).toEqual({ ok: true, versiune: 1 });
    expect((await put(dan, 1)).status).toBe(200);
    const r = await put(ana, 1);
    expect(r.status).toBe(409);
    expect((await r.json()).eroare).toContain("Lista de materiale a fost salvată de Dan Tehnic");
    const date = await (await ana.request("/api/date")).json();
    expect(date.depozit.necesare.find((x: { id: string }) => x.id === "nec-dublu").versiune).toBe(2);
  });
});

describe("documentele atașate", () => {
  daca()("doar poze și PDF: un SVG (pagină cu scripturi) se refuză", async () => {
    const s = serverCuCont({ db: app$.db, tenantId });
    const r = await s.request("/api/comenzi/c-x/documente", {
      method: "POST", headers: json,
      body: JSON.stringify({ id: "d1", tip: "aviz", numar: "1", nume: "a.svg", fisier: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=" }),
    });
    expect(r.status).toBe(400);
  });
});

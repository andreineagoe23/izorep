/**
 * Serverul, pe Postgres real (ca tests/db.test.ts): intrarea cu link, izolarea
 * dintre firme pe tabelele noi, documentele care nu se mai schimba, oferta
 * TRANSAVIA salvata si recitita la ban, mutarea din browser fara dubluri.
 *
 * Serverul e chemat direct (`app.request`), fara retea; emailul e o functie
 * care retine linkul. Tenantii de test se sterg ca proprietar
 * (`purjeazaTenant`): aplicatia n-ar putea, si asta e chiar ce se verifica.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { caTenant, conecteaza, purjeazaTenant, URL_PROPRIETAR } from "../src/db/client.js";
import { firma, oferta, miscare, tenant, utilizator } from "../src/db/schema.js";
import { creeazaServer, ANTET_CSRF, COOKIE, LIMITA_IMPLICITA } from "../src/server/app.js";
import { LINKURI_PE_FEREASTRA } from "../src/server/intrare.js";
import type { CererePeFir, DateComune, Mutare, RezultatMutare } from "../src/server/contract.js";
import { importaFisier } from "../src/import/pipeline.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { valoareOferta, type CerereOferta } from "../web/oferta.js";
import type { Miscare } from "../src/stoc/registru.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";

const app$ = conecteaza();
const prop = conecteaza(URL_PROPRIETAR);
const disponibila = await app$.db.execute(sql`select 1`).then(() => true, () => false);
const daca = () => (disponibila ? it : it.skip);
if (!disponibila) console.warn("Baza nu raspunde — testele serverului se sar. Porneste: npm run db:up && npm run db:migrate");

const linkuri: { email: string; link: string }[] = [];
const server = creeazaServer({
  db: app$.db,
  trimiteLink: async (c, link) => { linkuri.push({ email: c.email, link }); },
  urlAplicatie: "http://test/izorep/",
  cookieSecure: false,
});

const sufix = Date.now();
const EMAIL_A = `a-${sufix}@test.ro`;
const EMAIL_B = `b-${sufix}@test.ro`;
let tenantA = "";
let tenantB = "";
let cookieA = "";
let cookieB = "";

/** O cerere ca din browser: JSON, cu antetul CSRF si cookie-ul omului. */
async function cere(cale: string, cookie: string, init: { method?: string; body?: unknown; faraCsrf?: boolean } = {}) {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (!init.faraCsrf) h[ANTET_CSRF] = "1";
  if (cookie) h["cookie"] = `${COOKIE}=${cookie}`;
  const r = await server.request(cale, {
    method: init.method ?? "GET", headers: h,
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await r.text();
  return { status: r.status, corp: text ? JSON.parse(text) as unknown : null, antete: r.headers };
}

async function intra(email: string): Promise<string> {
  linkuri.length = 0;
  await cere("/api/intrare", "", { method: "POST", body: { email } });
  const token = linkuri.find((l) => l.email === email)!.link.split("#/intrare/")[1]!;
  const r = await cere("/api/intrare/confirma", "", { method: "POST", body: { token } });
  return /izorep_sesiune=([^;]+)/.exec(r.antete.get("set-cookie") ?? "")![1]!;
}

async function tenantCuOm(nume: string, email: string): Promise<string> {
  const [t] = await prop.db.insert(tenant).values({ denumire: `${nume}-${sufix}` }).returning();
  await caTenant(prop.db, t!.id, async (tx) => {
    await tx.insert(utilizator).values({ tenantId: t!.id, email, nume, rol: "birou" });
    await tx.insert(firma).values({ tenantId: t!.id, cod: "radoia", denumire: "RADOIA ISOLIRUNG SRL", serieOferta: "RAD" });
  });
  return t!.id;
}

beforeAll(async () => {
  if (!disponibila) return;
  tenantA = await tenantCuOm("A", EMAIL_A);
  tenantB = await tenantCuOm("B", EMAIL_B);
  cookieA = await intra(EMAIL_A);
  cookieB = await intra(EMAIL_B);
});

afterAll(async () => {
  if (disponibila) for (const t of [tenantA, tenantB]) if (t) await purjeazaTenant(prop.db, t);
  await app$.inchide();
  await prop.inchide();
});

const cerereMica = (id: string): CererePeFir => ({
  id, nume: "test.xlsx", marime: 3, cand: "2026-10-09T08:00:00.000Z", model: null,
  pozitii: 0, tarifate: 0, valoare: 0, extrase: [], editari: [],
  fisier: Buffer.from("abc").toString("base64"),
});

const miscareMica = (id: string, extra: Partial<Miscare> = {}): Miscare => ({
  id, data: "2026-10-09T08:00:00.000Z", tip: "intrare", cantitate: 12.5, spre: "central",
  articol: { cheie: "elastomer|19|22|Armaflex", sistem: "elastomer", grosime_mm: 19, rand: 22, um: "ml", marca: "Armaflex" },
  pret: { valoare: 3.1 }, ...extra,
});

describe("intrarea cu link pe email", () => {
  daca()("fără cont nu se vede nimic; cu linkul, da; linkul merge o singură dată", async () => {
    expect((await cere("/api/eu", "")).status).toBe(401);
    expect((await cere("/api/date", "garbage")).status).toBe(401);

    linkuri.length = 0;
    expect((await cere("/api/intrare", "", { method: "POST", body: { email: ` ${EMAIL_A.toUpperCase()} ` } })).status).toBe(202);
    expect(linkuri).toHaveLength(1);
    const token = linkuri[0]!.link.split("#/intrare/")[1]!;
    expect(linkuri[0]!.link.startsWith("http://test/izorep/#/intrare/")).toBe(true);

    const r = await cere("/api/intrare/confirma", "", { method: "POST", body: { token } });
    expect(r.status).toBe(200);
    expect(r.antete.get("set-cookie")).toMatch(/HttpOnly/i);
    expect((await cere("/api/intrare/confirma", "", { method: "POST", body: { token } })).status).toBe(401);

    const cookie = /izorep_sesiune=([^;]+)/.exec(r.antete.get("set-cookie")!)![1]!;
    expect((await cere("/api/eu", cookie)).corp).toEqual({ nume: "A", email: EMAIL_A, rol: "birou" });

    await cere("/api/iesire", cookie, { method: "POST" });
    expect((await cere("/api/eu", cookie)).status).toBe(401);
  });

  daca()("o adresă fără cont primește același răspuns, dar niciun link", async () => {
    linkuri.length = 0;
    expect((await cere("/api/intrare", "", { method: "POST", body: { email: `nimeni-${sufix}@test.ro` } })).status).toBe(202);
    expect(linkuri).toEqual([]);
  });

  daca()("peste cinci linkuri în 15 minute, formularul tace: răspunde la fel, dar nu mai trimite", async () => {
    const email = `c-${sufix}@test.ro`;
    await caTenant(prop.db, tenantA, (tx) => tx.insert(utilizator).values({ tenantId: tenantA, email, nume: "C", rol: "birou" }));
    linkuri.length = 0;
    for (let i = 0; i < LINKURI_PE_FEREASTRA + 2; i++) {
      expect((await cere("/api/intrare", "", { method: "POST", body: { email } })).status).toBe(202);
    }
    expect(linkuri).toHaveLength(LINKURI_PE_FEREASTRA);
  });

  daca()("o cerere prea mare e refuzată înainte să ajungă la bază", async () => {
    const mare = "x".repeat(LIMITA_IMPLICITA + 1);
    const r = await cere("/api/miscari", cookieA, { method: "POST", body: miscareMica("mare", { nota: mare }) });
    expect(r.status).toBe(413);
  });

  daca()("fără antetul X-Izorep, nicio schimbare nu trece (CSRF)", async () => {
    const r = await cere("/api/miscari", cookieA, { method: "POST", body: miscareMica("csrf"), faraCsrf: true });
    expect(r.status).toBe(403);
  });
});

describe("izolarea dintre firme, pe tabelele noi", () => {
  daca()("ce scrie A nu vede B, nici cerând direct", async () => {
    expect((await cere("/api/cereri/izo-1", cookieA, { method: "PUT", body: cerereMica("izo-1") })).status).toBe(200);
    expect((await cere("/api/miscari", cookieA, { method: "POST", body: miscareMica("izo-m1") })).status).toBe(200);

    const dA = (await cere("/api/date", cookieA)).corp as DateComune;
    expect(dA.depozit.miscari.map((m) => m.id)).toContain("izo-m1");
    expect(dA.depozit.miscari.find((m) => m.id === "izo-m1")).toEqual(miscareMica("izo-m1"));

    const dB = (await cere("/api/date", cookieB)).corp as DateComune;
    expect(dB.depozit.miscari).toEqual([]);
    expect((await cere("/api/cereri/izo-1", cookieB)).status).toBe(404);
    expect((await cere("/api/cereri", cookieB)).corp).toEqual([]);
    // Acelasi id la B e alta inregistrare, nu o suprascriere a lui A.
    expect((await cere("/api/cereri/izo-1", cookieB, { method: "PUT", body: cerereMica("izo-1") })).status).toBe(200);
    expect((await cere("/api/cereri", cookieA)).corp).toHaveLength(1);
  });

  daca()("fără context de tenant, aplicația nu vede niciun rând nou", async () => {
    const r = await app$.db.execute(sql`select count(*)::int as n from miscare`);
    expect((r as unknown as { n: number }[])[0]!.n).toBe(0);
  });
});

describe("ce nu se mai schimbă", () => {
  daca()("mișcarea de stoc: nici UPDATE, nici DELETE, nici ca aplicație cu tenantul pus", async () => {
    await cere("/api/miscari", cookieA, { method: "POST", body: miscareMica("imu-m1") });
    await expect(caTenant(app$.db, tenantA, (tx) => tx.update(miscare).set({ cantitate: "1" }).where(sql`id = 'imu-m1'`)))
      .rejects.toThrow();
    await expect(caTenant(app$.db, tenantA, (tx) => tx.delete(miscare).where(sql`id = 'imu-m1'`))).rejects.toThrow();
    // Nici cu setarea de purjare pusa de aplicatie: e rezervata proprietarului.
    await expect(caTenant(app$.db, tenantA, async (tx) => {
      await tx.execute(sql`select set_config('app.purjare', ${tenantA}, true)`);
      await tx.delete(miscare).where(sql`id = 'imu-m1'`);
    })).rejects.toThrow();
  });

  daca()("o mișcare trimisă de două ori intră o dată; datele de exemplu nu intră deloc", async () => {
    await cere("/api/miscari", cookieA, { method: "POST", body: miscareMica("dub-1") });
    await cere("/api/miscari", cookieA, { method: "POST", body: miscareMica("dub-1") });
    const d = (await cere("/api/date", cookieA)).corp as DateComune;
    expect(d.depozit.miscari.filter((m) => m.id === "dub-1")).toHaveLength(1);
    const ex = await cere("/api/miscari", cookieA, { method: "POST", body: miscareMica("ex-1", { exemplu: true }) });
    expect(ex.status).toBe(400);
  });

  daca()("situațiile: se șterge doar ultima, iar planul se îngheață la prima", async () => {
    const plan: PlanSantier = {
      id: "S-imu", creat: "2026-10-09T08:00:00.000Z", denumire: "Test", client: "C", firma: "RADOIA ISOLIRUNG SRL",
      oferta: "", fisier: "test.xlsx", destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0,
      pozitii: [{ nr: 1, denumire: "p", um: "ml", cantitate: 10, pretUnitar: 5, foc: false }], situatii: [],
    };
    expect((await cere("/api/santiere/S-imu", cookieA, { method: "PUT", body: plan })).status).toBe(200);
    // Fara situatii, planul se poate reface din oferta.
    expect((await cere("/api/santiere/S-imu", cookieA, { method: "PUT", body: { ...plan, denumire: "Test 2" } })).status).toBe(200);
    for (const nr of [1, 2]) {
      const s = { id: `sit-${nr}`, nr, data: "2026-10-09T08:00:00.000Z", cantitati: { 1: 2 } };
      expect((await cere("/api/santiere/S-imu/situatii", cookieA, { method: "POST", body: s })).status).toBe(200);
    }
    expect((await cere("/api/santiere/S-imu/situatii", cookieA, { method: "POST", body: { id: "x", nr: 5, data: "2026-10-09T08:00:00.000Z", cantitati: {} } })).status).toBe(409);
    expect((await cere("/api/santiere/S-imu/situatii/1?id=sit-1", cookieA, { method: "DELETE" })).status).toBe(409);
    // Alta situatie 2 decat cea vazuta (stearsa si scrisa din nou de un coleg): nu se sterge.
    expect((await cere("/api/santiere/S-imu/situatii/2?id=alta", cookieA, { method: "DELETE" })).status).toBe(409);
    expect((await cere("/api/santiere/S-imu/situatii/2", cookieA, { method: "DELETE" })).status).toBe(400);
    expect((await cere("/api/santiere/S-imu", cookieA, { method: "PUT", body: { ...plan, pozitii: [] } })).status).toBe(409);
    expect((await cere("/api/santiere/S-imu", cookieA, { method: "DELETE" })).status).toBe(409);
    expect((await cere("/api/santiere/S-imu/situatii/2?id=sit-2", cookieA, { method: "DELETE" })).status).toBe(200);

    const d = (await cere("/api/date", cookieA)).corp as DateComune;
    const p = d.planuri.find((x) => x.id === "S-imu")!;
    expect(p.denumire).toBe("Test 2");
    expect(p.situatii.map((s) => s.nr)).toEqual([1]);
  });
});

describe("oferta TRANSAVIA salvată pe un calculator se deschide pe altul la 94.575,06 €", () => {
  const CERERE = "../attachments/clienti/cerere-de-oferta-transavia-abur.xlsx";

  daca()("salvată, versiune nouă la fiecare descărcare, valoarea socotită pe server din linii", async () => {
    if (!existsSync(CERERE)) return;
    const raport = await importaFisier(CERERE, { faraModel: true, stoc: stocInMemorie() });
    // „Confirmă toate cele 13” din ecran.
    const linii = raport.linii.map((l) => (l.pret ? { ...l, necesitaValidare: false } : l));
    const continut: CerereOferta = {
      linii,
      antet: { serie: "RAD", numar: "284", data: "27.05.2026", persoana: "—", client: "Grup Energoinstal",
        obiectiv: "Transavia Alba-Iulia", firma: "RADOIA ISOLIRUNG SRL", localitate: "PALTINIS" },
      provenienta: { generatLa: "2026-10-09T08:00:00.000Z", destinatie: "rezidential", model: null, sesiune: "transavia", fisierSursa: "cerere-de-oferta-transavia-abur.xlsx" },
    };
    expect(valoareOferta(continut).valoare).toBe(94575.06);

    const fisier = readFileSync(CERERE);
    const c: CererePeFir = { ...cerereMica("transavia"), nume: "cerere-de-oferta-transavia-abur.xlsx", marime: fisier.length, fisier: fisier.toString("base64") };
    expect((await cere("/api/cereri/transavia", cookieA, { method: "PUT", body: c })).status).toBe(200);

    const r1 = await cere("/api/cereri/transavia/oferte", cookieA, { method: "POST", body: { firma: "radoia", continut } });
    expect(r1.corp).toEqual({ versiune: 1, valoare: 94575.06 });
    const r2 = await cere("/api/cereri/transavia/oferte", cookieA, { method: "POST", body: { firma: "radoia", continut: { ...continut, antet: { ...continut.antet, discountProcent: 3 } } } });
    expect(r2.corp).toEqual({ versiune: 2, valoare: 91737.81 });

    // „Celalalt calculator”: alta sesiune a aceleiasi firme.
    const altCalculator = await intra(EMAIL_A);
    const d = (await cere("/api/date", altCalculator)).corp as DateComune;
    expect(d.oferte["transavia"]).toMatchObject({ numar: "RAD284", valoare: 91737.81 });

    const versiuni = (await cere("/api/cereri/transavia/oferte", altCalculator)).corp as { versiune: number; valoare: string; continut: CerereOferta }[];
    expect(versiuni.map((v) => [v.versiune, v.valoare])).toEqual([[2, "91737.81"], [1, "94575.06"]]);
    expect(valoareOferta(versiuni[1]!.continut).valoare).toBe(94575.06);

    // Fisierul clientului vine inapoi byte cu byte: importul se reface identic.
    const inapoi = (await cere("/api/cereri/transavia", altCalculator)).corp as CererePeFir;
    expect(Buffer.from(inapoi.fisier!, "base64").equals(fisier)).toBe(true);

    // Oferta nu se modifica in baza, nici de catre aplicatie.
    await expect(caTenant(app$.db, tenantA, (tx) => tx.update(oferta).set({ valoare: "1" }))).rejects.toThrow();
    // Cererea cu oferta salvata nu se mai sterge.
    expect((await cere("/api/cereri/transavia", cookieA, { method: "DELETE" })).status).toBe(409);
  }, 60_000);
});

describe("mutarea datelor din browser", () => {
  daca()("de două ori: a doua oară nu mai intră nimic", async () => {
    const plan: PlanSantier = {
      id: "S-mut", creat: "2026-10-01T08:00:00.000Z", denumire: "Mutat", client: "C", firma: "RADOIA ISOLIRUNG SRL",
      oferta: "", fisier: "mut.xlsx", destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0,
      pozitii: [{ nr: 1, denumire: "p", um: "ml", cantitate: 10, pretUnitar: 5, foc: false }],
      situatii: [{ id: "ms-1", nr: 1, data: "2026-10-02T08:00:00.000Z", cantitati: { 1: 4 } }],
    };
    const ex = miscareMica("mut-ex", { exemplu: true });
    const d: Mutare = {
      cereri: [cerereMica("mut-c1")],
      oferte: {
        "mut-c1": { numar: "RAD9", data: "01.10.2026", client: "C", obiectiv: "O", valoare: 1234.5, pozitii: 3, cand: "2026-10-01T09:00:00.000Z" },
        "disparuta": { numar: "", data: "", client: "", obiectiv: "", valoare: 1, pozitii: 1, cand: "2026-10-01T09:00:00.000Z" },
      },
      planuri: [plan],
      depozit: {
        miscari: [miscareMica("mut-m1"), ex, miscareMica("mut-st", { anuleaza: "mut-ex" })],
        necesare: [{ id: "mut-n1", creat: "2026-10-01T08:00:00.000Z", fisier: "mut.xlsx", obiectiv: "Mutat", santier: "S-mut", materiale: [], faraNecesar: 0 }],
        ambalaje: { "elastomer|19|22": { unitate: "cutie", continut: 24 } },
      },
    };
    const r1 = (await cere("/api/mutare", cookieA, { method: "POST", body: d })).corp as RezultatMutare;
    expect(r1).toEqual({ cereri: 1, oferte: 1, santiere: 1, situatii: 1, miscari: 1, necesare: 1, ambalaje: 1, oferteFaraCerere: 1 });
    const r2 = (await cere("/api/mutare", cookieA, { method: "POST", body: d })).corp as RezultatMutare;
    expect(r2).toEqual({ cereri: 0, oferte: 0, santiere: 0, situatii: 0, miscari: 0, necesare: 0, ambalaje: 0, oferteFaraCerere: 1 });

    const dupa = (await cere("/api/date", cookieA)).corp as DateComune;
    expect(dupa.oferte["mut-c1"]).toMatchObject({ numar: "RAD9", valoare: 1234.5 });
    expect(dupa.planuri.find((p) => p.id === "S-mut")!.situatii).toHaveLength(1);
    expect(dupa.depozit.ambalaje).toEqual({ "elastomer|19|22": { unitate: "cutie", continut: 24 } });
    expect(dupa.depozit.miscari.some((m) => m.id === "mut-ex" || m.id === "mut-st")).toBe(false);
  });
});


describe("stratul cu model pe server: doar după intrare, ieșirea verificată", () => {
  const trimise: number[] = [];
  const cuModel = creeazaServer({
    db: app$.db,
    trimiteLink: async () => undefined,
    urlAplicatie: "http://test/",
    cookieSecure: false,
    model: {
      cheie: "test", model: "m-test", modelPoze: "m-poze", prag: 0.85, lot: 25, concurenta: 4,
      extrage: async (linii) => {
        trimise.push(linii.length);
        return linii.map((l) => ({
          index: l.index, sistem: "elastomer", diametru_valoare: 22, diametru_tip: "exterior", grosime_mm: 19,
          forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [], incredere: 0.9, motiv: "test",
        }));
      },
      citeste: async () => ({ termeni: [], note: ["din test"], model: "m-poze" }),
    },
  });
  const cereM = async (cale: string, cookie: string, corp?: unknown, csrf = true) => {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (csrf) h[ANTET_CSRF] = "1";
    if (cookie) h["cookie"] = `${COOKIE}=${cookie}`;
    const r = await cuModel.request(cale, { method: corp === undefined ? "GET" : "POST", headers: h, ...(corp !== undefined ? { body: JSON.stringify(corp) } : {}) });
    return { status: r.status, corp: await r.json() as Record<string, unknown> };
  };
  const linii = (n: number) => Array.from({ length: n }, (_, index) => ({ index, text: `Armaflex 19 mm ø22 ${index}` }));

  daca()("fără cont, modelul nu se poate chema", async () => {
    expect((await cereM("/api/extrage", "")).status).toBe(401);
    expect((await cereM("/api/extrage", "", { linii: linii(1) })).status).toBe(401);
    expect((await cereM("/api/poza", "", { imagine: "data:image/jpeg;base64,AA==" })).status).toBe(401);
  });

  daca()("cu cont: răspunde, plafonează la 400 de linii și cere antetul X-Izorep", async () => {
    expect((await cereM("/api/extrage", cookieA)).corp).toMatchObject({ disponibil: true, model: "m-test", lot: 25 });
    expect((await cereM("/api/extrage", cookieA, { linii: linii(2) }, false)).status).toBe(403);
    trimise.length = 0;
    const r = await cereM("/api/extrage", cookieA, { linii: linii(450) });
    expect(r.status).toBe(200);
    expect(trimise).toEqual([400]);
    expect((r.corp["linii"] as unknown[]).length).toBe(400);
    expect(r.corp["trunchiat"]).toBe(50);
  });

  daca()("un răspuns stricat al modelului nu ajunge la ecran", async () => {
    const stricat = creeazaServer({
      db: app$.db, trimiteLink: async () => undefined, urlAplicatie: "http://test/", cookieSecure: false,
      model: { cheie: "test", model: "m", modelPoze: "m", prag: 0.85, lot: 25, concurenta: 4,
        extrage: async (l) => l.map((x) => ({ index: x.index, sistem: "beton" }) as never) },
    });
    const r = await stricat.request("/api/extrage", {
      method: "POST", body: JSON.stringify({ linii: linii(1) }),
      headers: { "content-type": "application/json", [ANTET_CSRF]: "1", cookie: `${COOKIE}=${cookieA}` },
    });
    expect(r.status).toBe(502);
  });

  daca()("poza: doar imagine; răspunsul modelului ajunge la ecran", async () => {
    expect((await cereM("/api/poza", cookieA)).corp).toEqual({ disponibil: true, model: "m-poze" });
    expect((await cereM("/api/poza", cookieA, { imagine: "nu e poza" })).status).toBe(400);
    expect((await cereM("/api/poza", cookieA, { imagine: "data:image/jpeg;base64,AA==" })).corp).toEqual({ termeni: [], note: ["din test"], model: "m-poze" });
  });

  daca()("fără cheie, ecranele aud „indisponibil” și merg pe reguli", async () => {
    expect((await cere("/api/extrage", cookieA)).corp).toMatchObject({ disponibil: false });
    expect((await cere("/api/extrage", cookieA, { method: "POST", body: { linii: linii(1) } })).status).toBe(503);
    expect((await cere("/api/poza", cookieA)).corp).toMatchObject({ disponibil: false });
  });
});

/**
 * Serverul, pe Postgres real (ca tests/db.test.ts): izolarea dintre firme pe
 * tabelele noi, documentele care nu se mai schimba, oferta TRANSAVIA salvata
 * si recitita la ban, mutarea din browser fara dubluri, stratul cu model.
 *
 * Fara intrare (10 octombrie 2026): un server serveste o firma, deci testele
 * fac cate un server pe firma (A, B). Serverul e chemat direct
 * (`app.request`), fara retea. Tenantii de test se sterg ca proprietar
 * (`purjeazaTenant`): aplicatia n-ar putea, si asta e chiar ce se verifica.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CLIENTI, areClienti, bazaDisponibila } from "./conditii.js";
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { caTenant, conecteaza, purjeazaTenant, URL_PROPRIETAR } from "../src/db/client.js";
import { firma, oferta, miscare, tenant } from "../src/db/schema.js";
import { creeazaServer, ANTET_CSRF, LIMITA_IMPLICITA, type OptiuniServer } from "../src/server/app.js";
import type { CererePeFir, DateComune, Mutare, RezultatMutare } from "../src/server/contract.js";
import { importaFisier } from "../src/import/pipeline.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { valoareOferta, type CerereOferta } from "../web/oferta.js";
import type { Miscare } from "../src/stoc/registru.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";

const app$ = conecteaza();
const prop = conecteaza(URL_PROPRIETAR);
const disponibila = bazaDisponibila(await app$.db.execute(sql`select 1`).then(() => true, () => false), "testele serverului");
const daca = () => (disponibila ? it : it.skip);
const aplicatiaEProprietarul = disponibila && await app$.db.execute(sql`
  select current_user = (select tableowner from pg_tables where tablename = 'miscare') as e`)
  .then((r) => (r as unknown as { e: boolean }[])[0]!.e);

const sufix = Date.now();
let tenantA = "";
let tenantB = "";
/** A2: alt server (alt calculator) al aceleiasi firme A. */
type Firma = "A" | "A2" | "B";
const servere = {} as Record<Firma, ReturnType<typeof creeazaServer>>;
const serverPentru = (tenantId: string, extra: Partial<OptiuniServer> = {}) =>
  creeazaServer({ db: app$.db, tenantId, ...extra });

/** O cerere ca din browser, la serverul firmei: JSON, cu antetul CSRF. */
async function cere(cale: string, firma: Firma, init: { method?: string; body?: unknown; faraCsrf?: boolean } = {}) {
  const h: Record<string, string> = { "content-type": "application/json" };
  if (!init.faraCsrf) h[ANTET_CSRF] = "1";
  const r = await servere[firma].request(cale, {
    method: init.method ?? "GET", headers: h,
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await r.text();
  return { status: r.status, corp: text ? JSON.parse(text) as unknown : null, antete: r.headers };
}

async function tenantNou(nume: string): Promise<string> {
  const [t] = await prop.db.insert(tenant).values({ denumire: `${nume}-${sufix}` }).returning();
  await caTenant(prop.db, t!.id, async (tx) => {
    await tx.insert(firma).values({ tenantId: t!.id, cod: "radoia", denumire: "RADOIA ISOLIRUNG SRL", serieOferta: "RAD" });
  });
  return t!.id;
}

beforeAll(async () => {
  if (!disponibila) return;
  tenantA = await tenantNou("A");
  tenantB = await tenantNou("B");
  servere.A = serverPentru(tenantA);
  servere.A2 = serverPentru(tenantA);
  servere.B = serverPentru(tenantB);
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
  articol: { cheie: "elastomer|tub|19|22|Armaflex", sistem: "elastomer", grosime_mm: 19, rand: 22, forma: "tub", um: "ml", marca: "Armaflex" },
  pret: { valoare: 3.1 }, ...extra,
});

describe("serverul unei firme", () => {
  daca()("spune ce firmă servește", async () => {
    expect((await cere("/api/stare", "A")).corp).toEqual({ firma: `A-${sufix}` });
  });

  daca()("o cerere prea mare e refuzată înainte să ajungă la bază", async () => {
    const mare = "x".repeat(LIMITA_IMPLICITA + 1);
    const r = await cere("/api/miscari", "A", { method: "POST", body: miscareMica("mare", { nota: mare }) });
    expect(r.status).toBe(413);
  });

  daca()("fără antetul X-Izorep, nicio schimbare nu trece (CSRF)", async () => {
    const r = await cere("/api/miscari", "A", { method: "POST", body: miscareMica("csrf"), faraCsrf: true });
    expect(r.status).toBe(403);
  });
});

describe("izolarea dintre firme, pe tabelele noi", () => {
  daca()("ce scrie A nu vede B, nici cerând direct", async () => {
    expect((await cere("/api/cereri/izo-1", "A", { method: "PUT", body: cerereMica("izo-1") })).status).toBe(200);
    expect((await cere("/api/miscari", "A", { method: "POST", body: miscareMica("izo-m1") })).status).toBe(200);

    const dA = (await cere("/api/date", "A")).corp as DateComune;
    expect(dA.depozit.miscari.map((m) => m.id)).toContain("izo-m1");
    expect(dA.depozit.miscari.find((m) => m.id === "izo-m1")).toEqual(miscareMica("izo-m1"));

    const dB = (await cere("/api/date", "B")).corp as DateComune;
    expect(dB.depozit.miscari).toEqual([]);
    expect((await cere("/api/cereri/izo-1", "B")).status).toBe(404);
    expect((await cere("/api/cereri", "B")).corp).toEqual([]);
    // Acelasi id la B e alta inregistrare, nu o suprascriere a lui A.
    expect((await cere("/api/cereri/izo-1", "B", { method: "PUT", body: cerereMica("izo-1") })).status).toBe(200);
    expect((await cere("/api/cereri", "A")).corp).toHaveLength(1);
  });

  daca()("fără context de tenant, aplicația nu vede niciun rând nou", async () => {
    const r = await app$.db.execute(sql`select count(*)::int as n from miscare`);
    expect((r as unknown as { n: number }[])[0]!.n).toBe(0);
  });
});

describe("ce nu se mai schimbă", () => {
  daca()("mișcarea de stoc: nici UPDATE, nici DELETE, nici ca aplicație cu tenantul pus", async () => {
    await cere("/api/miscari", "A", { method: "POST", body: miscareMica("imu-m1") });
    await expect(caTenant(app$.db, tenantA, (tx) => tx.update(miscare).set({ cantitate: "1" }).where(sql`id = 'imu-m1'`)))
      .rejects.toThrow();
    await expect(caTenant(app$.db, tenantA, (tx) => tx.delete(miscare).where(sql`id = 'imu-m1'`))).rejects.toThrow();
  });

  // Fara `izorep_app` (baza unde proprietarul n-a avut CREATEROLE, 0002),
  // aplicatia E proprietarul: purjarea nu se mai poate rezerva unui alt rol.
  (aplicatiaEProprietarul ? it.skip : daca())("purjarea e rezervată proprietarului, nici cu setarea pusă de aplicație", async () => {
    await cere("/api/miscari", "A", { method: "POST", body: miscareMica("imu-p1") });
    await expect(caTenant(app$.db, tenantA, async (tx) => {
      await tx.execute(sql`select set_config('app.purjare', ${tenantA}, true)`);
      await tx.delete(miscare).where(sql`id = 'imu-p1'`);
    })).rejects.toThrow();
  });

  daca()("o mișcare trimisă de două ori intră o dată; datele de exemplu nu intră deloc", async () => {
    await cere("/api/miscari", "A", { method: "POST", body: miscareMica("dub-1") });
    await cere("/api/miscari", "A", { method: "POST", body: miscareMica("dub-1") });
    const d = (await cere("/api/date", "A")).corp as DateComune;
    expect(d.depozit.miscari.filter((m) => m.id === "dub-1")).toHaveLength(1);
    const ex = await cere("/api/miscari", "A", { method: "POST", body: miscareMica("ex-1", { exemplu: true }) });
    expect(ex.status).toBe(400);
  });

  daca()("situațiile: se șterge doar ultima, iar planul se îngheață la prima", async () => {
    const plan: PlanSantier = {
      id: "S-imu", creat: "2026-10-09T08:00:00.000Z", denumire: "Test", client: "C", firma: "RADOIA ISOLIRUNG SRL",
      oferta: "", fisier: "test.xlsx", destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0,
      pozitii: [{ nr: 1, denumire: "p", um: "ml", cantitate: 10, pretUnitar: 5, foc: false }], situatii: [],
    };
    expect((await cere("/api/santiere/S-imu", "A", { method: "PUT", body: plan })).status).toBe(200);
    // Fara situatii, planul se poate reface din oferta.
    expect((await cere("/api/santiere/S-imu", "A", { method: "PUT", body: { ...plan, denumire: "Test 2" } })).status).toBe(200);
    for (const nr of [1, 2]) {
      const s = { id: `sit-${nr}`, nr, data: "2026-10-09T08:00:00.000Z", cantitati: { 1: 2 } };
      expect((await cere("/api/santiere/S-imu/situatii", "A", { method: "POST", body: s })).status).toBe(200);
    }
    expect((await cere("/api/santiere/S-imu/situatii", "A", { method: "POST", body: { id: "x", nr: 5, data: "2026-10-09T08:00:00.000Z", cantitati: {} } })).status).toBe(409);
    expect((await cere("/api/santiere/S-imu/situatii/1?id=sit-1", "A", { method: "DELETE" })).status).toBe(409);
    // Alta situatie 2 decat cea vazuta (stearsa si scrisa din nou de un coleg): nu se sterge.
    expect((await cere("/api/santiere/S-imu/situatii/2?id=alta", "A", { method: "DELETE" })).status).toBe(409);
    expect((await cere("/api/santiere/S-imu/situatii/2", "A", { method: "DELETE" })).status).toBe(400);
    expect((await cere("/api/santiere/S-imu", "A", { method: "PUT", body: { ...plan, pozitii: [] } })).status).toBe(409);
    expect((await cere("/api/santiere/S-imu", "A", { method: "DELETE" })).status).toBe(409);
    expect((await cere("/api/santiere/S-imu/situatii/2?id=sit-2", "A", { method: "DELETE" })).status).toBe(200);

    const d = (await cere("/api/date", "A")).corp as DateComune;
    const p = d.planuri.find((x) => x.id === "S-imu")!;
    expect(p.denumire).toBe("Test 2");
    expect(p.situatii.map((s) => s.nr)).toEqual([1]);
  });
});

describe("oferta TRANSAVIA salvată pe un calculator se deschide pe altul la 94.575,06 €", () => {
  const CERERE = `${CLIENTI}/cerere-de-oferta-transavia-abur.xlsx`;

  it.skipIf(!disponibila || !areClienti)("salvată, versiune nouă la fiecare descărcare, valoarea socotită pe server din linii", async () => {
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
    expect((await cere("/api/cereri/transavia", "A", { method: "PUT", body: c })).status).toBe(200);

    const r1 = await cere("/api/cereri/transavia/oferte", "A", { method: "POST", body: { firma: "radoia", continut } });
    expect(r1.corp).toEqual({ versiune: 1, valoare: 94575.06 });
    const r2 = await cere("/api/cereri/transavia/oferte", "A", { method: "POST", body: { firma: "radoia", continut: { ...continut, antet: { ...continut.antet, discountProcent: 3 } } } });
    expect(r2.corp).toEqual({ versiune: 2, valoare: 91737.81 });

    // „Celalalt calculator”: alt server al aceleiasi firme.
    const altCalculator = "A2";
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
    expect((await cere("/api/cereri/transavia", "A", { method: "DELETE" })).status).toBe(409);
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
    const r1 = (await cere("/api/mutare", "A", { method: "POST", body: d })).corp as RezultatMutare;
    expect(r1).toEqual({ cereri: 1, oferte: 1, santiere: 1, situatii: 1, miscari: 1, necesare: 1, ambalaje: 1, comenzi: 0, oferteFaraCerere: 1 });
    const r2 = (await cere("/api/mutare", "A", { method: "POST", body: d })).corp as RezultatMutare;
    expect(r2).toEqual({ cereri: 0, oferte: 0, santiere: 0, situatii: 0, miscari: 0, necesare: 0, ambalaje: 0, comenzi: 0, oferteFaraCerere: 1 });

    const dupa = (await cere("/api/date", "A")).corp as DateComune;
    expect(dupa.oferte["mut-c1"]).toMatchObject({ numar: "RAD9", valoare: 1234.5 });
    expect(dupa.planuri.find((p) => p.id === "S-mut")!.situatii).toHaveLength(1);
    expect(dupa.depozit.ambalaje).toEqual({ "elastomer|19|22": { unitate: "cutie", continut: 24 } });
    expect(dupa.depozit.miscari.some((m) => m.id === "mut-ex" || m.id === "mut-st")).toBe(false);
  });
});


describe("stratul cu model pe server: ieșirea verificată", () => {
  const trimise: number[] = [];
  const cuModel = () => serverPentru(tenantA, {
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
  const cereM = async (cale: string, corp?: unknown, csrf = true) => {
    const h: Record<string, string> = { "content-type": "application/json" };
    if (csrf) h[ANTET_CSRF] = "1";
    const r = await cuModel().request(cale, { method: corp === undefined ? "GET" : "POST", headers: h, ...(corp !== undefined ? { body: JSON.stringify(corp) } : {}) });
    return { status: r.status, corp: await r.json() as Record<string, unknown> };
  };
  const linii = (n: number) => Array.from({ length: n }, (_, index) => ({ index, text: `Armaflex 19 mm ø22 ${index}` }));

  daca()("răspunde, plafonează la 400 de linii și cere antetul X-Izorep", async () => {
    expect((await cereM("/api/extrage")).corp).toMatchObject({ disponibil: true, model: "m-test", lot: 25 });
    expect((await cereM("/api/extrage", { linii: linii(2) }, false)).status).toBe(403);
    trimise.length = 0;
    const r = await cereM("/api/extrage", { linii: linii(450) });
    expect(r.status).toBe(200);
    expect(trimise).toEqual([400]);
    expect((r.corp["linii"] as unknown[]).length).toBe(400);
    expect(r.corp["trunchiat"]).toBe(50);
  });

  daca()("un răspuns stricat al modelului nu ajunge la ecran", async () => {
    const stricat = serverPentru(tenantA, {
      model: { cheie: "test", model: "m", modelPoze: "m", prag: 0.85, lot: 25, concurenta: 4,
        extrage: async (l) => l.map((x) => ({ index: x.index, sistem: "beton" }) as never) },
    });
    const r = await stricat.request("/api/extrage", {
      method: "POST", body: JSON.stringify({ linii: linii(1) }),
      headers: { "content-type": "application/json", [ANTET_CSRF]: "1" },
    });
    expect(r.status).toBe(502);
  });

  daca()("poza: doar imagine; răspunsul modelului ajunge la ecran", async () => {
    expect((await cereM("/api/poza")).corp).toEqual({ disponibil: true, model: "m-poze" });
    expect((await cereM("/api/poza", { imagine: "nu e poza" })).status).toBe(400);
    expect((await cereM("/api/poza", { imagine: "data:image/jpeg;base64,AA==" })).corp).toEqual({ termeni: [], note: ["din test"], model: "m-poze" });
  });

  daca()("fără cheie, ecranele aud „indisponibil” și merg pe reguli", async () => {
    expect((await cere("/api/extrage", "A")).corp).toMatchObject({ disponibil: false });
    expect((await cere("/api/extrage", "A", { method: "POST", body: { linii: linii(1) } })).status).toBe(503);
    expect((await cere("/api/poza", "A")).corp).toMatchObject({ disponibil: false });
  });
});

describe("comenzile și recepția (Faza 4): operații, nu diferențe de stare", () => {
  const cochilie = { cheie: "vata_minerala|tub|50|140", sistem: "vata_minerala", grosime_mm: 50, rand: 140, forma: "tub" as const, um: "ml" as const };
  const ciorna = (id: string, cantitate = 350) => ({
    id, creat: "2026-07-13T10:37:00.000Z", furnizor: "Isoline", firma: "RADOIA ISOLIRUNG SRL",
    santier: "S-TR", spre: "S-TR", linii: [{ id: "L1", articol: cochilie, cantitate }],
  });
  const aviz = (ids: string[]) => ({
    document: { tip: "aviz", serie: "CS", numar: "20261262", data: "2026-07-17" },
    linii: [{ linie: "L1", cantitate: 350 }], ids, data: "2026-07-17T08:00:00.000Z",
  });
  const date = async (f: Firma = "A") => (await cere("/api/date", f)).corp as DateComune;

  daca()("ciorna se scrie și se rescrie; trimisă, nu se mai schimbă și nu se șterge", async () => {
    expect((await cere("/api/comenzi/co-1", "A", { method: "PUT", body: ciorna("co-1", 300) })).status).toBe(200);
    expect((await cere("/api/comenzi/co-1", "A", { method: "PUT", body: ciorna("co-1") })).status).toBe(200);
    expect((await cere("/api/comenzi/co-1/trimite", "A", { method: "POST", body: { cand: "2026-07-13T10:40:00.000Z" } })).status).toBe(200);
    const c = (await date()).depozit.comenzi!.find((x) => x.id === "co-1")!;
    expect([c.linii[0]!.cantitate, c.trimisa]).toEqual([350, "2026-07-13T10:40:00.000Z"]);
    const din = await cere("/api/comenzi/co-1", "A", { method: "PUT", body: ciorna("co-1", 1) });
    expect(din.status).toBe(409);
    expect((await cere("/api/comenzi/co-1", "A", { method: "DELETE" })).status).toBe(409);
    // Nici pe lângă aplicație: trigger-ul din baza refuză.
    await expect(caTenant(app$.db, tenantA, (tx) => tx.execute(sql`update comanda set continut = '{}' where id = 'co-1'`)))
      .rejects.toThrow();
    // Firma B nu vede comanda firmei A.
    expect((await date("B")).depozit.comenzi).toEqual([]);
  });

  daca()("avizul pune marfa pe șantier; trimis de două ori, nu se dublează", async () => {
    await cere("/api/comenzi/co-2", "A", { method: "PUT", body: ciorna("co-2") });
    expect((await cere("/api/comenzi/co-2/receptii", "A", { method: "POST", body: aviz(["r-1"]) })).corp)
      .toEqual({ eroare: "Comanda nu a fost trimisă: trimite-o întâi." });
    await cere("/api/comenzi/co-2/trimite", "A", { method: "POST", body: { cand: "2026-07-13T10:40:00.000Z" } });
    expect((await cere("/api/comenzi/co-2/receptii", "A", { method: "POST", body: aviz(["r-1"]) })).corp).toEqual({ scrise: 1 });
    expect((await cere("/api/comenzi/co-2/receptii", "A", { method: "POST", body: aviz(["r-1"]) })).corp).toEqual({ scrise: 0 });
    const m = (await date()).depozit.miscari.find((x) => x.id === "r-1")!;
    expect(m).toMatchObject({ tip: "intrare", spre: "S-TR", cantitate: 350, comanda: { id: "co-2", linie: "L1" }, furnizor: "Isoline" });
    expect(m.document).toEqual({ tip: "aviz", serie: "CS", numar: "20261262", data: "2026-07-17" });
  });

  daca()("factura înlocuiește avizul: storno și intrare cu prețul ei, în lei și euro", async () => {
    const r = await cere("/api/comenzi/co-2/facturi", "A", { method: "POST", body: {
      aviz: "20261262", ids: ["f-s", "f-1"], data: "2026-07-20T08:00:00.000Z",
      factura: { document: { tip: "factura", serie: "CS", numar: "202627295", data: "2026-07-20" }, curs: 5.31,
        preturi: { L1: { valoare: 39.7719, moneda: "RON" } } },
    } });
    expect(r.corp).toEqual({ scrise: 2 });
    const d = await date();
    expect(d.depozit.miscari.find((x) => x.id === "f-s")!.anuleaza).toBe("r-1");
    expect(d.depozit.miscari.find((x) => x.id === "f-1")!.pret).toEqual({ valoare: 7.49, lei: 39.7719, curs: 5.31 });
    // A doua oară avizul nu mai are intrări: nimic de înlocuit.
    const iar = await cere("/api/comenzi/co-2/facturi", "A", { method: "POST", body: {
      aviz: "20261262", ids: ["g-s", "g-1"], data: "2026-07-20T08:00:00.000Z",
      factura: { document: { tip: "factura", numar: "202627295", data: "2026-07-20" }, curs: 5.31, preturi: {} },
    } });
    expect(iar.status).toBe(409);
  });

  daca()("anularea oprește comanda; nu se mai recepționează pe ea", async () => {
    await cere("/api/comenzi/co-3", "A", { method: "PUT", body: ciorna("co-3") });
    await cere("/api/comenzi/co-3/trimite", "A", { method: "POST", body: { cand: "2026-07-14T00:00:00.000Z" } });
    await cere("/api/comenzi/co-3/anuleaza", "A", { method: "POST", body: { cand: "2026-07-15T00:00:00.000Z" } });
    expect((await date()).depozit.comenzi!.find((x) => x.id === "co-3")!.anulata).toBe("2026-07-15T00:00:00.000Z");
    expect((await cere("/api/comenzi/co-3/receptii", "A", { method: "POST", body: aviz(["r-9"]) })).corp)
      .toEqual({ eroare: "Comanda e anulată." });
  });

  daca()("returul la furnizor: din stoc, pe linia comenzii; nu mai mult decât a venit", async () => {
    // co-2 are factura de mai sus: 350 ml pe S-TR, 7,49 €/ml.
    const retur = (id: string, cantitate: number) => ({ linie: "L1", cantitate, din: "S-TR", motiv: "strivite", id, data: "2026-07-25T00:00:00.000Z" });
    expect((await cere("/api/comenzi/co-2/retururi", "A", { method: "POST", body: retur("ret-1", 400) })).corp)
      .toEqual({ eroare: "Se returnează mai mult decât a venit pe linia asta." });
    expect((await cere("/api/comenzi/co-2/retururi", "A", { method: "POST", body: retur("ret-1", 20) })).corp).toEqual({ scrise: 1 });
    expect((await cere("/api/comenzi/co-2/retururi", "A", { method: "POST", body: retur("ret-1", 20) })).corp).toEqual({ scrise: 0 });
    const m = (await date()).depozit.miscari.find((x) => x.id === "ret-1")!;
    expect(m).toMatchObject({ tip: "retur", din: "S-TR", furnizor: "Isoline", cantitate: 20, comanda: { id: "co-2", linie: "L1" },
      pret: { valoare: 7.49, lei: 39.7719, curs: 5.31 } });
    expect(m.spre).toBeUndefined();
    // Baza nu primește un retur fără depozit de sosire și fără furnizor.
    await expect(caTenant(app$.db, tenantA, (tx) => tx.execute(sql`insert into miscare (tenant_id, id, data, tip, articol_cheie, cantitate, din)
      values (${tenantA}, 'ret-x', now(), 'retur', 'vata_minerala|tub|50|140', 1, 'S-TR')`))).rejects.toThrow();
  });

  daca()("avizul atașat se păstrează și se deschide; nu se schimbă", async () => {
    const pdf = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 aviz").toString("base64")}`;
    const doc = { id: "doc-1", tip: "aviz", numar: "CS 20261262", nume: "A-CS-20261262.PDF", fisier: pdf };
    expect((await cere("/api/comenzi/co-1/documente", "A", { method: "POST", body: { ...doc, fisier: "nu" } })).status).toBe(400);
    expect((await cere("/api/comenzi/co-2/documente", "A", { method: "POST", body: doc })).status).toBe(200);
    expect((await date()).depozit.documente).toEqual([{ id: "doc-1", comanda: "co-2", tip: "aviz", numar: "CS 20261262", nume: "A-CS-20261262.PDF" }]);
    const r = await servere.A.request("/api/documente/doc-1");
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(Buffer.from(await r.arrayBuffer()).toString()).toBe("%PDF-1.4 aviz");
    expect((await servere.B.request("/api/documente/doc-1")).status).toBe(404);
    await expect(caTenant(app$.db, tenantA, (tx) => tx.execute(sql`delete from document_furnizor where id = 'doc-1'`))).rejects.toThrow();
    // Pe o ciornă nu se atașează nimic: avizul vine după trimitere.
    await cere("/api/comenzi/co-4", "A", { method: "PUT", body: ciorna("co-4") });
    expect((await cere("/api/comenzi/co-4/documente", "A", { method: "POST", body: { ...doc, id: "doc-2" } })).status).toBe(409);
  });

  daca()("avizul citit de model trece prin schemă înainte să ajungă la ecran", async () => {
    const citire = JSON.parse(readFileSync("tests/fixtures-aviz-isoline.json", "utf8")).aviz;
    const server = serverPentru(tenantA, { model: { cheie: "t", model: "m", modelPoze: "m-poze", prag: 0.85, lot: 25, concurenta: 4,
      citesteAviz: async () => ({ ...citire, model: "m-poze" }) } });
    const post = (corp: unknown) => server.request("/api/aviz", {
      method: "POST", body: JSON.stringify(corp), headers: { "content-type": "application/json", [ANTET_CSRF]: "1" },
    });
    expect(await (await server.request("/api/aviz")).json()).toEqual({ disponibil: true, model: "m-poze" });
    expect((await post({ fisier: "data:text/plain;base64,AA==" })).status).toBe(400);
    const r = await post({ fisier: "data:application/pdf;base64,AA==", nume: "aviz.pdf" });
    expect(await r.json()).toMatchObject({ tip: "aviz", numar: "20261262", linii: [{ denumire: "COCHILTECH AL. 140 X 50", cantitate: 350 }] });
    const stricat = serverPentru(tenantA, { model: { cheie: "t", model: "m", modelPoze: "m", prag: 0.85, lot: 25, concurenta: 4,
      citesteAviz: async () => ({ tip: "chitanta" }) as never } });
    expect((await stricat.request("/api/aviz", { method: "POST", body: JSON.stringify({ fisier: "data:image/png;base64,AA==" }),
      headers: { "content-type": "application/json", [ANTET_CSRF]: "1" } })).status).toBe(502);
    expect((await cere("/api/aviz", "A")).corp).toMatchObject({ disponibil: false });
  });
});

describe("Faza 5: atelierul și responsabilii, pe server", () => {
  daca()("tabla pusă deoparte în atelier pentru un șantier se vede pe alt calculator al firmei", async () => {
    const tabla: Miscare["articol"] = { cheie: "tabla|tabla|0.8|", sistem: "tabla", grosime_mm: 0.8, rand: null, forma: "tabla", um: "m2" };
    const intrare = miscareMica("f5-intrare", { articol: tabla, cantitate: 40, furnizor: "ISOLINE" });
    const atelier = miscareMica("f5-atelier", {
      tip: "transfer", articol: tabla, cantitate: 12, din: "central", spre: "atelier", lucrareId: "S-f5", nota: "10 ml ø100, 3 coturi, 10 carcase",
    });
    delete (atelier as Partial<Miscare>).pret;
    for (const m of [intrare, atelier]) expect((await cere("/api/miscari", "A", { method: "POST", body: m })).status).toBe(200);
    const d = (await cere("/api/date", "A2")).corp as { depozit: { miscari: Miscare[] } };
    const { inAtelier } = await import("../src/stoc/locuri.js");
    expect(inAtelier(d.depozit.miscari).map((x) => [x.pentru, x.cantitate, x.cereri]))
      .toEqual([["S-f5", 12, ["10 ml ø100, 3 coturi, 10 carcase"]]]);
  });

  daca()("responsabilul centralului și al atelierului se scrie; un șantier necunoscut e refuzat", async () => {
    expect((await cere("/api/depozite/atelier", "A", { method: "PUT", body: { responsabil: "Marius" } })).status).toBe(200);
    expect((await cere("/api/depozite/central", "A", { method: "PUT", body: { responsabil: "Ana" } })).status).toBe(200);
    expect((await cere("/api/depozite/nu-exista", "A", { method: "PUT", body: { responsabil: "X" } })).status).toBe(404);
    const d = (await cere("/api/date", "A2")).corp as { depozit: { responsabili: Record<string, string> } };
    expect(d.depozit.responsabili).toMatchObject({ atelier: "Marius", central: "Ana" });
    // Șters: rămâne fără responsabil.
    await cere("/api/depozite/central", "A", { method: "PUT", body: { responsabil: "" } });
    const d2 = (await cere("/api/date", "A2")).corp as { depozit: { responsabili: Record<string, string> } };
    expect(d2.depozit.responsabili["central"]).toBeUndefined();
    // Altă firmă nu vede nimic.
    const b = (await cere("/api/date", "B")).corp as { depozit: { responsabili: Record<string, string> } };
    expect(b.depozit.responsabili).toEqual({});
  });
});

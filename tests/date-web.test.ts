/**
 * `web/date.ts`: ecranele scriu starea intreaga (`scriePlanuri`, `scrieDepozit`),
 * iar la server pleaca doar diferenta, in ordine. Aici se verifica ce cereri
 * pleaca, cu un `fetch` care le noteaza — serverul are testele lui.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanSantier } from "../src/lucrari/situatii.js";
import type { Miscare } from "../src/stoc/registru.js";

const cereri: string[] = [];
let date: unknown;

function raspuns(status: number, corp: unknown): Response {
  return new Response(JSON.stringify(corp), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  cereri.length = 0;
  date = { planuri: [], depozit: { miscari: [], necesare: [], ambalaje: {} }, oferte: {} };
  vi.resetModules();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const metoda = init?.method ?? "GET";
    if (metoda !== "GET") cereri.push(`${metoda} ${url}`);
    expect(metoda === "GET" || (init?.headers as Record<string, string>)["x-izorep"] === "1").toBe(true);
    if (url === "/api/eu") return raspuns(200, { nume: "Birou", email: "b@x.ro", rol: "birou" });
    if (url === "/api/date") return raspuns(200, date);
    if (url.split("?")[0]!.endsWith("/situatii/1") && metoda === "DELETE") return raspuns(409, { eroare: "se șterge doar ultima" });
    return raspuns(200, { ok: true });
  }));
});

const plan = (situatii: PlanSantier["situatii"] = []): PlanSantier => ({
  id: "S-1", creat: "2026-10-09T08:00:00.000Z", denumire: "T", client: "C", firma: "RADOIA ISOLIRUNG SRL",
  oferta: "", fisier: "t.xlsx", destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0,
  pozitii: [{ nr: 1, denumire: "p", um: "ml", cantitate: 10, pretUnitar: 5, foc: false }], situatii,
});
const sit = (nr: number) => ({ id: `s${nr}`, nr, data: "2026-10-09T08:00:00.000Z", cantitati: { 1: nr } });
const misc = (id: string, exemplu = false): Miscare => ({
  id, data: "2026-10-09T08:00:00.000Z", tip: "intrare", cantitate: 1, spre: "central",
  articol: { cheie: "vata_minerala|50|114", sistem: "vata_minerala", grosime_mm: 50, rand: 114, um: "m2" },
  ...(exemplu ? { exemplu: true as const } : {}),
});

describe("web/date.ts pe server: pleacă doar diferența", () => {
  it("șantier nou cu situație: întâi șantierul, apoi situația; a doua scriere identică nu trimite nimic", async () => {
    const d = await import("../web/date.js");
    expect(await d.porneste()).toBe("server");
    d.scriePlanuri([plan([sit(1)])]);
    await d.reimprospateaza();
    expect(cereri).toEqual(["PUT /api/santiere/S-1", "POST /api/santiere/S-1/situatii"]);

    // Serverul are acum ce s-a scris; o scriere fara schimbare nu pleaca.
    date = { ...(date as object), planuri: [plan([sit(1)])] };
    await d.reimprospateaza();
    cereri.length = 0;
    d.scriePlanuri(d.citestePlanuri());
    await d.reimprospateaza();
    expect(cereri).toEqual([]);
  });

  it("o mișcare nouă pleacă o dată; cele de exemplu deloc", async () => {
    const d = await import("../web/date.js");
    await d.porneste();
    const st = d.citesteDepozit();
    d.scrieDepozit({ ...st, miscari: [...st.miscari, misc("m1"), misc("ex", true)] });
    await d.reimprospateaza();
    expect(cereri).toEqual(["POST /api/miscari"]);
  });

  it("o scriere refuzată ajunge pe ecran, iar copia se ia din nou de pe server", async () => {
    const d = await import("../web/date.js");
    date = { ...(date as object), planuri: [plan([sit(1), sit(2)])] };
    await d.porneste();
    const mesaje: string[] = [];
    d.laEroare((m) => mesaje.push(m));
    // Ecranul scoate prima situatie (n-ar trebui): serverul refuza.
    d.scriePlanuri([plan([sit(2)])]);
    await d.reimprospateaza();
    expect(mesaje).toEqual(["Nu s-a salvat pe server: se șterge doar ultima"]);
    expect(d.citestePlanuri()[0]!.situatii.map((s) => s.nr)).toEqual([1, 2]);
  });

  it("după un refuz, ecranul vechi nu mai poate șterge ce a scris un coleg", async () => {
    // Pe server: situatia 1. Ecranul lui A o citeste si tine lista la el.
    date = { ...(date as object), planuri: [plan([sit(1)])] };
    const d = await import("../web/date.js");
    await d.porneste();
    const mesaje: string[] = [];
    d.laEroare((m) => mesaje.push(m));
    let redesenari = 0;
    d.laReimprospatare(() => { redesenari++; });
    const peEcran = d.citestePlanuri();

    // Intre timp B scrie situatia 2; A scrie si el o situatie 2, refuzata.
    const aLuiB = { ...sit(2), id: "b2" };
    date = { ...(date as object), planuri: [plan([sit(1), aLuiB])] };
    vi.mocked(fetch).mockImplementationOnce(async () => raspuns(409, { eroare: "Situația 2 nu urmează după ultima" }));
    peEcran[0]!.situatii.push({ ...sit(2), id: "a2" });
    d.scriePlanuri(peEcran);
    await vi.waitFor(() => expect(redesenari).toBe(1));

    // Ecranul lui A, inca nedesenat din nou, mai scrie o data lista lui.
    cereri.length = 0;
    d.scriePlanuri(peEcran);
    await new Promise((r) => setTimeout(r, 0));
    expect(cereri).toEqual([]);
    expect(mesaje.at(-1)).toMatch(/fă din nou ultima modificare/);

    // Dupa redesenare (copia luata din nou), scrierile merg; stergerea poarta id-ul.
    await d.reimprospateaza();
    d.scriePlanuri([plan([sit(1)])]);
    await d.reimprospateaza();
    expect(cereri).toEqual(["DELETE /api/santiere/S-1/situatii/2?id=b2"]);
  });

  it("fără server (linkul demo), modul e „browser”", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>404</html>", { status: 404 })));
    const d = await import("../web/date.js");
    expect(await d.porneste()).toBe("browser");
  });
});

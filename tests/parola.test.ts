/**
 * Conturile, fără bază (21 octombrie 2026): parolele (scrypt, comparație în
 * timp constant, regulile pentru o parolă nouă), antetele de securitate, poarta
 * pe `/api` și ce intră în jurnal. Intrarea cu bază e în `conturi.test.ts`.
 */
import { describe, expect, it } from "vitest";
import type { Baza } from "../src/db/client.js";
import { ANTET_CSRF, creeazaServer, RUTA_VIATA } from "../src/server/app.js";
import { hashParola, parolaTemporara, problemaParola, verificaParola } from "../src/server/parola.js";
import { actiuneDin } from "../src/server/jurnal.js";
import { amprenteScripturi, blocariIntrare, limitaIncercari } from "../src/server/securitate.js";

describe("parolele", () => {
  it("se păstrează doar ca scrypt cu sare: aceeași parolă dă alt hash, iar verificarea merge", async () => {
    const a = await hashParola("tehnic-de-proba-1");
    const b = await hashParola("tehnic-de-proba-1");
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain("tehnic");
    expect(await verificaParola("tehnic-de-proba-1", a)).toBe(true);
    expect(await verificaParola("tehnic-de-proba-2", a)).toBe(false);
    expect(await verificaParola("orice", "md5$abc")).toBe(false);
  });

  it("o parolă nouă: cel puțin 10 caractere și nu dintre cele mai folosite", () => {
    expect(problemaParola("scurta1")).toContain("10 caractere");
    expect(problemaParola("1234567890")).toContain("ușor de ghicit");
    expect(problemaParola("aaaaaaaaaaaa")).toContain("ușor de ghicit");
    expect(problemaParola("zapada-de-iulie-7")).toBeNull();
  });

  it("parola temporară se dictează ușor: fără 0/O și 1/l", () => {
    const p = parolaTemporara();
    expect(p).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(p).not.toMatch(/[01lio]/);
  });
});

describe("poarta și antetele", () => {
  const server = creeazaServer({ db: {} as Baza, tenantId: "t", scripturi: ["'sha256-abc'"] });

  it("fără sesiune, datele răspund 401; Render își vede viața", async () => {
    expect((await server.request("/api/date")).status).toBe(401);
    expect((await server.request("/api/jurnal")).status).toBe(401);
    expect((await server.request(RUTA_VIATA)).status).toBe(200);
  });

  it("intrarea cere antetul CSRF: un formular de pe alt site nu poate încerca parole", async () => {
    const r = await server.request("/api/intrare", { method: "POST", body: JSON.stringify({ email: "a@b.ro", parola: "x" }) });
    expect(r.status).toBe(403);
  });

  it("CSP, fără încadrare, nosniff; datele nu se țin în cache; HSTS doar pe https", async () => {
    const r = await server.request(RUTA_VIATA);
    const csp = r.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("script-src 'self' 'sha256-abc'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(r.headers.get("x-frame-options")).toBe("DENY");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("strict-transport-security")).toBeNull();
    const https = await server.request(RUTA_VIATA, { headers: { "x-forwarded-proto": "https" } });
    expect(https.headers.get("strict-transport-security")).toContain("max-age=");
  });

  it("amprenta scriptului inline al temei intră în CSP; scripturile cu src, nu", () => {
    const a = amprenteScripturi(`<script>let a = 1;</script><script type="module" src="/x.js"></script>`);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatch(/^'sha256-[A-Za-z0-9+/=]{44}'$/);
  });

  it("de pe aceeași adresă, cel mult 20 de încercări într-un sfert de oră", () => {
    const l = limitaIncercari(3, 1000);
    expect([1, 2, 3, 4].map(() => l.permis("ip", 0))).toEqual([true, true, true, false]);
    expect(l.permis("alt-ip", 0)).toBe(true);
    expect(l.permis("ip", 2000)).toBe(true);
  });

  it("parolele greșite blochează cheia (cont + adresă) la prag, până trece durata; intrarea bună o golește", () => {
    const b = blocariIntrare(3, 1000);
    expect([b.greseala("a|1", 0), b.greseala("a|1", 0)]).toEqual([null, null]);
    expect(b.greseala("a|1", 0)).toBe(1000);
    expect(b.blocatPana("a|1", 500)).toBe(1000);
    expect(b.blocatPana("a|2", 500)).toBeNull();
    expect(b.blocatPana("a|1", 1000)).toBeNull();
    expect(b.greseala("a|1", 1000)).toBeNull();
    b.greseala("a|1", 1000);
    b.reusita("a|1");
    expect(b.greseala("a|1", 1000)).toBeNull();
  });

  it(`${ANTET_CSRF} rămâne cerut pe orice scriere`, async () => {
    expect((await server.request("/api/miscari", { method: "POST", body: "{}" })).status).toBe(403);
  });
});

describe("jurnalul: ce a făcut omul, în cuvintele lui", () => {
  it("scrierile au numele lor; citirile și modelul nu intră", () => {
    expect(actiuneDin("POST", "/api/comenzi/c-1/trimite")).toEqual({ actiune: "a trimis comanda", obiect: "c-1" });
    expect(actiuneDin("PUT", "/api/cereri/abc%20d")).toEqual({ actiune: "a salvat cererea", obiect: "abc d" });
    expect(actiuneDin("GET", "/api/date")).toBeNull();
    expect(actiuneDin("POST", "/api/poza")).toBeNull();
    expect(actiuneDin("POST", "/api/ceva-nou")).toEqual({ actiune: "POST /api/ceva-nou", obiect: null });
  });
});

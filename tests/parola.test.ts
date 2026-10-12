/**
 * Parola comuna pe site (`src/server/parola.ts`): poarta de pe Render pana
 * revin conturile. Fara baza: poarta raspunde inaintea oricarei rute care ar
 * atinge-o, deci un `db` gol ajunge.
 */
import { describe, it, expect } from "vitest";
import type { Baza } from "../src/db/client.js";
import { creeazaServer } from "../src/server/app.js";
import { RUTA_VIATA } from "../src/server/parola.js";

const basic = (user: string, parola: string) => `Basic ${Buffer.from(`${user}:${parola}`).toString("base64")}`;
const server = creeazaServer({ db: {} as Baza, tenantId: "t", parola: "zapada-de-iulie" });

describe("parola comună", () => {
  it("fără parolă: 401, cu cererea de parolă pentru browser, și nimic din date", async () => {
    for (const ruta of ["/api/date", "/api/stare", "/", "/index.html"]) {
      const r = await server.request(ruta);
      expect(r.status, ruta).toBe(401);
      expect(r.headers.get("www-authenticate"), ruta).toMatch(/^Basic realm="Izorep"/);
    }
  });

  it("parola greșită: 401, oricare ar fi utilizatorul", async () => {
    for (const antet of [basic("izorep", "gresit"), basic("", ""), "Basic !!!", "Bearer zapada-de-iulie"]) {
      const r = await server.request("/api/date", { headers: { authorization: antet } });
      expect(r.status, antet).toBe(401);
    }
  });

  it("parola bună trece de poartă, cu orice nume de utilizator", async () => {
    for (const user of ["adrian", ""]) {
      // Ruta inexistentă: dacă poarta lasă cererea să treacă, răspunsul e 404, nu 401.
      const r = await server.request("/api/nu-exista", { headers: { authorization: basic(user, "zapada-de-iulie") } });
      expect(r.status, user).toBe(404);
    }
  });

  it("ruta de viață rămâne deschisă (Render o întreabă fără parolă) și nu spune nimic despre firmă", async () => {
    const r = await server.request(RUTA_VIATA);
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("ok");
  });

  it("fără parolă configurată, serverul nu are poartă (local)", async () => {
    const local = creeazaServer({ db: {} as Baza, tenantId: "t" });
    const r = await local.request("/api/nu-exista");
    expect(r.status).toBe(404);
  });
});

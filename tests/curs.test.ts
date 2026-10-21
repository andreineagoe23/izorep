/**
 * Cursul BNR din antet (`src/server/curs.ts`): citit din XML-ul BNR, tinut o
 * ora, ultimul bun cand BNR nu raspunde. Fara retea: `aduce` e inlocuit. Si
 * gardul: nimic in afara de antet nu-l citeste, ca un curs care se schimba
 * zilnic sa nu ajunga intr-o suma.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Baza } from "../src/db/client.js";
import { creeazaServer } from "../src/server/app.js";
import { citesteCursBnr, VALABIL_MS } from "../src/server/curs.js";

/** Forma fisierului BNR din 21 octombrie 2026, scurtat la trei monede. */
const xml = (data: string, eur: string) => `<?xml version="1.0" encoding="utf-8"?>
<DataSet xmlns="https://www.bnr.ro/xsd"><Header><Publisher>National Bank of Romania</Publisher>
<PublishingDate>${data}</PublishingDate><MessageType>DR</MessageType></Header><Body>
<Subject>Reference rates</Subject><OrigCurrency>RON</OrigCurrency><Cube date="${data}">
<Rate currency="AED">1.2345</Rate><Rate currency="EUR">${eur}</Rate><Rate currency="HUF" multiplier="100">1.4576</Rate>
</Cube></Body></DataSet>`;

function server(raspunsuri: (() => Promise<string>)[]) {
  let ceas = 0;
  let cereri = 0;
  const app = creeazaServer({
    db: {} as Baza, tenantId: "t",
    curs: { aduce: () => raspunsuri[Math.min(cereri++, raspunsuri.length - 1)]!(), acum: () => ceas },
  });
  return {
    curs: () => app.request("/api/curs"),
    trece: (ms: number) => { ceas += ms; },
    cereri: () => cereri,
  };
}

describe("cursul BNR", () => {
  it("citește EUR și ziua din fișierul BNR; altceva nu e curs", () => {
    expect(citesteCursBnr(xml("2026-10-21", "5.3297"))).toEqual({ eur: 5.3297, data: "2026-10-21" });
    expect(citesteCursBnr("<html>Moved</html>")).toBeNull();
    expect(citesteCursBnr(xml("2026-10-21", "0"))).toBeNull();
  });

  it("îl ține o oră: zece pagini deschise întreabă BNR o dată", async () => {
    const s = server([async () => xml("2026-10-21", "5.3297")]);
    for (let i = 0; i < 10; i++) {
      const r = await s.curs();
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ eur: 5.3297, data: "2026-10-21" });
    }
    expect(s.cereri()).toBe(1);
    s.trece(VALABIL_MS);
    await s.curs();
    expect(s.cereri()).toBe(2);
  });

  it("BNR picat: rămâne ultimul curs citit, cu ziua lui", async () => {
    const s = server([async () => xml("2026-10-21", "5.3297"), async () => { throw new Error("timeout"); }]);
    await s.curs();
    s.trece(VALABIL_MS);
    const r = await s.curs();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ eur: 5.3297, data: "2026-10-21" });
  });

  it("fără niciun curs citit: 503, iar antetul nu arată nimic", async () => {
    const s = server([async () => "<html>Moved</html>"]);
    expect((await s.curs()).status).toBe(503);
    // Dupa o greseala nu intreaba BNR la fiecare pagina, ci peste o ora.
    await s.curs();
    expect(s.cereri()).toBe(1);
  });

  it("nimic în afară de antet nu citește cursul", () => {
    const radacina = new URL("..", import.meta.url).pathname;
    const fisiere = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const c = join(dir, n);
      return statSync(c).isDirectory() ? fisiere(c) : n.endsWith(".ts") ? [c] : [];
    });
    const folosesc = [...fisiere(join(radacina, "src")), ...fisiere(join(radacina, "web"))]
      .filter((f) => /from\s+["'][^"']*\/curs\.js["']|\bcursBnr\(/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(radacina.length))
      .sort();
    // app.ts monteaza ruta, date.ts o cheama, main.ts o arata in antet.
    expect(folosesc).toEqual(["src/server/app.ts", "web/date.ts", "web/main.ts"]);
  });
});

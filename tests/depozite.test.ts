/**
 * Depozitele: unde ajung efectiv maparile de coloane si sabloanele invatate.
 *
 * Sunt trei implementari ale acelorasi doua contracte — fisier, `localStorage`
 * si, cand apare serverul, o tabela per tenant. Logica din `memorie.ts` si
 * `mapare.ts` e testata separat; aici se verifica DOAR ca ce se scrie se si
 * citeste inapoi, si ca un depozit care crapa nu opreste importul.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stocPeDisc } from "../src/import/stoc-sabloane.js";
import { invata } from "../src/import/memorie.js";
import type { LinieExtrasa } from "../src/import/schema.js";
import { idsDeSters } from "../web/istoric.js";

const extras: LinieExtrasa = {
  index: 0, sistem: "elastomer", diametru_valoare: 25, diametru_tip: "DN",
  grosime_mm: 13, forma: "ml", gol_latime_mm: null, gol_inaltime_mm: null,
  straturi_extra: [], incredere: 1, motiv: "corectat de om",
};
const TEXT = "Izolatie elastomer 13 mm pe teava DN25";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "izorep-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("memoria pe disc", () => {
  it("reinvatarea inlocuieste, nu adauga", () => {
    const cale = join(dir, "sabloane.json");
    const stoc = stocPeDisc(cale);
    stoc.pune(invata(TEXT, extras)!);
    stoc.pune(invata(TEXT, { ...extras, sistem: "vata_minerala" })!);
    const toate = stocPeDisc(cale).toate();
    expect(toate).toHaveLength(1);
    expect(toate[0]!.extras.sistem).toBe("vata_minerala");
  });
});

describe("cache-ul de mapari", () => {
  it("refuza o mapare stricata de pe disc in loc sa o foloseasca", async () => {
    // Fisierele din data/ sunt commit-uite si editabile de mana. Ce e pe disc
    // trece prin aceeasi schema ca ce vine de la model.
    const { citesteMapari } = await import("../src/import/cache-mapari.js");
    writeFileSync(join(dir, "zzz-test-stricat.json"), JSON.stringify({
      amprenta: "x", fisier: "x", foaie: "x", model: "x", generat: "x",
      mapare: { rand_antet: 0, rand_start: 1, roluri: ["rol-inexistent"], motiv: "" },
    }));
    expect(() => citesteMapari(dir)).toThrow();
  });
});

describe("plafonul istoricului de importuri", () => {
  const intrare = (id: string, cand: string) => ({
    id, cand, nume: `${id}.xlsx`, marime: 1, model: null,
    pozitii: 0, tarifate: 0, valoare: 0,
  });

  it("scoate cele mai VECHI intrari, nu ultimele adaugate", () => {
    // Ordinea in care vin din IndexedDB e a cheilor, nu a timpului: daca s-ar
    // taia dupa ea, un import de azi ar putea cadea in locul unuia de anul
    // trecut.
    const v = [
      intrare("vechi", "2026-01-01T10:00:00Z"),
      intrare("nou", "2026-09-03T10:00:00Z"),
      intrare("mijloc", "2026-05-01T10:00:00Z"),
    ];
    expect(idsDeSters(v, 2)).toEqual(["vechi"]);
  });

});

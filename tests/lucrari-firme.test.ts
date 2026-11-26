/**
 * Etapa 2 (`docs/plan-dupa-demo.md`, 26 noiembrie 2026): lucrările pe cele două
 * firme, RADOIA și ISORAD. Fără migrare: firma e în plan, în antetul cererii
 * și în seria ofertei.
 */
import { describe, expect, it } from "vitest";
import { firmaLucrare, lucrariDin } from "../web/lucrare.js";
import { FIRME, firmaDupa, tineFirma, ultimaFirma } from "../web/date/firme.js";
import { alegereFirma, ecranStart } from "../web/import/vizual.js";
import type { IntrareIstoric } from "../web/istoric.js";
import type { OfertaEmisa } from "../web/oferte-local.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";

const cerere = (id: string, extra: Partial<IntrareIstoric> = {}): IntrareIstoric => ({
  id, nume: `${id}.xlsx`, marime: 1, cand: "2026-11-01T08:00:00.000Z", model: null, pozitii: 10, tarifate: 10, valoare: 100, ...extra,
});
const oferta = (numar: string): OfertaEmisa => ({
  numar, data: "27.05.2026", client: "C", obiectiv: "O", valoare: 100, pozitii: 10, cand: "2026-11-02T08:00:00.000Z",
});
const plan = (id: string, extra: Partial<PlanSantier> = {}): PlanSantier => ({
  id, creat: "2026-11-03T08:00:00.000Z", denumire: `Șantier ${id}`, client: "C", firma: "RADOIA ISOLIRUNG SRL", oferta: "",
  fisier: "x.xlsx", destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0, pozitii: [],
  situatii: [], ...extra,
});
const memorie = (): Storage => {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; }, clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k),
  };
};

describe("firma unei lucrări", () => {
  it("șantierul bate cererea, cererea bate seria ofertei; fără nimic, prima firmă (ca formularul ofertei)", () => {
    const [cuPlan, cuAntet, cuSerie, fara] = lucrariDin(
      [
        cerere("a", { cand: "2026-11-04T00:00:00Z", antet: { firma: "radoia" } }),
        cerere("b", { cand: "2026-11-03T00:00:00Z", antet: { firma: "isorad" } }),
        cerere("c", { cand: "2026-11-02T00:00:00Z" }),
        cerere("d", { cand: "2026-11-01T00:00:00Z" }),
      ],
      { b: oferta("RAD12"), c: oferta("ISO7") },
      [plan("S-a", { cerere: "a", firma: "R&F ISORAD SYSTEM SRL" })],
    );
    expect([cuPlan, cuAntet, cuSerie, fara].map((l) => firmaLucrare(l!))).toEqual(["isorad", "isorad", "isorad", "radoia"]);
  });

  it("recunoaște cheia, denumirea de pe antet și numele scurt", () => {
    expect([firmaDupa("isorad"), firmaDupa("R&F ISORAD SYSTEM SRL"), firmaDupa("Radoia"), firmaDupa("altceva"), firmaDupa("")]
      .map((f) => f?.id)).toEqual(["isorad", "isorad", "radoia", undefined, undefined]);
  });
});

describe("ultima firmă aleasă", () => {
  it("se ține și pornește următoarea cerere; fără nimic sau cu o valoare stricată, prima firmă", () => {
    const d = memorie();
    expect(ultimaFirma(d)).toBe(FIRME[0].id);
    tineFirma("isorad", d);
    expect(ultimaFirma(d)).toBe("isorad");
    tineFirma("nu-exista", d);
    expect(ultimaFirma(d)).toBe("isorad");
    d.setItem("izorep-firma", "<script>");
    expect(ultimaFirma(d)).toBe(FIRME[0].id);
  });
});

describe("Cerere nouă: firma lângă tipul ofertei", () => {
  it("cele două firme, cu cea aleasă bifată", () => {
    const h = alegereFirma(FIRME, "isorad");
    expect(h).toContain('name="firma-start" value="isorad" checked');
    expect(h).not.toContain('value="radoia" checked');
    expect(h).toContain("RADOIA");
    expect(ecranStart({ destinatie: "rezidential", eroare: "", firma: { firme: FIRME, activ: "radoia" } })).toContain("<legend>Firma</legend>");
    expect(ecranStart({ destinatie: "rezidential", eroare: "" })).not.toContain("<legend>Firma</legend>");
  });
});

/**
 * Pe server, ecranele arată doar ce e în bază (docs/plan-pana-la-render.md,
 * R2). Clienții se adună din beneficiarul ofertelor salvate și din șantiere;
 * exemplele din `seed.ts` rămân doar pe linkul demo.
 */
import { describe, expect, it } from "vitest";
import { clientiDinOferte } from "../web/ecrane/clienti.js";
import { exemple } from "../web/date/exemple.js";
import type { OfertaEmisa } from "../web/oferte-local.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";

const oferta = (client: string, numar: string, cand: string, valoare = 100): OfertaEmisa =>
  ({ numar, data: "", client, obiectiv: "", valoare, pozitii: 1, cand });
const plan = (client: string, denumire: string): PlanSantier => ({
  id: denumire, creat: "2026-10-13T00:00:00.000Z", denumire, client, firma: "", oferta: "", fisier: "",
  destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0, pozitii: [], situatii: [],
});

describe("clienții din oferte", () => {
  it("același beneficiar, scris altfel, e un singur client, cu ofertele și șantierele lui", () => {
    const c = clientiDinOferte(
      [oferta("Grup Energoinstal SA", "RAD284", "2026-10-01"), oferta("grup  energoinstal sa ", "RAD285", "2026-10-02"),
        oferta("NISAL SRL", "RAD118", "2026-09-01")],
      [plan("Grup Energoinstal SA", "TRANSAVIA Alba-Iulia")],
    );
    expect(c.map((x) => x.denumire)).toEqual(["Grup Energoinstal SA", "NISAL SRL"]);
    expect(c[0]!.oferte.map((o) => o.numar)).toEqual(["RAD284", "RAD285"]);
    expect(c[0]!.santiere.map((p) => p.denumire)).toEqual(["TRANSAVIA Alba-Iulia"]);
  });

  it("fără beneficiar pe antet nu se inventează un client", () => {
    expect(clientiDinOferte([oferta("  ", "RAD1", "2026-10-01")], [plan("", "S")])).toEqual([]);
  });

  it("baza goală: niciun client", () => {
    expect(clientiDinOferte([], [])).toEqual([]);
  });
});

describe("exemplele din seed", () => {
  it("pe linkul demo (datele în browser) există; pe server `exemple()` dă null", () => {
    // Fără server pornit, modul e „browser”: exemplele sunt ale linkului demo.
    expect(exemple()?.LUCRARI.length).toBeGreaterThan(0);
  });
});

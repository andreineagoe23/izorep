/**
 * Etapa 4, partea fără lista Conlit (`docs/plan-dupa-demo.md`, 26 noiembrie
 * 2026): discount sau adaos pe fiecare poziție (N8) și adaosul de 20 % la foc
 * pe industrial ca bifă (C2).
 */
import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { CLIENTI, cuClienti } from "./conditii.js";
import { parseFoi } from "../src/import/parse-workbook.js";
import { proceseazaRegistru, type LinieProcesata } from "../src/import/nucleu.js";
import { mapariStatice } from "../src/import/mapari-statice.js";
import { stocInMemorie } from "../src/import/memorie.js";
import {
  cuAjustare, cuProcente, imparte, planDinOferta, procentRand, totalOferta, valoareOferta,
  type AntetOferta, type CerereOferta, type Provenienta,
} from "../web/oferta.js";
import { documentOferta } from "../web/document-oferta.js";
import { procentText } from "../web/import/verificare-vizual.js";

const ANTET: AntetOferta = {
  serie: "RAD", numar: "1", data: "26.11.2026", persoana: "", client: "C", obiectiv: "O", firma: "RADOIA ISOLIRUNG SRL", localitate: "X",
};
const PROV = (destinatie: "rezidential" | "industrial"): Provenienta => ({
  generatLa: "2026-11-26T00:00:00Z", destinatie, model: null, sesiune: "s", fisierSursa: "f.xlsx",
});
const linie = (index: number, unitar: number, cantitate = 10, manual = false): LinieProcesata => ({
  bruta: { index, foaie: "F", rand: index, text: `r${index}`, celule: [], um: "ml", cantitate },
  extras: {
    index, sistem: "elastomer", diametru_valoare: 50, diametru_tip: "DN", grosime_mm: 13, forma: "ml",
    gol_latime_mm: null, gol_inaltime_mm: null, straturi_extra: [], incredere: 1, motiv: "",
  },
  sursa: "regex", necesitaValidare: false,
  pret: { pret_unitar: unitar, cantitate, total: unitar * cantitate, ...(manual ? { manual: true } : {}) } as NonNullable<LinieProcesata["pret"]>,
});

describe("discount sau adaos pe rând", () => {
  it("bate ajustarea pe toată oferta pentru rândul lui; prețul pus de mână nu se atinge", () => {
    const linii = cuProcente([linie(1, 100), linie(2, 100), linie(3, 100, 10, true)], new Map([[1, -5], [3, 50]]));
    const pret = (ls: LinieProcesata[]): number[] => ls.map((l) => l.pret!.pret_unitar);
    expect(pret(cuAjustare(linii, 10))).toEqual([95, 110, 100]);
    expect(pret(cuAjustare(linii, 0))).toEqual([95, 100, 100]);
    expect(procentRand(linii[1]!)).toBeUndefined();
  });

  it("intră în valoarea ofertei (pe care o refuză serverul dacă nu iese din linii), în document și în planul de șantier", () => {
    const c: CerereOferta = {
      linii: cuProcente([linie(1, 20), linie(2, 30)], new Map([[2, 10]])),
      antet: { ...ANTET, discountProcent: 3 }, provenienta: PROV("rezidential"),
    };
    // 20 × 10 + 33 × 10 = 530; −3 % = 514,10
    expect(valoareOferta(c).valoare).toBe(514.1);
    const d = documentOferta(c);
    const poz = d.capitole.flatMap((x) => x.pozitii);
    expect(poz.map((p) => [p.pretUnitar, p.procent])).toEqual([[20, undefined], [33, 10]]);
    expect(planDinOferta(c, "S").pozitii.map((p) => p.pretUnitar)).toEqual([20, 33]);
  });

  it("procentul scris românește", () => {
    expect([-5, 10, 2.5].map(procentText)).toEqual(["−5 %", "+10 %", "+2,5 %"]);
  });
});

describe("adaosul de 20 % la foc pe industrial: bifă", () => {
  cuClienti("Matari pe industrial: fără bifa scrisă rămâne ca înainte (15.230,45 €); oprită, 12.692,04 €", async () => {
    const rez = await proceseazaRegistru(await parseFoi(join(CLIENTI, "oferta-118-1-matari-goluri-foc.xlsx")),
      { stoc: stocInMemorie(), mapari: mapariStatice(), destinatie: "industrial" });
    const c = (adaosFoc?: boolean): CerereOferta => ({
      linii: rez.linii, antet: { ...ANTET, ...(adaosFoc !== undefined ? { adaosFoc } : {}) }, provenienta: PROV("industrial"),
    });
    expect(totalOferta(imparte(rez.linii).oferta)).toBe(12692.04);
    expect(valoareOferta(c()).valoare).toBe(15230.45);
    expect(valoareOferta(c(true)).valoare).toBe(15230.45);
    expect(valoareOferta(c(false)).valoare).toBe(12692.04);
    expect(documentOferta(c(false)).totalGeneral).toBe(12692.04);
    expect(planDinOferta(c(false), "S").adaosFocProcent).toBe(0);
    expect(planDinOferta(c(), "S").adaosFocProcent).toBe(20);
  });
});

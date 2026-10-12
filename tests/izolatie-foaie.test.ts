/**
 * Izolația pe foaie (`src/import/izolatie-foaie.ts`), pe cererea reală CET
 * Constanța (ELSACO, 5 octombrie 2026): lista de țevi a instalatorului, fără
 * izolație pe rând. Izolația vine din specificația proiectantului, pe sistem;
 * grosimea, din tabelele ei (`cerere-de-oferta-cet-constanta-clase-izolatie.pdf`).
 */
import { describe, it, expect } from "vitest";
import { CLIENTI, cuClienti } from "./conditii.js";
import {
  diametruDin, elementDin, grosimeDinTabel, grosimeInLista, piesaInclusaInMetri, randuriIzolate, TABELE, tabelDin4140Cald,
  tevileFoii,
} from "../src/import/izolatie-foaie.js";
import { parseFoi, parseFoiBuffer } from "../src/import/parse-workbook.js";
import { proceseazaRegistru } from "../src/import/nucleu.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { spreCerere } from "../src/santier/spre-cerere.js";
import { registruCerere } from "../src/santier/registru.js";
import { imparte, valoareLinie } from "../web/oferta.js";

const CET = `${CLIENTI}/cerere-de-oferta-cet-constanta-motoare-termice.xlsx`;

describe("ce se izolează de pe lista instalatorului", () => {
  it.each([
    ["Pipe EN 10216-2 - 21.3x2.0", "ml"],
    ["PIpe EN 10217-7 - 114.3x2.6", "ml"],
    ["Elbow EN 10253-4-Type A-3D-90 - 33.7x2.0", "cot"],
    ["Bend 90° - GFPS, PE 100, SDR11, butt-welding, PN16 - Da25", "cot"],
    ["Tee reducing EN 10253-2-Type A-S - 60.3x2.9-33.7x2.6", "teu"],
    ["Concentric Reducer EN 10253-2-Type A-S - 168.3x4.5-114.3x3.6", "reductie"],
    ["Welding-neck flange, DIN EN 1092-1 Type 11, B1, PN16 - DN50", "flansa"],
    ["Check valve - END-Armaturen, Type EB, B1, Flanges will be in 4-hole execution", "robinet"],
    ["Teava otel zincat DN50", "ml"],
    ["Cot 90 grade DN25", "cot"],
  ])("%s → %s", (d, e) => expect(elementDin(d)).toBe(e));

  it.each([
    "Machine screw M16 x @@@ Lg, DIN EN ISO 4014 w/1 hexagon nut M16",
    "Guided support - Witzenmann, up to 300°C, LKL 21.0080.150-37.2",
    "Threadolet acc. ANSI B 16.9 for Thermowell",
    "Clamp - HILTI MP-MI 1\" G M12",
    "Gasket for flange DN50",
    "Temperature transmitter with thermowell G1/2\"",
  ])("nu se izolează: %s", (d) => expect(elementDin(d)).toBeNull());

  it("diametrul: din descriere întâi, apoi din coloana DN", () => {
    expect(diametruDin("Pipe EN 10216-2 - 21.3x2.0", "15")).toEqual({ valoare: 21.3, tip: "exterior" });
    expect(diametruDin("Pipe DIN EN 10216-5, metric - D 10x1.0", "10")).toEqual({ valoare: 10, tip: "exterior" });
    expect(diametruDin("Tee 90° reduced - GFPS - Da63xDa32", "63")).toEqual({ valoare: 63, tip: "exterior" });
    // La reducție, diametrul mare, ca în carnet („reductor 320 → 250”).
    expect(diametruDin("Eccentric Reducer EN 10253-4-Type A - 88.9x2.3-60.3x2.0", "80x50")).toEqual({ valoare: 88.9, tip: "exterior" });
    expect(diametruDin("Blind Flange, EN 1092-1 Type 05, B1, PN40 - DN15", "15")).toEqual({ valoare: 15, tip: "DN" });
    expect(diametruDin("Elbow equal- Schwer Fittings, Series L - 12L", "12mm")).toEqual({ valoare: 12, tip: "exterior" });
    expect(diametruDin("Ball valve, lever handle", "25")).toEqual({ valoare: 25, tip: "DN" });
  });
});

describe("grosimea, din tabelele specificației", () => {
  it("protecția la atingere: 40 mm până la DN50, 50 până la DN150, 60 până la DN450", () => {
    const t = TABELE.atingere.tabel;
    expect([21.3, 60.3, 76.1, 168.3, 219.1, 508].map((od) => grosimeDinTabel(od, t))).toEqual([40, 40, 50, 50, 60, 70]);
  });

  it("DIN 4140 D.2: temperatura dintre coloane ia coloana de deasupra", () => {
    expect(grosimeDinTabel(60.3, tabelDin4140Cald(100))).toBe(70);
    expect(grosimeDinTabel(60.3, tabelDin4140Cald(120))).toBe(80);
    expect(grosimeDinTabel(21.3, tabelDin4140Cald(50))).toBe(30);
  });

  it("specificația cere un minim: grosimea urcă la următoarea din listă", () => {
    // D.4, 5 °C: DN20 → 14 mm, deci elastomer 19; DN150 → 33, peste listă (32): rămâne 33, de verificat la import.
    expect(grosimeInLista(grosimeDinTabel(26.9, TABELE.rece.tabel), "elastomer")).toBe(19);
    expect(grosimeInLista(grosimeDinTabel(168.3, TABELE.rece.tabel), "elastomer")).toBe(33);
    expect(grosimeInLista(45, "vata_minerala")).toBe(50);
  });

  it("coturile fără protecție pe banda fără coeficient (18–60) intră în prețul pe metru", () => {
    const a = { izolatie: "elastomer" as const, jacheta: null };
    expect(piesaInclusaInMetri({ element: "cot", diametru_valoare: 25, diametru_tip: "exterior" }, a)).toBe(true);
    expect(piesaInclusaInMetri({ element: "cot", diametru_valoare: 114.3, diametru_tip: "exterior" }, a)).toBe(false);
    expect(piesaInclusaInMetri({ element: "cot", diametru_valoare: 25, diametru_tip: "exterior" }, { ...a, jacheta: "aluminiu" })).toBe(false);
    expect(piesaInclusaInMetri({ element: "robinet", diametru_valoare: 25, diametru_tip: "DN" }, a)).toBe(false);
  });
});

describe("CET Constanța: din lista de țevi, oferta", () => {
  cuClienti("pe fiecare foaie de sistem se citesc țevile și piesele; restul se lasă", async () => {
    const foi = await parseFoi(CET);
    const pe = Object.fromEntries(foi.map((f) => [f.nume, tevileFoii(f).tevi.length]));
    expect(pe["CENT"]).toBe(0);
    expect(pe["OMS"]).toBe(29);
    expect(pe["PWS(DWS)"]).toBe(18);
    const oms = tevileFoii(foi.find((f) => f.nume === "OMS")!);
    expect(oms.tevi.filter((t) => t.element === "ml").map((t) => [t.diametru_valoare, t.cantitate])).toEqual([[60.3, 162.94], [76.1, 187.48]]);
  });

  cuClienti("OMS cu vată și tablă la atingere, PWS cu elastomer la rece: 20 de poziții, toate „Gata”", async () => {
    const foi = await parseFoi(CET);
    const oms = randuriIzolate(tevileFoii(foi.find((f) => f.nume === "OMS")!), {
      izolatie: "vata_minerala", grosime: { tabel: TABELE.atingere.tabel }, jacheta: "aluminiu", piese: true, armaturi: true,
    });
    const pws = randuriIzolate(tevileFoii(foi.find((f) => f.nume === "PWS(DWS)")!), {
      izolatie: "elastomer", grosime: { tabel: TABELE.rece.tabel }, jacheta: null, piese: true, armaturi: false,
    });
    // Coturile, teurile și reducțiile de PE sub ø60, fără tablă: în prețul pe metru.
    expect(pws.incluse).toBe(116);
    expect(oms.randuri.find((r) => r.element === "ml" && r.diametru_valoare === 76.1)).toMatchObject({ grosime_mm: 50, cantitate: 187.48, zona: "OMS" });
    const rez = await proceseazaRegistru(await parseFoiBuffer(await registruCerere(spreCerere([...oms.randuri, ...pws.randuri]), "CET")),
      { stoc: stocInMemorie(), destinatie: "industrial" });
    const { oferta, deValidat, netarifate } = imparte(rez.linii);
    expect([oferta.length, deValidat.length, netarifate.length]).toEqual([20, 0, 0]);
    expect(Math.round(oferta.reduce((t, l) => t + valoareLinie(l), 0) * 100) / 100).toBe(32999.59);
  });

  cuClienti("grosimea peste listă (110 mm la ø168) nu iese „Gata” la 100 mm", async () => {
    const foi = await parseFoi(CET);
    const hws = randuriIzolate(tevileFoii(foi.find((f) => f.nume === "HWS")!), {
      izolatie: "vata_minerala", grosime: { tabel: tabelDin4140Cald(100) }, jacheta: "aluminiu", piese: false, armaturi: false,
    });
    const rez = await proceseazaRegistru(await parseFoiBuffer(await registruCerere(spreCerere(hws.randuri), "CET")),
      { stoc: stocInMemorie(), destinatie: "industrial" });
    const l = rez.linii.find((x) => x.bruta.text.includes("ø168.3 cu vata minerala 110 mm"))!;
    expect(l.extras.grosime_mm).toBe(110);
    expect(l.necesitaValidare).toBe(true);
    expect(l.pret?.motiveDeVerificat).toContain("grosime_peste_lista");
  });
});

describe("ecranul izolației pe foaie", () => {
  it("numele foii din fișierul clientului nu intră ca HTML", async () => {
    const { ecranIzolatieFoaie, ALEGERE_INITIALA } = await import("../web/import/izolatie-vizual.js");
    const html = ecranIzolatieFoaie({ fisier: "<b>x</b>.xlsx", foi: [{ nume: "<img src=x>", tevi: 3, piese: 1, armaturi: 0, ignorate: 2 }], alegeri: [ALEGERE_INITIALA] });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>x</b>");
  });

  it("formularul dă alegerea pe care o cere importul", async () => {
    const { alegereDin, izolatieDin } = await import("../web/import/izolatie-vizual.js");
    const d = new FormData();
    for (const [k, v] of [["iz-0", "vata_minerala"], ["gr-0", "cald"], ["t-0", "120"], ["ja-0", "aluminiu"], ["pi-0", "on"], ["iz-1", "fara"]]) d.set(k!, v!);
    const a = izolatieDin(alegereDin(d, 0))!;
    expect(a).toMatchObject({ izolatie: "vata_minerala", jacheta: "aluminiu", piese: true, armaturi: false });
    expect(grosimeDinTabel(60.3, (a.grosime as { tabel: never }).tabel)).toBe(80);
    expect(izolatieDin(alegereDin(d, 1))).toBeNull();
  });
});

/**
 * Faza 7: închiderea șantierului (`src/lucrari/inchidere.ts`) și ce vede
 * directorul (`src/lucrari/rapoarte.ts`).
 *
 * Gata când: un șantier închis are stoc zero și un singur număr pentru costul
 * materialului față de ofertă. Pe TRANSAVIA (cererea reală, doar dacă fișierul
 * există, ca în restul suitei), plus un șantier mic care rulează mereu.
 *
 * Consumul îl scrie Faza 6 din situații; aici e scris de mână, ca mișcare
 * `consum`, cât cere necesarul.
 */
import { describe, it, expect } from "vitest";
import { CLIENTI, cuClienti } from "./conditii.js";
import { importaFisier } from "../src/import/pipeline.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { necesarDinLinii, type MaterialNecesar } from "../src/stoc/necesar.js";
import { articolDin, cantitateNecesara, solduri, type Miscare } from "../src/stoc/registru.js";
import type { Comanda } from "../src/stoc/comenzi.js";
import { imparte, planDinOferta } from "../web/oferta.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";
import {
  MOTIV_INVENTAR, cifreInchidere, materialSantier, miscariInchidere, stocSantier, stocZero, valideazaInchidere,
  type Destinatie, type Inchidere,
} from "../src/lucrari/inchidere.js";
import { alerte, listaSaptamanala, santiereInchise, ZILE_COMANDA } from "../src/lucrari/rapoarte.js";
import {
  cardInchis, cardMaterial, destinatieDin, formularInchidere, randuriInchidere, restulPeSantier, valoareDestinatie,
} from "../web/inchidere-vizual.js";
import { alerteAtentie, cardInchise, cardSaptamana } from "../web/rapoarte-vizual.js";
import { consumSantier } from "../src/stoc/consum.js";

const CALE = `${CLIENTI}/cerere-de-oferta-transavia-abur.xlsx`;
const ZI0 = "2026-07-13T08:00:00.000Z";

let n = 0;
const id = (): string => `m${++n}`;

/** Unde pleacă restul fiecărui material, pe rând: toate destinațiile firmei (S4, S8, S43). */
const DESTINATII: Destinatie[] = [
  { fel: "depozit", depozit: "central" },
  { fel: "depozit", depozit: "S-ALT" },
  { fel: "furnizor", furnizor: "Isoline" },
  { fel: "pierdut" },
  { fel: "reciclat" },
];

interface Scenariu {
  miscari: Miscare[];
  /** Ce s-ar aștepta să coste materialul șantierului, socotit separat de modul. */
  costAsteptat: number;
}

/**
 * Pe fiecare material: se aduce cu 10 % peste necesar și se pune cât cere
 * necesarul. Unul din trei vine din central, unde a intrat de două ori la
 * prețuri diferite (prețul mediu); restul vin direct pe șantier, cu prețul lor.
 * La inventar, la al doilea material lipsește 1 (ml sau m²).
 */
function scenariu(plan: PlanSantier, materiale: readonly MaterialNecesar[]): Scenariu & { inchidere: (m: Miscare[]) => Inchidere } {
  const miscari: Miscare[] = [];
  const pretPe: number[] = [];
  const adus: number[] = [];
  materiale.forEach((m, i) => {
    const a = articolDin(m);
    const q = Math.ceil(cantitateNecesara(m) * 1.1);
    adus.push(q);
    if (i % 3 === 0) {
      miscari.push({ id: id(), data: ZI0, tip: "intrare", articol: a, cantitate: q, spre: "central", pret: { valoare: 4 } });
      miscari.push({ id: id(), data: ZI0, tip: "intrare", articol: a, cantitate: q, spre: "central", pret: { valoare: 6 } });
      miscari.push({ id: id(), data: ZI0, tip: "transfer", articol: a, cantitate: q, din: "central", spre: plan.id });
      pretPe.push(5); // media celor două intrări în central
    } else {
      const pret = 3 + (i % 7) * 1.25;
      miscari.push({ id: id(), data: ZI0, tip: "intrare", articol: a, cantitate: q, spre: plan.id, lucrareId: plan.id, pret: { valoare: pret } });
      pretPe.push(pret);
    }
    miscari.push({ id: id(), data: ZI0, tip: "consum", articol: a, cantitate: cantitateNecesara(m), din: plan.id });
  });
  // Ce rămâne pe șantier: pus, pierdut, furat, reciclat și lipsa de la inventar.
  // Ce pleacă în depozit, pe alt șantier sau la furnizor nu e costul lui.
  let cost = 0;
  materiale.forEach((m, i) => {
    const rest = Math.round((adus[i]! - cantitateNecesara(m)) * 1000) / 1000;
    const numarat = i === 1 ? rest - 1 : rest;
    const pleaca = DESTINATII[i % DESTINATII.length]!.fel;
    const inapoi = pleaca === "depozit" || pleaca === "furnizor" ? numarat : 0;
    cost += (adus[i]! - inapoi) * pretPe[i]!;
  });
  const inchidere = (toate: Miscare[]): Inchidere => ({
    santier: plan.id,
    inventar: stocSantier(toate, plan.id).map((s) => {
      const i = materiale.findIndex((m) => articolDin(m).cheie === s.articol.cheie);
      const numarat = i === 1 ? Math.round((s.cantitate - 1) * 1000) / 1000 : s.cantitate;
      return {
        cheie: s.articol.cheie, scriptic: s.cantitate, numarat,
        destinatii: numarat > 0 ? [{ unde: DESTINATII[i % DESTINATII.length]!, cantitate: numarat }] : [],
      };
    }),
  });
  return { miscari, costAsteptat: cost, inchidere };
}

function verificaInchiderea(plan: PlanSantier, materiale: readonly MaterialNecesar[]): void {
  const s = scenariu(plan, materiale);
  const inc = s.inchidere(s.miscari);
  expect(stocZero(s.miscari, plan.id)).toBe(false);
  expect(valideazaInchidere(inc, s.miscari)).toBeNull();

  const noi = miscariInchidere(inc, s.miscari, id, "2026-10-11T12:00:00.000Z");
  const toate = [...s.miscari, ...noi];
  // Gata când: stoc zero …
  expect(stocZero(toate, plan.id)).toBe(true);
  // … materialul a ajuns unde a spus omul, iar lipsa de la inventar e o ajustare cu motiv …
  expect(noi.filter((m) => m.motiv === MOTIV_INVENTAR)).toHaveLength(1);
  expect(noi.some((m) => m.tip === "retur" && m.furnizor === "Isoline" && !m.spre)).toBe(true);
  expect(noi.some((m) => m.tip === "ajustare" && m.motiv === "reciclat" && m.cantitate < 0)).toBe(true);
  expect(solduri(toate).some((x) => x.depozit === "S-ALT" && x.cantitate > 0)).toBe(true);
  // … și un singur număr pentru costul materialului față de ofertă.
  const c = cifreInchidere({ ...plan, inchis: "2026-10-11T12:00:00.000Z" }, materiale, toate);
  expect(c.cost.faraPret).toBe(0);
  expect(c.cost.cost).toBeCloseTo(s.costAsteptat, 1);
  const inOferta = materiale.reduce((t, m) => t + m.valoareOferta, 0);
  expect(c.cost.inOferta).toBeCloseTo(inOferta, 1);
  expect(c.cost.procent).toBe(Math.round((c.cost.cost / c.cost.inOferta) * 1000) / 10);
  expect(c.pierderi).toBeGreaterThan(0);
}

const planMic: PlanSantier = {
  id: "S-MIC", creat: ZI0, denumire: "Hala test", client: "Client", firma: "RADOIA ISOLIRUNG SRL", oferta: "RAD1",
  fisier: "test.xlsx", destinatie: "rezidential", ajustareProcent: 0, discountProcent: 0, adaosFocProcent: 0,
  pozitii: [
    { nr: 1, denumire: "Vată 50 Di114", um: "ml", cantitate: 100, pretUnitar: 25.68, foc: false },
    { nr: 2, denumire: "Elastomer 19 Di48", um: "ml", cantitate: 200, pretUnitar: 8.84, foc: false },
  ],
  situatii: [],
};
const mat = (sistem: string, grosime: number, rand: number | null, cant: number, poz: number, valoare: number): MaterialNecesar => {
  const a = articolDin({ sistem, grosime_mm: grosime, rand });
  return {
    cheie: a.cheie, sistem, grosime_mm: grosime, rand, categorie: a.forma!, ml: a.um === "ml" ? cant : 0, m2: a.um === "m2" ? cant : 0,
    piese: 0, piesePresupuse: 0, pierdere: 0, pozitii: 1, pePozitie: [{ pozitie: poz, peUnitate: cant / (poz === 1 ? 100 : 200) }],
    valoareOferta: valoare,
  };
};
const materialeMici: MaterialNecesar[] = [
  mat("vata_minerala", 50, null, 55, 1, 1500),
  mat("tabla", 0.8, null, 70, 1, 1068),
  mat("elastomer", 19, 48, 200, 2, 1768),
  mat("elastomer", 13, 22, 40, 2, 0.01),
  mat("vata_minerala", 30, 60, 12, 1, 0.01),
];

describe("închiderea șantierului", () => {
  it("un șantier mic: stoc zero și costul materialului față de ofertă", () => {
    verificaInchiderea(planMic, materialeMici);
  });

  cuClienti("TRANSAVIA: stoc zero și un singur număr pentru costul materialului față de ofertă", async () => {
    const l = (await importaFisier(CALE, { faraModel: true, stoc: stocInMemorie() })).linii
      .map((x) => (x.pret ? { ...x, necesitaValidare: false } : x));
    const plan = planDinOferta({
      linii: l,
      antet: { serie: "RAD", numar: "284", data: "27.05.2026", persoana: "", client: "Grup Energoinstal SA", obiectiv: "TRANSAVIA ALBA-IULIA", firma: "RADOIA ISOLIRUNG SRL", localitate: "PALTINIS", discountProcent: 3 },
      provenienta: { generatLa: ZI0, destinatie: "rezidential", model: null, sesiune: "s", fisierSursa: "cerere-de-oferta-transavia-abur.xlsx" },
    }, "S-TRANSAVIA");
    const necesar = necesarDinLinii(imparte(l).oferta, { discountProcent: 3 });
    expect(necesar.materiale.length).toBeGreaterThan(10);
    verificaInchiderea(plan, necesar.materiale);
  });

  it("nu se închide cu un rest fără destinație, pe un stoc numărat altfel, sau pe același șantier", () => {
    const s = scenariu(planMic, materialeMici);
    const inc = s.inchidere(s.miscari);
    const primul = inc.inventar[0]!;
    expect(valideazaInchidere({ ...inc, inventar: inc.inventar.slice(1) }, s.miscari)).toMatch(/^Numără/);
    expect(valideazaInchidere({ ...inc, inventar: [{ ...primul, destinatii: [] }, ...inc.inventar.slice(1)] }, s.miscari))
      .toMatch(/Alege unde pleacă/);
    expect(valideazaInchidere({ ...inc, inventar: [{ ...primul, scriptic: primul.scriptic + 1 }, ...inc.inventar.slice(1)] }, s.miscari))
      .toMatch(/numără din nou/);
    const peLoc = { ...primul, destinatii: [{ unde: { fel: "depozit" as const, depozit: planMic.id }, cantitate: primul.numarat }] };
    expect(valideazaInchidere({ ...inc, inventar: [peLoc, ...inc.inventar.slice(1)] }, s.miscari)).toMatch(/alt loc/);
  });

  it("un aviz fără factură oprește închiderea: prețul lui ar lipsi din cost", () => {
    const a = articolDin(materialeMici[0]!);
    const m: Miscare[] = [{
      id: "av", data: ZI0, tip: "intrare", articol: a, cantitate: 5, spre: planMic.id,
      document: { tip: "aviz", serie: "CS", numar: "20261262", data: "2026-07-17" },
    }];
    const inc: Inchidere = { santier: planMic.id, inventar: [{ cheie: a.cheie, scriptic: 5, numarat: 5, destinatii: [{ unde: { fel: "depozit", depozit: "central" }, cantitate: 5 }] }] };
    expect(valideazaInchidere(inc, m)).toMatch(/CS 20261262 așteaptă factura/);
  });
});

describe("ce vede directorul pe șantier (S9)", () => {
  it("comandat, venit, pus, rămas și ce lipsește pentru lucrarea rămasă", () => {
    const vata = articolDin(materialeMici[0]!);
    const comanda: Comanda = {
      id: "C1", creat: ZI0, trimisa: ZI0, furnizor: "Banda Tech", firma: "RADOIA ISOLIRUNG SRL", santier: planMic.id, spre: planMic.id,
      linii: [{ id: "L1", articol: vata, cantitate: 60 }],
    };
    const miscari: Miscare[] = [
      { id: "i1", data: ZI0, tip: "intrare", articol: vata, cantitate: 40, spre: planMic.id, pret: { valoare: 7.5 }, comanda: { id: "C1", linie: "L1" } },
      { id: "c1", data: ZI0, tip: "consum", articol: vata, cantitate: 30, din: planMic.id },
    ];
    // Executat jumătate din poziția 1: lucrarea rămasă cere 27,5 m²; pe șantier sunt 10, pe drum 20.
    const plan: PlanSantier = { ...planMic, situatii: [{ id: "s1", nr: 1, data: ZI0, cantitati: { 1: 50 } }] };
    const r = materialSantier(plan, materialeMici, miscari, [comanda]).randuri.find((x) => x.cheie === vata.cheie)!;
    expect(r).toMatchObject({ necesar: 55, comandat: 60, venit: 40, pus: 30, ramas: 10, lipsa: 0 });
    // Fără comanda pe drum, lipsesc 27,5 − 10 = 17,5.
    const fara = materialSantier(plan, materialeMici, miscari, []).randuri.find((x) => x.cheie === vata.cheie)!;
    expect(fara.lipsa).toBe(17.5);
    // Costul până acum: ce a venit, la prețul lui.
    expect(fara.cost).toBe(300);
  });
});

describe("rapoartele (S49)", () => {
  const azi = "2026-10-11T12:00:00.000Z";

  it("lista săptămânală: doar șantierele cu ceva în ultimele 7 zile", () => {
    const vata = articolDin(materialeMici[0]!);
    const plan: PlanSantier = { ...planMic, situatii: [{ id: "s1", nr: 1, data: "2026-10-09T12:00:00.000Z", cantitati: { 1: 10 } }] };
    const vechi: PlanSantier = { ...planMic, id: "S-VECHI", situatii: [{ id: "s0", nr: 1, data: "2026-09-01T12:00:00.000Z", cantitati: { 1: 10 } }] };
    const l = listaSaptamanala([plan, vechi], {
      miscari: [{ id: "i1", data: "2026-10-10T08:00:00.000Z", tip: "intrare", articol: vata, cantitate: 10, spre: plan.id, pret: { valoare: 7.5 } }],
      necesare: [],
    }, azi);
    expect(l.randuri).toHaveLength(1);
    expect(l.randuri[0]).toMatchObject({ santier: "S-MIC", situatii: 1, executat: 256.8, livrari: 1, valoareVenita: 75 });
  });

  it("comanda trimisă de 7 zile și nevenită e alertă; una de ieri nu", () => {
    const vata = articolDin(materialeMici[0]!);
    const c = (id: string, trimisa: string): Comanda => ({
      id, creat: trimisa, trimisa, furnizor: "Isoline", firma: "RADOIA ISOLIRUNG SRL", santier: planMic.id, spre: planMic.id,
      linii: [{ id: "L", articol: vata, cantitate: 10 }],
    });
    const a = alerte([planMic], { miscari: [], necesare: [], comenzi: [c("veche", "2026-10-01T08:00:00.000Z"), c("noua", "2026-10-10T08:00:00.000Z")] }, azi);
    expect(a).toEqual([{ fel: "comanda", comanda: "veche", furnizor: "Isoline", pentru: "Hala test", trimisa: "2026-10-01T08:00:00.000Z", zile: 10, partial: false }]);
    expect(ZILE_COMANDA).toBe(7);
  });

  it("lipsa pe șantier: doar când necesarul e adus tot și tot nu ajunge", () => {
    const vata = articolDin(materialeMici[0]!);
    const necesare = [{ santier: planMic.id, materiale: [materialeMici[0]!] }];
    const plan: PlanSantier = { ...planMic, situatii: [{ id: "s1", nr: 1, data: ZI0, cantitati: { 1: 50 } }] };
    // Nimic adus: e „de comandat”, nu lipsă.
    expect(alerte([plan], { miscari: [], necesare }, azi)).toEqual([]);
    // Tot necesarul adus (55), dar s-au pus 50 pe jumătate de lucrare: mai trebuie 27,5, sunt 5.
    const miscari: Miscare[] = [
      { id: "i1", data: ZI0, tip: "intrare", articol: vata, cantitate: 55, spre: plan.id, pret: { valoare: 7.5 } },
      { id: "c1", data: ZI0, tip: "consum", articol: vata, cantitate: 50, din: plan.id },
    ];
    // Cei 50 puși pe 27,5 calculați sunt și pierdere peste 10 % (Faza 6): amândouă alertele.
    expect(alerte([plan], { miscari, necesare }, azi)).toEqual([
      { fel: "lipsa", santier: "S-MIC", denumire: "Hala test", materiale: 1 },
      { fel: "pierdere", santier: "S-MIC", denumire: "Hala test", procent: 81.8 },
    ]);
    // Închis, nu mai alertează: cifrele lui stau la „Șantiere închise”.
    expect(alerte([{ ...plan, inchis: ZI0 }], { miscari, necesare }, azi)).toEqual([]);
  });

  it("cifrele la închidere, pe fiecare șantier închis", () => {
    const s = scenariu(planMic, materialeMici);
    const toate = [...s.miscari, ...miscariInchidere(s.inchidere(s.miscari), s.miscari, id, azi)];
    const inchise = santiereInchise([{ ...planMic, inchis: azi }, { ...planMic, id: "S-DESCHIS" }],
      { miscari: toate, necesare: [{ santier: planMic.id, materiale: materialeMici }] });
    expect(inchise).toHaveLength(1);
    expect(inchise[0]!.cifre.cost.cost).toBeCloseTo(s.costAsteptat, 1);
  });
});

describe("marcajul (web/inchidere-vizual.ts, web/rapoarte-vizual.ts)", () => {
  const INJECTIE = `<img src=x onerror="alert(1)">`;

  it("textul din date nu injectează HTML: marca, furnizorul, numele șantierului", () => {
    const a = articolDin(materialeMici[0]!, INJECTIE);
    const p: PlanSantier = { ...planMic, denumire: INJECTIE, client: INJECTIE };
    const miscari: Miscare[] = [{ id: "i", data: ZI0, tip: "intrare", articol: a, cantitate: 5, spre: p.id, furnizor: INJECTIE, pret: { valoare: 2 } }];
    const d = { miscari, necesare: [{ santier: p.id, materiale: materialeMici }] };
    const f = restulPeSantier(p, [p, { ...planMic, id: "S-2", denumire: INJECTIE }], d);
    const html = [
      cardMaterial(materialSantier(p, materialeMici, miscari)),
      cardMaterial(materialSantier(p, materialeMici, miscari), consumSantier(p, materialeMici, miscari)),
      formularInchidere({ ...f, scris: {}, eroare: INJECTIE, confirma: true, deschis: true }),
      cardInchis(cifreInchidere({ ...p, inchis: ZI0 }, materialeMici, miscari)),
      cardSaptamana(listaSaptamanala([p], d, "2026-07-14T08:00:00.000Z"), true),
      cardInchise(santiereInchise([{ ...p, inchis: ZI0 }], d), true),
      ...alerteAtentie([{ fel: "comanda", comanda: "c", furnizor: INJECTIE, pentru: INJECTIE, trimisa: ZI0, zile: 9, partial: false },
        { fel: "lipsa", santier: "s", denumire: INJECTIE, materiale: 2 }]).map((x) => x.html),
    ].join("");
    expect(html).not.toContain(INJECTIE);
    expect(html).toContain("Înapoi la &lt;img");
  });

  it("un singur card de material: cu consumul Fazei 6 are pierderea și consumul de mână", () => {
    const a = articolDin(materialeMici[0]!);
    const p: PlanSantier = { ...planMic, situatii: [{ id: "s1", nr: 1, data: ZI0, cantitati: { 1: 50 } }] };
    const miscari: Miscare[] = [
      { id: "i1", data: ZI0, tip: "intrare", articol: a, cantitate: 55, spre: p.id, pret: { valoare: 7.5 } },
      { id: "c1", data: ZI0, tip: "consum", articol: a, cantitate: 50, din: p.id },
    ];
    const fara = cardMaterial(materialSantier(p, materialeMici, miscari));
    // Doar vata a venit și s-a pus: pierderea pe șantier e a ei (50 puși pe 27,5 din situație).
    const cu = cardMaterial(materialSantier(p, materialeMici, miscari), consumSantier(p, [materialeMici[0]!], miscari));
    expect(fara).not.toContain("Pierdere");
    expect(cu.match(/<h2>/g)).toHaveLength(1);
    expect(cu).toContain("Pierdere pe tot șantierul");
    expect(cu).toContain("peste prag");
    expect(cu).toContain('id="consum-mana"');
  });

  it("formularul dă inventarul: numărat implicit cât e în registru, înapoi în central", () => {
    const a = articolDin(materialeMici[0]!);
    const stoc = [{ cheie: a.cheie, articol: a, nume: "vată", scriptic: 7, furnizori: ["Isoline"] }];
    expect(randuriInchidere(stoc, {})).toEqual([
      { cheie: a.cheie, scriptic: 7, numarat: 7, destinatii: [{ unde: { fel: "depozit", depozit: "central" }, cantitate: 7 }] },
    ]);
    expect(randuriInchidere(stoc, { [a.cheie]: { numarat: "6,5", unde: "furnizor:Isoline" } })[0]!.destinatii)
      .toEqual([{ unde: { fel: "furnizor", furnizor: "Isoline" }, cantitate: 6.5 }]);
    expect(randuriInchidere(stoc, { [a.cheie]: { numarat: "0" } })[0]!.destinatii).toEqual([]);
    for (const d of DESTINATII) expect(destinatieDin(valoareDestinatie(d))).toEqual(d);
  });
});

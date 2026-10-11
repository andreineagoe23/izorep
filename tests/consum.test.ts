/**
 * Consumul din situatii (Faza 6): scris la salvarea situatiei, anulat cu storno
 * la stergerea ei, comparat cu consumul real (trimis − returnat − ramas).
 *
 * Testul care tine faza: pe TRANSAVIA, o situatie cu tot executat duce
 * materialul santierului la „ramas” = cat s-a trimis peste necesar.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { importaFisier } from "../src/import/pipeline.js";
import { stocInMemorie } from "../src/import/memorie.js";
import { cuAjustare, imparte, planDinOferta } from "../web/oferta.js";
import { necesarDinLinii, materialManual, type MaterialNecesar } from "../src/stoc/necesar.js";
import { ambalajImplicit } from "../src/stoc/ambalaje.js";
import {
  articolDin, cantitateNecesara, laAmbalaj, solduri, type Miscare,
} from "../src/stoc/registru.js";
import {
  PRAG_PIERDERE, anuleazaConsumSituatie, consumCalculat, consumDinSituatie, consumSantier, parteExecutata,
  type PlanConsum,
} from "../src/stoc/consum.js";
import type { Situatie } from "../src/lucrari/situatii.js";

const S = "S-1";
const zi = "2026-10-11T12:00:00.000Z";

/** Doua pozitii: 100 ml de tub ø114 și 20 de coturi, plus tabla peste ele. */
const tub: MaterialNecesar = {
  cheie: "vata_minerala|tub|50|114", sistem: "vata_minerala", grosime_mm: 50, rand: 114, categorie: "tub",
  ml: 106.67, m2: 0, piese: 20, piesePresupuse: 0, pierdere: 0, pozitii: 2,
  pePozitie: [{ pozitie: 1, peUnitate: 1 }, { pozitie: 2, peUnitate: 0.3333 }], valoareOferta: 2000,
};
const tabla: MaterialNecesar = {
  cheie: "tabla|tabla|0.8|-", sistem: "tabla", grosime_mm: 0.8, rand: null, categorie: "tabla",
  ml: 0, m2: 81.95, piese: 0, piesePresupuse: 0, pierdere: 0.1, pozitii: 2,
  pePozitie: [{ pozitie: 1, peUnitate: 0.69 }, { pozitie: 2, peUnitate: 0.23 }], valoareOferta: 1500,
};
const plan = (situatii: Situatie[] = []): PlanConsum => ({
  id: S, situatii,
  pozitii: [
    { nr: 1, denumire: "Di114 g50", um: "ml", cantitate: 100, pretUnitar: 30, foc: false },
    { nr: 2, denumire: "Di114 g50 - COT", um: "buc", cantitate: 20, pretUnitar: 60, foc: false },
  ],
});
const sit = (nr: number, cantitati: Record<number, number>): Situatie => ({ id: `sit-${nr}`, nr, data: zi, cantitati });
const intrare = (id: string, m: MaterialNecesar, cantitate: number, extra: Partial<Miscare> = {}): Miscare => ({
  id, data: zi, tip: "intrare", articol: articolDin(m), cantitate, spre: S, ...extra,
});

describe("consumul calculat din situații", () => {
  it("parte executată: pe metrii de material, nu pe numărul de poziții", () => {
    const p = plan([sit(1, { 1: 50 })]);
    // 50 din 100 + 20 × 0,3333 metri de țeavă ai tubului.
    expect(parteExecutata(p, tub, 1)).toBeCloseTo(50 / (100 + 20 * 0.3333), 10);
    expect(parteExecutata(p, materialManual("tabla", 0.8, null, 5, "distribuitor"), 1)).toBeNull();
  });

  it("tot executat, în două situații, consumă exact necesarul, cu pierderea la croit", () => {
    const s1 = sit(1, { 1: 40, 2: 5 });
    const s2 = sit(2, { 1: 60, 2: 15 });
    const miscari: Miscare[] = [intrare("i1", tub, 107), intrare("i2", tabla, 85)];
    const c1 = consumDinSituatie(plan([s1]), [tub, tabla], miscari, s1);
    const c2 = consumDinSituatie(plan([s1, s2]), [tub, tabla], [...miscari, ...c1], s2);
    const total = (cheie: string) => [...c1, ...c2].filter((m) => m.articol.cheie === cheie).reduce((t, m) => t + m.cantitate, 0);
    expect(total(tub.cheie)).toBeCloseTo(106.67, 2);
    expect(total(tabla.cheie)).toBeCloseTo(81.95, 2);
    expect(c1.every((m) => m.tip === "consum" && m.din === S && m.situatieId === "sit-1" && m.lucrareId === S)).toBe(true);
    // Rămâne exact ce s-a trimis peste necesar.
    expect(solduri([...miscari, ...c1, ...c2]).map((s) => [s.articol.cheie, s.cantitate]))
      .toEqual([[tub.cheie, 0.33], [tabla.cheie, 3.05]]);
  });

  it("retrimisă, aceeași situație nu mai scrie nimic; id-urile sunt ale situației", () => {
    const s1 = sit(1, { 1: 100, 2: 20 });
    const c = consumDinSituatie(plan([s1]), [tub], [], s1);
    expect(c.map((m) => m.id)).toEqual([`consum-${S}-sit-1-${tub.cheie}`]);
    expect(consumDinSituatie(plan([s1]), [tub], c, s1)).toEqual([]);
  });

  it("ștearsă, situația își anulează consumul cu storno; scrisă din nou, consumul revine", () => {
    const s1 = sit(1, { 1: 100, 2: 20 });
    const c = consumDinSituatie(plan([s1]), [tub, tabla], [intrare("i1", tub, 110)], s1);
    const st = anuleazaConsumSituatie(s1, c, zi);
    expect(st.map((m) => [m.anuleaza, m.cantitate])).toEqual(c.map((m) => [m.id, m.cantitate]));
    const dupa = [intrare("i1", tub, 110), ...c, ...st];
    expect(solduri(dupa).map((s) => s.cantitate)).toEqual([110]);
    // A doua ștergere nu mai anulează nimic.
    expect(anuleazaConsumSituatie(s1, dupa, zi)).toEqual([]);
    const s1b = { ...sit(1, { 1: 100, 2: 20 }), id: "sit-1b" };
    expect(consumDinSituatie(plan([s1b]), [tub, tabla], dupa, s1b).map((m) => m.cantitate)).toEqual([106.67, 81.95]);
  });

  it("marca: consumul se ia din mărcile de pe șantier, pe rând; ce lipsește iese sold negativ", () => {
    const s1 = sit(1, { 1: 100, 2: 20 });
    const miscari = [
      intrare("k", tub, 60, { articol: articolDin(tub, "K-Flex") }),
      intrare("r", tub, 30, { articol: articolDin(tub, "Rockwool") }),
    ];
    const c = consumDinSituatie(plan([s1]), [tub], miscari, s1);
    expect(c.map((m) => [m.articol.marca, m.cantitate])).toEqual([["K-Flex", 60], ["Rockwool", 46.67]]);
    expect(solduri([...miscari, ...c]).find((s) => s.articol.marca === "Rockwool")).toMatchObject({ cantitate: -16.67, negativ: true });
  });

  it("materialul adăugat de mână și cel al clientului nu se consumă din situații", () => {
    const s1 = sit(1, { 1: 100, 2: 20 });
    const client = { ...tabla, alClientului: true as const };
    const manual = materialManual("tabla_inox", 0.4, null, 12, "distribuitor");
    expect(consumDinSituatie(plan([s1]), [client, manual], [], s1)).toEqual([]);
    expect(consumCalculat(plan([s1]), [client, manual])).toEqual(new Map());
  });
});

describe("consumul real și pierderea (S42)", () => {
  const s1 = sit(1, { 1: 100, 2: 20 });
  const baza = (): Miscare[] => {
    const m = [intrare("i1", tub, 120), intrare("i2", tabla, 90)];
    return [...m, ...consumDinSituatie(plan([s1]), [tub, tabla], m, s1)];
  };

  it("trimis − returnat − rămas; retur în depozit, consum de mână, storno", () => {
    const m: Miscare[] = [
      ...baza(),
      { id: "ret", data: zi, tip: "retur" as const, articol: articolDin(tub), cantitate: 10, din: S, spre: "central" },
      { id: "mana", data: zi, tip: "consum" as const, articol: articolDin(tabla), cantitate: 4, din: S },
      { id: "x", data: zi, tip: "consum" as const, articol: articolDin(tabla), cantitate: 1, din: S },
    ];
    m.push({ ...m.at(-1)!, id: "x-st", anuleaza: "x" });
    const c = consumSantier(plan([s1]), [tub, tabla], m);
    const t = c.materiale.find((x) => x.cheie === tub.cheie)!;
    expect(t).toMatchObject({ trimis: 120, returnat: 10, ramas: 3.33, consumCalculat: 106.67, consumReal: 106.67, pierdere: 0, pierdereProcent: 0 });
    const tb = c.materiale.find((x) => x.cheie === tabla.cheie)!;
    expect(tb).toMatchObject({ trimis: 90, ramas: 4.05, consumScris: { situatii: 81.95, mana: 4 }, consumReal: 85.95, pierdere: 4 });
    expect(tb.pierdereProcent).toBe(4.9);
    expect(c.pestePrag).toBe(false);
  });

  it("peste 10 % pe total, pe valoare: șantierul cere atenție", () => {
    // Tabla: 9 m² notați de mână peste situație, 11 % din 81,95; tubul fără pierdere.
    const cuMana = (cant: number): Miscare[] => [...baza(), { id: "m", data: zi, tip: "consum", articol: articolDin(tabla), cantitate: cant, din: S }];
    const c = consumSantier(plan([s1]), [tub, tabla], cuMana(9));
    expect(c.materiale.find((x) => x.cheie === tabla.cheie)!.pierdereProcent).toBe(11);
    // Pe valoare (tubul 2.000 €, tabla 1.500 € în ofertă), totalul e sub prag.
    expect(c.pierdereProcent).toBeLessThan(PRAG_PIERDERE * 100);
    expect(c.pestePrag).toBe(false);
    const mult = consumSantier(plan([s1]), [tub, tabla], cuMana(30));
    expect(mult.pierdereProcent).toBeGreaterThan(10);
    expect(mult.pestePrag).toBe(true);
  });

  it("ajustarea la inventar intră în consumul real; fără situații nu e nimic calculat", () => {
    const m = [intrare("i1", tub, 50), { id: "aj", data: zi, tip: "ajustare" as const, articol: articolDin(tub), cantitate: -5, spre: S }];
    const c = consumSantier(plan(), [tub], m);
    expect(c.materiale[0]).toMatchObject({ trimis: 50, ramas: 45, consumReal: 5, consumCalculat: 0, pierdereProcent: null });
    expect(c.pierdereProcent).toBeNull();
    expect(c.pestePrag).toBe(false);
  });
});

describe("gata când: TRANSAVIA, o situație cu tot executat", () => {
  it("duce materialul șantierului la „rămas” = cât s-a trimis peste necesar", async () => {
    const cale = "../attachments/clienti/cerere-de-oferta-transavia-abur.xlsx";
    if (!existsSync(cale)) return;
    const l = (await importaFisier(cale, { faraModel: true, stoc: stocInMemorie() })).linii
      .map((x) => (x.pret ? { ...x, necesitaValidare: false } : x));
    const p = planDinOferta({
      linii: l,
      antet: { serie: "RAD", numar: "284", data: "27.05.2026", persoana: "", client: "GRUP ENERGOINSTAL", obiectiv: "TRANSAVIA ALBA-IULIA",
        firma: "RADOIA ISOLIRUNG SRL", localitate: "PALTINIS", discountProcent: 3 },
      provenienta: { generatLa: zi, destinatie: "rezidential", model: null, sesiune: "s", fisierSursa: "transavia.xlsx" },
    }, S);
    const n = necesarDinLinii(imparte(cuAjustare(l, 0)).oferta, { discountProcent: 3 });
    expect(p.pozitii).toHaveLength(99);
    expect(n.materiale.length).toBeGreaterThan(10);

    // Trimis pe șantier: la ambalaj întreg (rola, tubul de 2 m), tabla cu 3,5 m² peste;
    // jumătate direct de la furnizor, jumătate prin central.
    const miscari: Miscare[] = [];
    const peste = new Map<string, number>();
    n.materiale.forEach((m, i) => {
      const nec = cantitateNecesara(m);
      const a = ambalajImplicit(m);
      const trimis = a ? laAmbalaj(nec, a).cantitate : Math.round((nec + 3.5) * 100) / 100;
      peste.set(m.cheie, Math.round((trimis - nec) * 100) / 100);
      if (i % 2 === 0) miscari.push({ id: `i${i}`, data: zi, tip: "intrare", articol: articolDin(m, "K-Flex"), cantitate: trimis, spre: S });
      else {
        miscari.push({ id: `c${i}`, data: zi, tip: "intrare", articol: articolDin(m), cantitate: trimis, spre: "central" });
        miscari.push({ id: `t${i}`, data: zi, tip: "transfer", articol: articolDin(m), cantitate: trimis, din: "central", spre: S });
      }
    });

    const toata: Situatie = { id: "sit-1", nr: 1, data: zi, cantitati: Object.fromEntries(p.pozitii.map((x) => [x.nr, x.cantitate])) };
    const cuSit = { ...p, situatii: [toata] };
    const consum = consumDinSituatie(cuSit, n.materiale, miscari, toata);
    const toate = [...miscari, ...consum];

    const c = consumSantier(cuSit, n.materiale, toate);
    for (const m of c.materiale) {
      expect(m.ramas, m.cheie).toBe(peste.get(m.cheie));
      expect(m.consumCalculat, m.cheie).toBe(m.necesar);
      expect(m.pierdere, m.cheie).toBe(0);
    }
    expect(c.pestePrag).toBe(false);
    expect(c.pierdereProcent).toBe(0);
    // Soldul șantierului din registru spune același lucru; centralul a rămas gol.
    const sold = solduri(toate);
    expect(sold.every((s) => s.depozit === S && !s.negativ)).toBe(true);
    for (const s of sold) expect(s.cantitate).toBe(peste.get(articolDin(s.articol).cheie));

    // Ștearsă situația, materialul se întoarce întreg pe șantier.
    const st = anuleazaConsumSituatie(toata, toate, zi);
    const inapoi = consumSantier({ ...p, situatii: [] }, n.materiale, [...toate, ...st]);
    for (const m of inapoi.materiale) expect(m.ramas, m.cheie).toBe(Math.round((m.necesar + peste.get(m.cheie)!) * 100) / 100);
  });
});

import { toOuterDiameter, type TipDiametru } from "./dn-table.js";
import { lista, diametre, grosimiLa, type BandaMultiplicator } from "./lists.js";
import {
  PozitieNetarifata,
  type CerereTarifare, type Forma, type RezultatTarifare,
  type Sistem, type Strat, type StratTarifat,
} from "./types.js";

/** Rotunjire comerciala la 2 zecimale. Se aplica PE FIECARE STRAT, nu la final. */
export const bani = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;

/**
 * Cel mai apropiat rand din lista. La egalitate se alege randul MAI MARE.
 *
 * Regula de departajare nu e arbitrara: la un diametru geometric exact la
 * mijloc intre doua randuri, jacheta trebuie sa incapa peste izolatie, deci
 * randul superior e singurul fizic posibil. Vezi tests/pricing.test.ts,
 * cazul DN80 compus, unde ø195 caz la egalitate intre 190 si 200.
 */
export function randCelMaiApropiat(valoare: number, randuri: number[]): number {
  if (randuri.length === 0) throw new PozitieNetarifata("lista de preturi e goala", { valoare });
  const max = randuri[randuri.length - 1]!;
  if (valoare > max) {
    // Peste ultimul rand nu se extrapoleaza. Ofertele reale contin pozitii la
    // ø250 si ø315 pentru elastomer, unde lista se opreste la ø219: acolo
    // pretul a fost stabilit manual, in afara listei. Motorul le semnaleaza.
    throw new PozitieNetarifata("diametru peste maximul listei de preturi", { valoare, max });
  }
  let best = randuri[0]!;
  let bestD = Math.abs(best - valoare);
  for (const r of randuri.slice(1)) {
    const d = Math.abs(r - valoare);
    if (d < bestD || (d === bestD && r > best)) { best = r; bestD = d; }
  }
  return best;
}

/**
 * Randul pentru stratul care sta DIRECT pe teava.
 *
 * Regula difera dupa cum diametrul a fost dat ca DN sau ca diametru exterior,
 * si e dedusa empiric din oferta 118 (61 pozitii tarifate):
 *
 *  - tip "DN": randurile listei SUNT seria standard de teava de otel
 *    (21,3 -> 22 · 42,4 -> 42 · 88,9 -> 89 · 168,3 -> 169), deci se cauta
 *    randul cel mai apropiat.
 *  - tip "exterior" (plastic, PEHD, tubulatura): se rotunjeste IN SUS.
 *    Mufa de izolatie trebuie sa incapa peste teava, deci un rand sub
 *    diametrul real nu e o optiune fizica. Reproduce 12 din 13 pozitii de
 *    plastic din oferta; abaterea ramasa (ø90 tarifat pe randul 89) e
 *    documentata in tests/pricing.test.ts.
 */
export function randPentruTeava(valoare: number, randuri: number[], tip: TipDiametru): number {
  if (tip === "DN") return randCelMaiApropiat(valoare, randuri);
  const max = randuri[randuri.length - 1]!;
  if (valoare > max) {
    throw new PozitieNetarifata("diametru peste maximul listei de preturi", { valoare, max });
  }
  return randuri.find((r) => r >= valoare) ?? max;
}

function grosimeEfectiva(sistem: Sistem, rand: number, ceruta: number | undefined): number | null {
  if (sistem === "pvc") return null;               // PVC nu are coloana de grosime
  if (ceruta !== undefined) return ceruta;
  const disp = grosimiLa(sistem, rand);
  // Tabla de jachetare are o singura grosime ofertata per diametru: e implicita.
  if (disp.length === 1) return disp[0]!;
  throw new PozitieNetarifata("grosime nespecificata si ambigua", { sistem, rand, disponibile: disp });
}

function cauta(sistem: Sistem, rand: number, grosime: number | null): number {
  const cheie = `${rand}|${grosime === null ? "-" : grosime}`;
  const p = lista(sistem).cells[cheie];
  if (p === undefined) {
    // Principiu: golul din matrice inseamna "nu se oferteaza", nu "pret zero".
    throw new PozitieNetarifata("combinatia diametru/grosime nu exista in lista", {
      sistem, rand, grosime, cheie,
    });
  }
  return p;
}

const CAMP_MULTIPLICATOR: Record<Forma, (keyof BandaMultiplicator)[]> = {
  ml: ["ml"], mp: ["ml"],
  manseta: ["manseta"],
  cot: ["cot_teu_reductie"], teu: ["cot_teu_reductie"], reductie: ["cot_teu_reductie"],
  robinet: ["robinet_vana_flansa_contor", "flansa_robinet_contor_distribuitor"],
  vana: ["robinet_vana_flansa_contor", "flansa_robinet_contor_distribuitor"],
  flansa: ["robinet_vana_flansa_contor", "flansa_robinet_contor_distribuitor"],
  contor: ["robinet_vana_flansa_contor", "flansa_robinet_contor_distribuitor"],
  compensator: ["robinet_vana_flansa_contor", "flansa_robinet_contor_distribuitor"],
  pompa: ["pompa_filtru_distribuitor", "pompa_filtru_vana23"],
  filtru: ["pompa_filtru_distribuitor", "pompa_filtru_vana23"],
  distribuitor: ["pompa_filtru_distribuitor", "flansa_robinet_contor_distribuitor"],
  schimbator: ["pompa_filtru_distribuitor", "pompa_filtru_vana23"],
};

/**
 * Multiplicatorul pentru elemente speciale. Fitingurile nu au pret propriu:
 * se tarifeaza ca multiplu al pretului pe metru liniar de la acel diametru.
 *
 * Tabelul e VALOARE IMPLICITA, nu regula rigida — ofertele reale contin
 * abateri negociate. Apelantul poate suprascrie, dar abaterea trebuie
 * marcata vizibil pe linie.
 */
export function multiplicator(sistem: Sistem, rand: number, forma: Forma): number {
  if (forma === "ml" || forma === "mp") return 1;
  const banda = lista(sistem).multiplicatori.find(
    (b) => rand >= b.band[0] && rand <= b.band[1],
  );
  if (!banda) {
    throw new PozitieNetarifata("diametrul nu cade in nicio banda de multiplicatori", { sistem, rand, forma });
  }
  for (const camp of CAMP_MULTIPLICATOR[forma]) {
    const v = banda[camp];
    if (typeof v === "number") return v;
  }
  throw new PozitieNetarifata("forma nu are multiplicator definit pe aceasta banda", {
    sistem, rand, forma, banda: banda.band,
  });
}

/**
 * Tarifeaza o pozitie, inclusiv compusa din mai multe straturi.
 *
 * Regula, reprodusa din ofertele reale (vezi teste):
 *   1. DN -> diametru exterior real
 *   2. primul strat se cauta pe randul cel mai apropiat de diametrul real
 *   3. diametrul geometric porneste de la RANDUL primului strat si creste
 *      cu 2 x grosime la fiecare strat
 *   4. fiecare strat urmator se cauta pe randul cel mai apropiat de geometric
 *   5. rotunjire la 2 zecimale PE FIECARE STRAT, apoi se aduna
 */
export function tarifeaza(cerere: CerereTarifare): RezultatTarifare {
  const { diametru, straturi, forma, cantitate } = cerere;
  if (straturi.length === 0) throw new PozitieNetarifata("pozitie fara straturi", { cerere });

  // Inchiderile de goluri la foc au pret ADITIV (gol dupa suprafata + banda
  // WRAP + colier PROMASTOP), nu matrice ø × grosime. Datele exista in
  // data/price-lists/goluri_foc.json, dar regula nu e scrisa inca. Fara
  // verificarea asta, lista cu alta structura pica intr-un TypeError opac in
  // loc de pozitia marcata pentru tarifare manuala.
  if (straturi.some((s) => s.sistem === "goluri_foc")) {
    throw new PozitieNetarifata(
      "inchiderile de goluri la foc se tarifeaza aditiv, nemodelat inca in motor",
      { sistem: "goluri_foc" },
    );
  }

  const od = toOuterDiameter(diametru.valoare, diametru.tip);
  const tarifate: StratTarifat[] = [];
  let geometric = od;

  for (const [i, strat] of straturi.entries()) {
    const randuri = diametre(strat.sistem);
    // Primul strat sta pe teava si respecta regula de potrivire a tevii.
    // Straturile urmatoare stau peste izolatie: acolo se cauta cel mai
    // apropiat rand, fara constrangerea de incapere.
    const rand = i === 0
      ? randPentruTeava(geometric, randuri, diametru.tip)
      : randCelMaiApropiat(geometric, randuri);
    const grosime = grosimeEfectiva(strat.sistem, rand, strat.grosime_mm);

    const pret = forma === "mp"
      ? lista(strat.sistem).per_mp[String(grosime)]
      : cauta(strat.sistem, rand, grosime);
    if (pret === undefined) {
      throw new PozitieNetarifata("nu exista pret pe mp pentru grosimea ceruta", { sistem: strat.sistem, grosime });
    }

    tarifate.push({
      sistem: strat.sistem,
      grosime_mm: grosime,
      diametru_geometric: geometric,
      rand_lista: rand,
      pret_unitar: bani(pret),
    });

    // Primul strat porneste de la randul din lista, nu de la diametrul real.
    // Straturile urmatoare acumuleaza geometric peste acea baza.
    const baza = i === 0 ? rand : geometric;
    geometric = baza + 2 * (grosime ?? 0);
  }

  const mult = multiplicator(straturi[0]!.sistem, tarifate[0]!.rand_lista, forma);
  const unitar = bani(tarifate.reduce((s, t) => s + t.pret_unitar, 0) * mult);

  return {
    straturi: tarifate,
    pret_unitar: unitar,
    multiplicator: mult,
    cantitate,
    total: bani(unitar * cantitate),
    moneda: "EUR",
  };
}

/** Helper pentru pozitii simple, cu un singur strat. */
export function tarifeazaSimplu(
  sistem: Sistem, dn: number, grosime_mm: number | undefined, forma: Forma, cantitate = 1,
): RezultatTarifare {
  const strat: Strat = grosime_mm === undefined ? { sistem } : { sistem, grosime_mm };
  return tarifeaza({ diametru: { valoare: dn, tip: "DN" }, straturi: [strat], forma, cantitate });
}

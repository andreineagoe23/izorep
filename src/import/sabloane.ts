import type { LinieExtrasa } from "./schema.js";

/**
 * Sablonul unei linii: textul ei cu numerele scoase.
 *
 *   "Izolatii cu vata minerala ... inox 304 Di89, g50 - COT"
 *     tipar  "izolatii cu vata minerala ... inox # di#, g# - cot"
 *     numere [304, 89, 50]
 *
 * De ce: liniile reziduale se repeta masiv in acelasi fisier. Masurat pe cele
 * 9 fisiere de client, 697 de linii reziduale inseamna doar 318 sabloane —
 * jumatate din ce pleaca azi la model sunt reformulari ale aceleiasi linii cu
 * alte cifre. Vezi `.claude/plan-l1-l4.md`.
 *
 * Se memoreaza ROLUL, nu valorile. Masurat pe cele 64 de sabloane care apar de
 * cel putin doua ori (302 linii), tripleta (sistem, tip diametru, forma) e
 * identica intre instante in 100% din cazuri — dar numerele, evident, nu sunt.
 * Un cache care ar tine si valorile ar tarifa DN15 cu pretul lui DN100 la prima
 * linie asemanatoare.
 */

export interface Sablon {
  /** Textul normalizat, cu fiecare numar inlocuit prin "#". */
  tipar: string;
  /** Numerele scoase, in ordinea aparitiei. Indexul lor e "slotul". */
  numere: number[];
}

const RE_NUMAR = /\d+(?:[.,]\d+)?/g;

/** Fara diacritice, litere mici, spatii colapsate. */
export const normalizeaza = (text: string): string =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function sablonul(text: string): Sablon {
  const n = normalizeaza(text);
  const numere = [...n.matchAll(RE_NUMAR)].map((m) => Number(m[0].replace(",", ".")));
  return { tipar: n.replace(RE_NUMAR, "#"), numere };
}

/** Campurile numerice ale extragerii. Restul (sistem, tip, forma) sunt rolul. */
const CAMPURI_NUMERICE = [
  "diametru_valoare", "grosime_mm", "gol_latime_mm", "gol_inaltime_mm",
] as const;
type CampNumeric = (typeof CAMPURI_NUMERICE)[number];

/**
 * Unde, in sabloane, stau valorile pe care le-a intors modelul.
 *
 * `straturi_extra` intra si el: la o pozitie compusa, grosimea fiecarui strat e
 * un numar din text, deci are si el slotul lui.
 */
export interface Proiectie {
  camp: CampNumeric | { strat: number };
  /**
   * Toate sloturile din reprezentant care contin valoarea. De obicei unul.
   *
   * Mai multe inseamna ca numarul apare de mai multe ori in linie — tipic
   * cand acelasi articol e scris de doua ori, o data in germana si o data in
   * romana: "PEHD D40x3.0 ... tub PEHD D40x3,0". Acolo ambiguitatea e doar
   * aparenta, fiindca sloturile spun acelasi lucru, si se rezolva la
   * proiectie: daca pe linia tinta toate sloturile astea au aceeasi valoare,
   * se ia; daca difera, linia se trimite la model.
   */
  sloturi: number[];
}

/**
 * Cauta slotul fiecarei valori numerice din extragere.
 *
 * `null` inseamna "sablonul asta NU se deduplica" si se intoarce in doua
 * situatii, amandoua periculoase daca ar fi ghicite:
 *
 *  - valoarea nu apare deloc printre numerele liniei. Fie modelul a dedus-o
 *    (DN50 din 2''), fie a inventat-o. In primul caz proiectia n-are de unde
 *    sa ia numarul pe alta linie, in al doilea validatorul o prinde oricum.
 *  - (la proiectie) valoarea apare in mai multe sloturi care, pe linia tinta,
 *    NU mai spun acelasi lucru — "Di60, g60" ar deveni "Di89, g50" si nu se
 *    poate sti care slot era diametrul si care grosimea. Alegerea gresita da
 *    alt pret, in tacere.
 *
 * In ambele cazuri liniile se trimit la model, ca azi. Deduplicarea e o
 * optimizare; cand nu e sigura, nu se face.
 */
export function proiectii(extras: LinieExtrasa, s: Sablon): Proiectie[] | null {
  const out: Proiectie[] = [];

  const sloturile = (v: number): number[] | null => {
    const gasite = s.numere.reduce<number[]>((a, n, i) => (n === v ? [...a, i] : a), []);
    return gasite.length > 0 ? gasite : null;
  };

  for (const camp of CAMPURI_NUMERICE) {
    const v = extras[camp];
    if (v === null) continue;
    const sloturi = sloturile(v);
    if (sloturi === null) return null;
    out.push({ camp, sloturi });
  }

  for (const [i, strat] of extras.straturi_extra.entries()) {
    if (strat.grosime_mm === null) continue;
    const sloturi = sloturile(strat.grosime_mm);
    if (sloturi === null) return null;
    out.push({ camp: { strat: i }, sloturi });
  }

  return out;
}

/**
 * Duce rolul reprezentantului pe alta instanta a aceluiasi sablon.
 *
 * Campurile de rol se copiaza; cele numerice se recitesc din sloturile liniei
 * tinta. `motiv` spune de unde vine linia, fiindca omul de la validare trebuie
 * sa stie ca ea n-a fost citita de model, ci dedusa dintr-o linie geamana.
 */
export function proiecteaza(
  reprezentant: LinieExtrasa,
  harta: Proiectie[],
  tinta: { index: number; sablon: Sablon },
): LinieExtrasa | null {
  const numere = tinta.sablon.numere;
  const rezultat: LinieExtrasa = {
    ...reprezentant,
    index: tinta.index,
    straturi_extra: reprezentant.straturi_extra.map((s) => ({ ...s })),
    motiv: `${reprezentant.motiv} [sablon comun cu linia ${reprezentant.index}]`,
  };

  for (const p of harta) {
    const valori = p.sloturi.map((i) => numere[i]);
    const v = valori[0];
    // Sabloanele au acelasi tipar, deci acelasi numar de sloturi. Daca totusi
    // lipseste, se renunta la proiectie in loc sa se scrie null peste o valoare.
    if (v === undefined) return null;
    // Ambiguitatea din reprezentant se rezolva abia aici: daca sloturile care
    // aveau aceeasi valoare acolo au valori diferite pe linia asta, nu se stie
    // care e care si linia merge la model.
    if (valori.some((x) => x !== v)) return null;
    if (typeof p.camp === "string") rezultat[p.camp] = v;
    else {
      const strat = rezultat.straturi_extra[p.camp.strat];
      if (!strat) return null;
      strat.grosime_mm = v;
    }
  }
  return rezultat;
}

/**
 * O linie asa cum pleaca spre model. `sectiune` e antetul de deasupra
 * randului: regulile il folosesc ca sa afle sistemul cand randul tace despre
 * el, iar fara el modelul raspundea `null` exact pe liniile alea.
 */
export interface LinieSursa { index: number; text: string; um?: string; sectiune?: string }

export interface GrupSablon {
  /** Tiparul plus unitatea de masura: aceeasi fraza cu alt UM e alta forma. */
  cheie: string;
  reprezentant: LinieSursa;
  restul: LinieSursa[];
}

/**
 * Grupeaza liniile reziduale pe sablon. Ordinea grupurilor si a liniilor din
 * ele urmeaza ordinea din fisier, ca acelasi import sa dea acelasi rezultat.
 */
export function grupeazaPeSablon(linii: LinieSursa[]): GrupSablon[] {
  const grupuri = new Map<string, LinieSursa[]>();
  for (const l of linii) {
    // Sectiunea intra in cheie, cu numerele mascate: acelasi rand sub alt
    // antet poate fi alt sistem, dar „EI30" si „EI120" sunt acelasi antet.
    const sectiune = l.sectiune ? sablonul(l.sectiune).tipar : "";
    const cheie = `${sablonul(l.text).tipar}||${l.um ?? ""}||${sectiune}`;
    const g = grupuri.get(cheie);
    if (g) g.push(l);
    else grupuri.set(cheie, [l]);
  }
  return [...grupuri].map(([cheie, membri]) => ({
    cheie, reprezentant: membri[0]!, restul: membri.slice(1),
  }));
}

/**
 * Duce raspunsul primit pentru fiecare reprezentant pe restul grupului lui.
 *
 * Ce nu se poate proiecta se intoarce in `ramase` si merge la model ca orice
 * alta linie. Deduplicarea e o optimizare de cost: cand nu e sigura, nu se
 * face, si nimic din acoperire nu se pierde.
 */
export function extindePeSablon(
  grupuri: GrupSablon[],
  extrase: LinieExtrasa[],
): { proiectate: LinieExtrasa[]; ramase: LinieSursa[] } {
  const dupaIndex = new Map(extrase.map((e) => [e.index, e]));
  const proiectate: LinieExtrasa[] = [];
  const ramase: LinieSursa[] = [];

  for (const g of grupuri) {
    if (g.restul.length === 0) continue;
    const rep = dupaIndex.get(g.reprezentant.index);
    // Reprezentantul fara raspuns nu are ce proiecta: tot grupul merge la model.
    if (!rep) { ramase.push(...g.restul); continue; }

    const harta = proiectii(rep, sablonul(g.reprezentant.text));
    if (harta === null) { ramase.push(...g.restul); continue; }

    for (const l of g.restul) {
      const p = proiecteaza(rep, harta, { index: l.index, sablon: sablonul(l.text) });
      if (p) proiectate.push(p);
      else ramase.push(l);
    }
  }
  return { proiectate, ramase };
}

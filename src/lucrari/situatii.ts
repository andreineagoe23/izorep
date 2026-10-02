/**
 * Planul de santier si situatiile de lucrari.
 *
 * Fluxul firmei (apelul din 29 septembrie 2026): cererea se importa, preturile
 * se verifica, oferta pleaca la client, apoi **din oferta se face santierul**.
 * Planul e oferta inghetata: pozitiile, cantitatile si preturile unitare
 * trimise clientului, copiate (regula 3 din `arhitectura.md`), nu referentiate
 * — o lista de preturi schimbata dupa semnare nu muta nimic pe santier.
 *
 * O situatie de lucrari spune cat s-a executat intr-o perioada, pe fiecare
 * pozitie. Valoarea e cantitatea × pretul unitar din oferta, cu aceleasi
 * reguli de total ca oferta: adaosul de foc pe industrial si discountul.
 * Istoricul e lista situatiilor, in ordine; cumulatul unei situatii e suma
 * celor de pana la ea. O situatie salvata nu se modifica: se sterge doar
 * ultima, ca istoricul sa nu se rescrie pe la mijloc.
 *
 * Pur, fara I/O: ruleaza la fel in browser si in teste.
 */
import { bani } from "../pricing/engine.js";

export interface PozitiePlan {
  /** Numarul pozitiei in plan, de la 1. */
  nr: number;
  denumire: string;
  um: string;
  /** Cantitatea din oferta. */
  cantitate: number;
  /** Pretul unitar trimis clientului (dupa ajustarea tehnicului), EUR. */
  pretUnitar: number;
  /** Inchidere de gol la foc: pe industrial primeste adaosul pe total. */
  foc: boolean;
  /**
   * Ce lucrare e, indiferent de notatie (`amprenta` din `potrivire.ts`): pe ea
   * se pun masuratorile din timpul lucrarii. Lipseste pe planurile facute
   * inainte de 2 octombrie 2026.
   */
  amprenta?: string;
  /** Sectiunea din cerere (zona, etajul): alege intre pozitii cu aceeasi amprenta. */
  zona?: string;
}

export interface Situatie {
  id: string;
  /** 1, 2, 3 … in ordinea emiterii. */
  nr: number;
  /** ISO. */
  data: string;
  /** Cantitatea executata IN PERIOADA, pe numarul pozitiei. Lipsa = 0. */
  cantitati: Record<number, number>;
  nota?: string;
}

export interface PlanSantier {
  id: string;
  /** ISO. */
  creat: string;
  /** Obiectivul; santierul se cheama ca el. */
  denumire: string;
  client: string;
  /** Firma emitenta a ofertei; ea emite si situatiile. */
  firma: string;
  /** „RAD284 / 27.05.2026", sau gol daca oferta n-a primit numar. */
  oferta: string;
  /** Fisierul importat din care a iesit oferta. */
  fisier: string;
  destinatie: string;
  ajustareProcent: number;
  discountProcent: number;
  /** Adaosul pe totalul inchiderilor la foc: 20 pe industrial, 0 altfel. */
  adaosFocProcent: number;
  pozitii: PozitiePlan[];
  situatii: Situatie[];
}

export interface Totaluri {
  /** Suma valorilor pozitiilor. */
  lucrari: number;
  adaosFoc: number;
  discount: number;
  /** Ce se factureaza: lucrari + adaos − discount. */
  total: number;
}

/** Valoarea exacta, ca in oferta: rotunjita o singura data, la final. */
const exact = (n: number): number => Math.round(n * 10000) / 10000;

/** Totalurile unei liste de (pozitie, cantitate), cu regulile ofertei. */
export function totaluri(plan: PlanSantier, cantitati: { poz: PozitiePlan; cantitate: number }[]): Totaluri {
  let lucrari = 0;
  let foc = 0;
  for (const { poz, cantitate } of cantitati) {
    const v = exact(poz.pretUnitar * cantitate);
    lucrari += v;
    if (poz.foc) foc += v;
  }
  // Aceeasi ordine de rotunjire ca registrul ofertei (`web/oferta.ts`), ca
  // situatia cu tot executat sa dea exact totalul ofertei.
  const adaosFoc = bani(bani(foc) * plan.adaosFocProcent / 100);
  const brut = bani(bani(lucrari) + adaosFoc);
  const discount = bani(brut * plan.discountProcent / 100);
  return { lucrari: bani(lucrari), adaosFoc, discount, total: bani(brut - discount) };
}

/** Valoarea ofertei din care s-a facut planul. */
export const valoareOferta = (plan: PlanSantier): Totaluri =>
  totaluri(plan, plan.pozitii.map((poz) => ({ poz, cantitate: poz.cantitate })));

export interface RandSituatie {
  poz: PozitiePlan;
  /** Executat in situatiile de dinainte. */
  anterior: number;
  /** Executat in situatia asta. */
  curent: number;
  cumulat: number;
  /** Cat mai e din cantitatea ofertata; negativ = s-a executat peste oferta. */
  rest: number;
  pesteOferta: boolean;
}

const cant = (s: Situatie, nr: number): number => s.cantitati[nr] ?? 0;
const rot = (n: number): number => Math.round(n * 1000) / 1000;

/**
 * Randurile unei situatii. `situatie` poate fi una salvata (cumulatul e al
 * situatiilor cu numar mai mic) sau una in lucru (numarul urmator).
 */
export function randuriSituatie(plan: PlanSantier, situatie: Situatie): RandSituatie[] {
  const inainte = plan.situatii.filter((s) => s.nr < situatie.nr);
  return plan.pozitii.map((poz) => {
    const anterior = rot(inainte.reduce((t, s) => t + cant(s, poz.nr), 0));
    const curent = cant(situatie, poz.nr);
    const cumulat = rot(anterior + curent);
    return { poz, anterior, curent, cumulat, rest: rot(poz.cantitate - cumulat), pesteOferta: cumulat > poz.cantitate + 1e-9 };
  });
}

/** Totalul situatiei (perioada) si cumulatul pana la ea inclusiv. */
export function totalSituatie(plan: PlanSantier, situatie: Situatie): { curent: Totaluri; cumulat: Totaluri } {
  const r = randuriSituatie(plan, situatie);
  return {
    curent: totaluri(plan, r.map((x) => ({ poz: x.poz, cantitate: x.curent }))),
    cumulat: totaluri(plan, r.map((x) => ({ poz: x.poz, cantitate: x.cumulat }))),
  };
}

/** Situatia urmatoare, goala. */
export const situatieNoua = (plan: PlanSantier, id: string, data: string): Situatie => ({
  id, nr: (plan.situatii.at(-1)?.nr ?? 0) + 1, data, cantitati: {},
});

/** De ce nu se poate salva situatia; null = se poate. */
export function valideazaSituatie(plan: PlanSantier, s: Situatie): string | null {
  const valori = Object.entries(s.cantitati);
  if (valori.some(([, v]) => !Number.isFinite(v) || v < 0)) return "Cantitățile trebuie să fie numere pozitive.";
  if (!valori.some(([, v]) => v > 0)) return "Scrie cel puțin o cantitate executată.";
  if (valori.some(([nr]) => !plan.pozitii.some((p) => p.nr === Number(nr)))) return "O cantitate e pe o poziție care nu e în plan.";
  return null;
}

/** Cat din valoarea ofertei s-a executat, 0..100, dupa toate situatiile. */
export function progresPlan(plan: PlanSantier): number {
  const ultima = plan.situatii.at(-1);
  const oferta = valoareOferta(plan).lucrari;
  if (!ultima || oferta === 0) return 0;
  return Math.min(100, Math.round((totalSituatie(plan, ultima).cumulat.lucrari / oferta) * 100));
}

/** Scoate ultima situatie; celelalte raman, ca istoricul sa nu se rescrie pe la mijloc. */
export const faraUltimaSituatie = (plan: PlanSantier): PlanSantier => ({ ...plan, situatii: plan.situatii.slice(0, -1) });

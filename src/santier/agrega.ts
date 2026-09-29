import type { Element, Izolatie, Jacheta, TermenPoza } from "./schema.js";

/**
 * Din termenii cititi de model, randurile pe care le confirma omul.
 *
 * Un rand = o zona, un diametru, aceleasi straturi, acelasi element. Cantitatea
 * e suma termenilor, fiecare inmultit cu multiplicatorul grupului lui („× 2").
 * Termenii raman pe rand, ca omul sa vada de unde vine suma: „6 + 4 + 2 CT".
 */
export interface RandSantier {
  /** Stabil cat timp nu se schimba cheia: aceeasi zona, diametru, straturi, element. */
  id: string;
  zona: string;
  diametru_valoare: number | null;
  diametru_tip: "exterior" | "DN" | null;
  izolatie: Izolatie | null;
  grosime_mm: number | null;
  jacheta: Jacheta | null;
  element: Element;
  pret_dublu: boolean;
  cantitate: number;
  termeni: { text: string; cantitate: number; multiplicator: number; nesigur: boolean }[];
  /** Macar un termen e nesigur: omul trebuie sa se uite la poza. */
  nesigur: boolean;
}

export type CampuriRand = Omit<RandSantier, "id" | "cantitate" | "termeni" | "nesigur">;

const FARA_ZONA = "Fără zonă";

/** Cheia unui rand, fara zona. Si pentru comparatia cu referinta. */
export function cheieElement(r: Omit<CampuriRand, "zona">): string {
  return [
    r.diametru_tip ?? "-", r.diametru_valoare ?? "-", r.izolatie ?? "-", r.grosime_mm ?? "-",
    r.jacheta ?? "-", r.element, r.pret_dublu ? "dublu" : "simplu",
  ].join("|");
}

export const cheieRand = (r: CampuriRand): string => `${r.zona}|${cheieElement(r)}`;

/** Doua zecimale, ca 1,50 × 2 sa dea 3 si nu 3,0000000004. */
const rotunjeste = (n: number): number => Math.round(n * 100) / 100;

export function agrega(termeni: readonly TermenPoza[]): RandSantier[] {
  const randuri = new Map<string, RandSantier>();
  for (const t of termeni) {
    const campuri: CampuriRand = {
      zona: t.zona?.trim() || FARA_ZONA,
      diametru_valoare: t.diametru_valoare,
      diametru_tip: t.diametru_tip,
      izolatie: t.izolatie,
      // Grosimea fara izolatie n-are sens: „doar Al" nu are strat de vata.
      grosime_mm: t.izolatie ? t.grosime_mm : null,
      jacheta: t.jacheta,
      element: t.element,
      pret_dublu: t.pret_dublu,
    };
    const id = cheieRand(campuri);
    const multiplicator = t.multiplicator > 0 ? t.multiplicator : 1;
    const rand = randuri.get(id) ?? { ...campuri, id, cantitate: 0, termeni: [], nesigur: false };
    rand.cantitate = rotunjeste(rand.cantitate + t.cantitate * multiplicator);
    rand.termeni.push({ text: t.text, cantitate: t.cantitate, multiplicator, nesigur: t.nesigur });
    rand.nesigur ||= t.nesigur;
    randuri.set(id, rand);
  }
  return [...randuri.values()];
}

const cifra = (n: number): string => n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });

/** De unde vine suma, pe intelesul omului: „6 + 14 + 10", „(40 + 1) × 2". */
export function formula(r: Pick<RandSantier, "termeni">): string {
  const grupuri = new Map<number, number[]>();
  for (const t of r.termeni) grupuri.set(t.multiplicator, [...(grupuri.get(t.multiplicator) ?? []), t.cantitate]);
  return [...grupuri.entries()].map(([m, c]) => {
    const suma = c.map(cifra).join(" + ");
    if (m === 1) return suma;
    return `${c.length > 1 ? `(${suma})` : suma} × ${cifra(m)}`;
  }).join(" + ");
}

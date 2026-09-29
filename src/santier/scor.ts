import { cheieElement, type CampuriRand } from "./agrega.js";

/**
 * Cat de bine a citit un model o pagina, fata de transcrierea de referinta.
 *
 * Zona nu intra in cheie: fiecare model o scrie altfel („Zona A", „A) ZONA
 * AMASCHELO"), iar pe paginile de test acelasi diametru nu apare in doua zone.
 * Se compara ce ajunge in pret: diametru, straturi, element, pret dublu si
 * cantitatea totala.
 */
export type RandRef = Omit<CampuriRand, "zona"> & { cantitate: number; nesigur?: string };

export interface Scor {
  total: number;
  corecte: number;
  /** Doar randurile pe care referinta le-a citit sigur: acolo o diferenta e greseala modelului. */
  totalSigure: number;
  corecteSigure: number;
  gresite: { cheie: string; asteptat: number; citit: number; nesigurInReferinta: boolean }[];
  lipsa: { cheie: string; asteptat: number; nesigurInReferinta: boolean }[];
  inPlus: { cheie: string; citit: number }[];
}

function insumeaza<T extends Omit<CampuriRand, "zona"> & { cantitate: number }>(r: readonly T[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of r) {
    const k = cheieElement(x);
    m.set(k, Math.round(((m.get(k) ?? 0) + x.cantitate) * 100) / 100);
  }
  return m;
}

export function scor(referinta: readonly RandRef[], citite: readonly (Omit<CampuriRand, "zona"> & { cantitate: number })[]): Scor {
  const asteptat = insumeaza(referinta);
  const citit = insumeaza(citite);
  const nesigure = new Set(referinta.filter((r) => r.nesigur).map(cheieElement));
  const s: Scor = {
    total: asteptat.size, corecte: 0, totalSigure: asteptat.size - nesigure.size, corecteSigure: 0,
    gresite: [], lipsa: [], inPlus: [],
  };
  for (const [cheie, a] of asteptat) {
    const c = citit.get(cheie);
    if (c === undefined) s.lipsa.push({ cheie, asteptat: a, nesigurInReferinta: nesigure.has(cheie) });
    else if (Math.abs(c - a) < 0.01) { s.corecte++; if (!nesigure.has(cheie)) s.corecteSigure++; }
    else s.gresite.push({ cheie, asteptat: a, citit: c, nesigurInReferinta: nesigure.has(cheie) });
  }
  for (const [cheie, c] of citit) if (!asteptat.has(cheie)) s.inPlus.push({ cheie, citit: c });
  return s;
}

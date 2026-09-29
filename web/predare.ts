import type { Destinatie } from "../src/pricing/lists.js";

/**
 * Un fisier dat de un ecran altui ecran, in aceeasi pagina.
 *
 * Notitele de santier se termina cu un registru `.xlsx`, iar drumul de acolo
 * spre oferta e importul — aceeasi verificare, acelasi pas „Oferta". Predarea
 * sta in memorie, nu in `localStorage`: e un singur pas, nu o stare de pastrat.
 * Se ia o singura data.
 */
export interface Predare {
  fisier: File;
  destinatie: Destinatie;
  /** Randurile cu „(pret dublu)" primesc de doua ori pretul din lista. */
  pretDublu: boolean;
}

let asteptare: Predare | null = null;

export const preda = (p: Predare): void => { asteptare = p; };

export const preia = (): Predare | null => {
  const p = asteptare;
  asteptare = null;
  return p;
};

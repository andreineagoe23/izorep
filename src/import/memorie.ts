import type { LinieExtrasa } from "./schema.js";
import { proiecteaza, proiectii, sablonul, type LinieSursa, type Proiectie } from "./sabloane.js";

/**
 * L4: memoria de sabloane, adica ce a corectat omul si nu mai trebuie intrebat.
 *
 * Deduplicarea din `sabloane.ts` lucreaza in interiorul unui import: un
 * reprezentant per sablon, restul deduse. Memoria e acelasi mecanism, dar
 * PESTE importuri: sablonul invatat azi rezolva liniile de saptamana viitoare
 * fara niciun apel la model.
 *
 * Se memoreaza ROLUL si HARTA sloturilor, niciodata valorile — la fel ca la
 * deduplicare, si din acelasi motiv: doua linii cu acelasi tipar au acelasi
 * sistem si aceeasi forma, dar alt diametru si alta grosime.
 *
 * Ce NU face: nu memoreaza preturi si nu invata singura din ce a zis modelul.
 * Intra in memorie doar ce a confirmat sau a corectat un om — altfel o
 * extragere gresita s-ar propaga tacut peste toate proiectele urmatoare.
 */

export interface SablonInvatat {
  tipar: string;
  /** Rolul, ca linie extrasa de referinta. Valorile ei nu se folosesc. */
  extras: LinieExtrasa;
  harta: Proiectie[];
  /** Textul de la care s-a invatat, ca omul sa poata verifica ce a intrat. */
  exemplu: string;
  actualizat: string;
}

/** Ce trebuie sa stie sa faca un depozit de sabloane, indiferent unde tine datele. */
export interface StocSabloane {
  toate(): SablonInvatat[];
  pune(s: SablonInvatat): void;
  sterge(tipar: string): void;
}

/** Depozit in memorie. Pentru teste si ca baza pentru celelalte. */
export function stocInMemorie(initial: SablonInvatat[] = []): StocSabloane {
  const m = new Map(initial.map((s) => [s.tipar, s]));
  return {
    toate: () => [...m.values()],
    pune: (s) => { m.set(s.tipar, s); },
    sterge: (t) => { m.delete(t); },
  };
}

/**
 * Invata un sablon dintr-o linie confirmata de om.
 *
 * Intoarce `null` cand valorile nu se pot lega de sloturi — vezi `proiectii`.
 * Un sablon fara harta n-ar putea reciti numerele pe alta linie, deci ar fi o
 * capcana: ar arata ca stie, si ar da valorile altcuiva.
 */
export function invata(
  text: string, extras: LinieExtrasa, cand = new Date(),
): SablonInvatat | null {
  const s = sablonul(text);
  const harta = proiectii(extras, s);
  if (harta === null) return null;
  return {
    tipar: s.tipar, extras, harta,
    exemplu: text.replace(/\s+/g, " ").slice(0, 200),
    actualizat: cand.toISOString(),
  };
}

/**
 * Rezolva din memorie ce se poate, inainte de orice apel la model.
 *
 * Liniile ramase merg mai departe pe drumul obisnuit — deduplicare, apoi model.
 * Memoria nu are voie sa scada acoperirea, doar sa scada costul.
 */
export function aplicaMemorie(
  linii: LinieSursa[], stoc: StocSabloane,
): { rezolvate: LinieExtrasa[]; ramase: LinieSursa[] } {
  const dupaTipar = new Map(stoc.toate().map((s) => [s.tipar, s]));
  const rezolvate: LinieExtrasa[] = [];
  const ramase: LinieSursa[] = [];

  for (const l of linii) {
    const s = sablonul(l.text);
    const invatat = dupaTipar.get(s.tipar);
    if (!invatat) { ramase.push(l); continue; }
    const p = proiecteaza(invatat.extras, invatat.harta, { index: l.index, sablon: s });
    if (p) {
      rezolvate.push({
        ...p,
        motiv: `sablon invatat de la o corectie umana (${invatat.exemplu.slice(0, 60)})`,
      });
    } else {
      ramase.push(l);
    }
  }
  return { rezolvate, ramase };
}

/**
 * Lista clientului fata de ce s-a masurat pe teren, inainte de oferta.
 *
 * Firma (5 octombrie 2026, intrebarea tehnica 1): la clientii din apropiere se
 * masoara si pe teren, chiar cand clientul a trimis o lista. Omul de la birou
 * vrea sa vada unde nu se potrivesc: cantitati diferite, pozitii pe care
 * clientul le-a uitat, pozitii din lista care pe teren nu exista.
 *
 * Pozitiile se compara pe amprenta (`amprenta.ts`), ca la situatii: forma si,
 * strat cu strat, materialul, grosimea si randul din lista. „DN50" din lista
 * si „ø60" din carnet sunt aceeasi pozitie. Cantitatile se aduna pe amprenta:
 * clientul scrie pe zone, carnetul pe alte zone.
 */
import type { LinieProcesata } from "../import/nucleu.js";
import { amprenta } from "./amprenta.js";
import type { RandExecutat } from "./potrivire.js";

/** O pozitie din lista clientului, cu amprenta ei. */
export interface RandLista {
  text: string;
  cantitate: number;
  amprenta: string | null;
}

export function randuriDinLista(linii: readonly LinieProcesata[]): RandLista[] {
  return linii
    .filter((l) => l.extras.sistem !== null)
    .map((l) => ({ text: l.bruta.text, cantitate: l.bruta.cantitate ?? 0, amprenta: amprenta(l) }));
}

export type StareComparatie = "la_fel" | "diferit" | "doar_in_lista" | "doar_masurat";

export interface PozitieComparata {
  amprenta: string;
  /** Textul din lista clientului, sau din carnet daca lista n-o are. */
  text: string;
  lista: number;
  masurat: number;
  stare: StareComparatie;
}

export interface Comparatie {
  pozitii: PozitieComparata[];
  /** Randuri care nu se pot compara (fara amprenta: nu s-au putut citi complet). */
  necomparabile: { text: string; cantitate: number; sursa: "lista" | "masurat" }[];
}

/** Sub atat diferenta e rotunjire de masurare, nu alta cantitate. */
const TOLERANTA = 0.01;

const rotunjit = (x: number): number => Math.round(x * 1000) / 1000;

export function comparaCuLista(lista: readonly RandLista[], masurat: readonly RandExecutat[]): Comparatie {
  const grup = new Map<string, { text: string; lista: number; masurat: number; ordine: number }>();
  const necomparabile: Comparatie["necomparabile"] = [];
  let ordine = 0;
  const pune = (a: string, text: string, cant: number, camp: "lista" | "masurat"): void => {
    const g = grup.get(a) ?? { text, lista: 0, masurat: 0, ordine: ordine++ };
    g[camp] = rotunjit(g[camp] + cant);
    grup.set(a, g);
  };
  for (const r of lista) {
    if (r.amprenta === null) necomparabile.push({ text: r.text, cantitate: r.cantitate, sursa: "lista" });
    else pune(r.amprenta, r.text, r.cantitate, "lista");
  }
  for (const r of masurat) {
    if (r.amprenta === null) necomparabile.push({ text: r.text, cantitate: r.cantitate, sursa: "masurat" });
    else pune(r.amprenta, r.text, r.cantitate, "masurat");
  }
  const pozitii = [...grup].sort((a, b) => a[1].ordine - b[1].ordine).map(([a, g]): PozitieComparata => {
    const stare: StareComparatie = g.lista === 0 ? "doar_masurat"
      : g.masurat === 0 ? "doar_in_lista"
        : Math.abs(g.lista - g.masurat) <= TOLERANTA * Math.max(g.lista, g.masurat) ? "la_fel" : "diferit";
    return { amprenta: a, text: g.text, lista: g.lista, masurat: g.masurat, stare };
  });
  return { pozitii, necomparabile };
}

import elastomer from "../../data/price-lists/elastomer.json" with { type: "json" };
import vata_minerala from "../../data/price-lists/vata_minerala.json" with { type: "json" };
import tabla from "../../data/price-lists/tabla.json" with { type: "json" };
import pvc from "../../data/price-lists/pvc.json" with { type: "json" };
import goluri_foc from "../../data/price-lists/goluri_foc.json" with { type: "json" };
import type { Sistem } from "./types.js";

export interface BandaMultiplicator {
  band: [number, number];
  ml: number;
  manseta?: number | null;
  cot_teu_reductie?: number | null;
  robinet_vana_flansa_contor?: number | null;
  pompa_filtru_distribuitor?: number | null;
  flansa_robinet_contor_distribuitor?: number | null;
  pompa_filtru_vana23?: number | null;
}

export interface ListaPreturi {
  sistem: Sistem;
  denumire: string;
  contine: string;
  moneda: "EUR";
  grosimi_mm: number[];
  /** Cheie "diametru|grosime". Matricea e RARA: lipsa = nu se oferteaza. */
  cells: Record<string, number>;
  per_mp: Record<string, number>;
  multiplicatori: BandaMultiplicator[];
}

/**
 * Listele sunt importate static, nu citite de pe disc: modulul de tarifare
 * trebuie sa ruleze identic in Node si in browser. Demo-ul de pe GitHub Pages
 * ruleaza exact acest cod, fara backend.
 */
const LISTE = { elastomer, vata_minerala, tabla, pvc, goluri_foc } as unknown as Record<Sistem, ListaPreturi>;

export function lista(sistem: Sistem): ListaPreturi {
  const l = LISTE[sistem];
  if (!l) throw new Error(`lista de preturi lipseste: ${sistem}`);
  return l;
}

/** Diametrele disponibile in lista, sortate crescator. */
export function diametre(sistem: Sistem): number[] {
  const l = lista(sistem);
  const s = new Set<number>();
  for (const k of Object.keys(l.cells)) s.add(Number(k.split("|")[0]));
  return [...s].sort((a, b) => a - b);
}

/** Grosimile ofertate la un diametru dat (tabla are una singura per diametru). */
export function grosimiLa(sistem: Sistem, diametru: number): number[] {
  const l = lista(sistem);
  const out: number[] = [];
  for (const k of Object.keys(l.cells)) {
    const [d, g] = k.split("|");
    if (Number(d) === diametru && g !== "-") out.push(Number(g));
  }
  return out.sort((a, b) => a - b);
}

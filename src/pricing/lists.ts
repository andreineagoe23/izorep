import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Sistem } from "./types.js";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "../../data/price-lists");

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

const cache = new Map<Sistem, ListaPreturi>();

export function lista(sistem: Sistem): ListaPreturi {
  let l = cache.get(sistem);
  if (!l) {
    l = JSON.parse(readFileSync(join(DATA, `${sistem}.json`), "utf8")) as ListaPreturi;
    cache.set(sistem, l);
  }
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

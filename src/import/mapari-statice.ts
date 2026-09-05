import index from "../../data/mapari/index.json" with { type: "json" };
import { MapareFoaie } from "./mapare.js";
import type { MapareSalvata } from "./cache-mapari.js";

/**
 * Maparile de coloane, izomorf — import static, ca `src/pricing/lists.ts`.
 *
 * `cache-mapari.ts` e Node-only fiindca SCRIE pe disc (`node:fs`); modulul de
 * aici doar CITESTE ce a fost deja generat, deci se importa si din browser, si
 * din vitest, fara sa rupa build-ul. `import.meta.glob` a fost respins
 * deliberat: nu se comporta identic in vitest si in build-ul de Vite, iar
 * "identic peste tot" e exact garantia pe care se bazeaza tot restul
 * pipeline-ului izomorf.
 */

interface IndexMapari {
  generat: string;
  mapari: MapareSalvata[];
}

/** Maparile inregistrate, indexate pe amprenta de layout. */
export function mapariStatice(): Map<string, MapareSalvata> {
  const { mapari } = index as unknown as IndexMapari;
  const out = new Map<string, MapareSalvata>();
  for (const m of mapari) {
    // Ce e in bundle trece prin aceeasi schema ca ce vine de la model — la fel
    // ca `citesteMapari()`, ca sa nu existe doua reguli de incredere diferite
    // dupa cum ruleaza codul, in Node sau in browser.
    MapareFoaie.parse(m.mapare);
    out.set(m.amprenta, m);
  }
  return out;
}

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { MapareFoaie } from "./mapare.js";

/**
 * Cache-ul de mapari de coloane, pe disc.
 *
 * Cheia e amprenta layoutului (etichetele de antet + latimea), nu numele
 * fisierului: acelasi client trimite acelasi sablon de Excel la fiecare
 * proiect, iar `Radoia.xlsx` are sapte foi cu antet identic. O mapare, sapte
 * foi, si zero apeluri la al doilea fisier cu acelasi layout.
 *
 * Modul de Node, DELIBERAT separat de `mapare.ts`: acela e izomorf si se
 * importa si din browser, unde `node:fs` ar rupe build-ul.
 */
export const DIR_MAPARI = new URL("../../data/mapari/", import.meta.url).pathname;

export interface MapareSalvata {
  amprenta: string;
  /** Doar pentru cine citeste fisierul: din ce fisier si ce foaie a iesit. */
  fisier: string;
  foaie: string;
  model: string;
  generat: string;
  mapare: MapareFoaie;
}

const nume = (amprenta: string): string =>
  `${createHash("sha256").update(amprenta).digest("hex").slice(0, 16)}.json`;

export function citesteMapari(): Map<string, MapareSalvata> {
  const out = new Map<string, MapareSalvata>();
  if (!existsSync(DIR_MAPARI)) return out;
  for (const f of readdirSync(DIR_MAPARI)) {
    if (!f.endsWith(".json")) continue;
    const m = JSON.parse(readFileSync(join(DIR_MAPARI, f), "utf8")) as MapareSalvata;
    // Ce e pe disc trece prin aceeasi schema ca ce vine de la model.
    MapareFoaie.parse(m.mapare);
    out.set(m.amprenta, m);
  }
  return out;
}

export function scrieMapare(m: MapareSalvata): string {
  mkdirSync(DIR_MAPARI, { recursive: true });
  const cale = join(DIR_MAPARI, nume(m.amprenta));
  writeFileSync(cale, `${JSON.stringify(m, null, 2)}\n`);
  return cale;
}

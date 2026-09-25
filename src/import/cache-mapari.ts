import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { MapareFoaie } from "./mapare.js";

/**
 * Cache-ul de mapari de coloane, pe disc.
 *
 * Cheia e amprenta layoutului (etichetele de antet + latimea), nu numele
 * fisierului: acelasi client trimite acelasi sablon de Excel la fiecare
 * proiect, iar `cerere-de-oferta-spital.xlsx` are sapte foi cu antet identic. O mapare, sapte
 * foi, si zero apeluri la al doilea fisier cu acelasi layout.
 *
 * Modul de Node, DELIBERAT separat de `mapare.ts`: acela e izomorf si se
 * importa si din browser, unde `node:fs` ar rupe build-ul.
 *
 * Toate cele trei functii primesc directorul ca parametru, cu directorul real
 * ca implicit. Nu e generalitate degeaba: suita ruleaza fisierele de test in
 * paralel, iar `mapari-statice.test.ts` compara `index.json` cu continutul
 * directorului. Un test care ar scrie in directorul real ar face bariera aia
 * sa pice din cand in cand, adica exact felul de esec pe care nimeni nu-l mai
 * crede dupa a doua oara.
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

const NUME_INDEX = "index.json";

export function citesteMapari(dir = DIR_MAPARI): Map<string, MapareSalvata> {
  const out = new Map<string, MapareSalvata>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    // index.json e generat din fisierele astea, nu e o mapare el insusi —
    // daca ar intra aici, s-ar parsa ca MapareSalvata si ar crapa pe schema.
    if (!f.endsWith(".json") || f === NUME_INDEX) continue;
    const m = JSON.parse(readFileSync(join(dir, f), "utf8")) as MapareSalvata;
    // Ce e pe disc trece prin aceeasi schema ca ce vine de la model.
    MapareFoaie.parse(m.mapare);
    out.set(m.amprenta, m);
  }
  return out;
}

export function scrieMapare(m: MapareSalvata, dir = DIR_MAPARI): string {
  mkdirSync(dir, { recursive: true });
  const cale = join(dir, nume(m.amprenta));
  writeFileSync(cale, `${JSON.stringify(m, null, 2)}\n`);
  // Indexul nu poate ramane in urma: e singura cale prin care browserul (fara
  // node:fs) vede maparile de pe disc, deci fiecare scriere il regenereaza.
  scrieIndex(dir);
  return cale;
}

/**
 * Regenereaza `index.json` din directorul de mapari.
 *
 * Ordinea e sortata dupa amprenta, deterministic — altfel fiecare regenerare
 * ar produce alt diff, doar din ordinea de citire a `readdirSync`.
 */
export function scrieIndex(dir = DIR_MAPARI): string {
  const mapari = [...citesteMapari(dir).values()].sort((a, b) => a.amprenta.localeCompare(b.amprenta));
  mkdirSync(dir, { recursive: true });
  const cale = join(dir, NUME_INDEX);
  const continut = { generat: new Date().toISOString(), mapari };
  writeFileSync(cale, `${JSON.stringify(continut, null, 2)}\n`);
  return cale;
}

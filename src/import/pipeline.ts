import { parseWorkbook, type LinieBruta } from "./parse-workbook.js";
import { extrageDeterminist } from "./extract-regex.js";
import { extrageCuModel, type OptiuniModel } from "./extract-llm.js";
import type { LinieExtrasa } from "./schema.js";
import { tarifeaza } from "../pricing/engine.js";
import { PozitieNetarifata, type RezultatTarifare } from "../pricing/types.js";

export type Sursa = "regex" | "model";

export interface LinieProcesata {
  bruta: LinieBruta;
  extras: LinieExtrasa;
  sursa: Sursa;
  pret?: RezultatTarifare;
  /** Motivul pentru care linia nu s-a putut tarifa. */
  eroare?: string;
  /** true daca linia trebuie sa treaca prin ecranul de validare umana. */
  necesitaValidare: boolean;
}

export interface RaportImport {
  fisier: string;
  total: number;
  liniiIzolatie: number;
  prinRegex: number;
  prinModel: number;
  tarifate: number;
  deValidat: number;
  netarifate: number;
  valoareTotala: number;
  linii: LinieProcesata[];
}

/**
 * Pipeline-ul de import, L0 -> L4.
 *
 * Ce NU face: nu scrie in baza de date si nu emite nimic. Produce un raport
 * pe care omul il confirma. Nicio linie nu devine deviz fara acel pas.
 */
export async function importaFisier(
  cale: string,
  optiuni: OptiuniModel & { pragIncredere?: number; faraModel?: boolean } = {},
): Promise<RaportImport> {
  const prag = optiuni.pragIncredere
    ?? Number(process.env["IZOREP_CONFIDENCE_THRESHOLD"] ?? 0.85);

  const brute = await parseWorkbook(cale);

  // L2a - determinist
  const rezolvate = new Map<number, { extras: LinieExtrasa; sursa: Sursa }>();
  const reziduale: { index: number; text: string; um?: string }[] = [];
  for (const b of brute) {
    const r = extrageDeterminist(b.index, b.text, b.um);
    if (r.complet) rezolvate.set(b.index, { extras: r.linie, sursa: "regex" });
    else reziduale.push({ index: b.index, text: b.text, ...(b.um ? { um: b.um } : {}) });
  }

  // L2b - model, doar pe rest
  if (!optiuni.faraModel && reziduale.length > 0) {
    for (const e of await extrageCuModel(reziduale, optiuni)) {
      rezolvate.set(e.index, { extras: e, sursa: "model" });
    }
  }

  // L3 - tarifare determinista
  const linii: LinieProcesata[] = [];
  for (const b of brute) {
    const r = rezolvate.get(b.index);
    if (!r) continue;
    const { extras, sursa } = r;

    const proc: LinieProcesata = {
      bruta: b, extras, sursa,
      necesitaValidare: extras.sistem !== null && extras.incredere < prag,
    };

    if (extras.sistem && extras.diametru_valoare !== null && extras.diametru_tip) {
      try {
        proc.pret = tarifeaza({
          diametru: { valoare: extras.diametru_valoare, tip: extras.diametru_tip },
          straturi: [
            { sistem: extras.sistem, ...(extras.grosime_mm !== null ? { grosime_mm: extras.grosime_mm } : {}) },
            ...extras.straturi_extra.map((s) => ({
              sistem: s.sistem, ...(s.grosime_mm !== null ? { grosime_mm: s.grosime_mm } : {}),
            })),
          ],
          forma: extras.forma ?? "ml",
          cantitate: b.cantitate ?? 1,
        });
      } catch (e) {
        // Pozitia fara pret se MARCHEAZA, nu se ghiceste.
        proc.eroare = e instanceof PozitieNetarifata ? e.message : String(e);
        proc.necesitaValidare = true;
      }
    }
    linii.push(proc);
  }

  const izolatie = linii.filter((l) => l.extras.sistem !== null);
  return {
    fisier: cale,
    total: brute.length,
    liniiIzolatie: izolatie.length,
    prinRegex: izolatie.filter((l) => l.sursa === "regex").length,
    prinModel: izolatie.filter((l) => l.sursa === "model").length,
    tarifate: izolatie.filter((l) => l.pret).length,
    deValidat: izolatie.filter((l) => l.necesitaValidare).length,
    netarifate: izolatie.filter((l) => !l.pret).length,
    valoareTotala: Math.round(izolatie.reduce((s, l) => s + (l.pret?.total ?? 0), 0) * 100) / 100,
    linii,
  };
}

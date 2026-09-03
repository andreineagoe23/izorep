import { parseWorkbook, type LinieBruta } from "./parse-workbook.js";
import { adaugaSectiuni } from "./sectiuni.js";
import { extrageDeterminist } from "./extract-regex.js";
import { extrageCuModel, type OptiuniModel } from "./extract-llm.js";
import { valideazaExtragere, type Avertisment } from "./valideaza.js";
import type { LinieExtrasa } from "./schema.js";
import { tarifeaza } from "../pricing/engine.js";
import { tarifeazaGolFoc } from "../pricing/goluri-foc.js";
import {
  PozitieNetarifata,
  type RezultatGolFoc, type RezultatTarifare,
} from "../pricing/types.js";

export type Sursa = "regex" | "model";

export interface LinieProcesata {
  bruta: LinieBruta;
  extras: LinieExtrasa;
  sursa: Sursa;
  /**
   * Cele doua forme de rezultat au altceva inauntru — straturi la matrice,
   * componente la inchiderile la foc — dar impart pret_unitar, cantitate si
   * total, singurele campuri de care are nevoie raportul.
   */
  pret?: RezultatTarifare | RezultatGolFoc;
  /** Motivul pentru care linia nu s-a putut tarifa. */
  eroare?: string;
  /**
   * Ce n-a trecut de validarea de plauzibilitate. Se recalculeaza aici, desi
   * `extrageCuModel` a aplicat deja aceleasi reguli: acolo efectul e coborarea
   * increderii, ca sa nu poata fi sarita de niciun apelant; aici e nevoie de
   * lista in forma structurata, pentru raport si pentru ecranul de validare.
   * Functia e pura, deci a doua trecere nu costa nimic.
   */
  avertismente?: Avertisment[];
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
  /** Linii pe care modelul a produs ceva ce nu se verifica in textul sursa. */
  cuAvertisment: number;
  /** Linii trimise la model pentru care nu a intors niciun obiect. */
  modelFaraRaspuns: number;
  netarifate: number;
  valoareTotala: number;
  linii: LinieProcesata[];
}

/**
 * L3 pe o singura linie extrasa.
 *
 * Sta separat de bucla pentru ca acelasi drum e parcurs si de testul de golden
 * files, pe iesirea inregistrata a modelului. Daca ar fi ramas inline, testul
 * ala ar fi verificat o COPIE a regulii, nu regula.
 *
 * Pozitia fara pret se MARCHEAZA, nu se ghiceste.
 */
export function tarifeazaExtras(
  extras: LinieExtrasa,
  cantitate: number,
): { pret?: RezultatTarifare | RezultatGolFoc; eroare?: string } {
  try {
    if (extras.sistem === "goluri_foc") {
      if (extras.gol_latime_mm === null || extras.gol_inaltime_mm === null) {
        throw new PozitieNetarifata(
          "inchidere gol la foc fara dimensiunea golului; pretul vine din suprafata lui",
          { index: extras.index },
        );
      }
      return {
        pret: tarifeazaGolFoc({
          gol: { latime_mm: extras.gol_latime_mm, inaltime_mm: extras.gol_inaltime_mm },
          cantitate,
        }),
      };
    }
    if (extras.sistem && extras.diametru_valoare !== null && extras.diametru_tip) {
      return {
        pret: tarifeaza({
          diametru: { valoare: extras.diametru_valoare, tip: extras.diametru_tip },
          straturi: [
            { sistem: extras.sistem, ...(extras.grosime_mm !== null ? { grosime_mm: extras.grosime_mm } : {}) },
            ...extras.straturi_extra.map((s) => ({
              sistem: s.sistem, ...(s.grosime_mm !== null ? { grosime_mm: s.grosime_mm } : {}),
            })),
          ],
          forma: extras.forma ?? "ml",
          cantitate,
        }),
      };
    }
    return {};
  } catch (e) {
    return { eroare: e instanceof PozitieNetarifata ? e.message : String(e) };
  }
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

  const brute = adaugaSectiuni(await parseWorkbook(cale));

  // L2a - determinist
  const rezolvate = new Map<number, { extras: LinieExtrasa; sursa: Sursa }>();
  const reziduale: { index: number; text: string; um?: string }[] = [];
  for (const b of brute) {
    const r = extrageDeterminist(b.index, b.text, b.um, b.sectiune);
    if (r.complet) rezolvate.set(b.index, { extras: r.linie, sursa: "regex" });
    else reziduale.push({ index: b.index, text: b.text, ...(b.um ? { um: b.um } : {}) });
  }

  // L2b - model, doar pe rest
  let faraRaspuns = 0;
  if (!optiuni.faraModel && reziduale.length > 0) {
    for (const e of await extrageCuModel(reziduale, optiuni)) {
      rezolvate.set(e.index, { extras: e, sursa: "model" });
    }
    // Contractul e "cate un obiect per linie, cu acelasi index". Modelul il
    // incalca in tacere: masurat pe `Oferta 27.04.2026.xlsx`, 43 de linii
    // trimise, 35 intoarse. Liniile lipsa nu apar nicaieri in raport — nici ca
    // pozitii, nici ca erori — deci disparitia lor arata exact ca un fisier cu
    // mai putine pozitii. Se numara, ca sa se vada.
    faraRaspuns = reziduale.filter((r) => !rezolvate.has(r.index)).length;
  }

  // L3 - tarifare determinista
  const linii: LinieProcesata[] = [];
  for (const b of brute) {
    const r = rezolvate.get(b.index);
    if (!r) continue;
    const { extras, sursa } = r;

    // Doar pe iesirea modelului: stratul determinist citeste numerele direct
    // din text, deci nu poate inventa, iar regulile lui au deja teste proprii.
    const avertismente = sursa === "model"
      ? valideazaExtragere(extras, { text: b.text, ...(b.um ? { um: b.um } : {}) })
      : [];

    const proc: LinieProcesata = {
      bruta: b, extras, sursa,
      ...(avertismente.length ? { avertismente } : {}),
      necesitaValidare: extras.sistem !== null
        && (extras.incredere < prag || avertismente.length > 0),
    };

    const t = tarifeazaExtras(extras, b.cantitate ?? 1);
    if (t.pret) proc.pret = t.pret;
    if (t.eroare !== undefined) { proc.eroare = t.eroare; proc.necesitaValidare = true; }
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
    cuAvertisment: izolatie.filter((l) => l.avertismente?.length).length,
    modelFaraRaspuns: faraRaspuns,
    netarifate: izolatie.filter((l) => !l.pret).length,
    valoareTotala: Math.round(izolatie.reduce((s, l) => s + (l.pret?.total ?? 0), 0) * 100) / 100,
    linii,
  };
}

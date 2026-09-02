import type { LinieBruta } from "./parse-workbook.js";

/**
 * Contextul de sectiune al fiecarui rand.
 *
 * Multe pozitii nu spun singure ce sunt: in oferta 118.1, linia e doar
 * "Teava OL/OLZN DN15 | 130/130", iar faptul ca e o inchidere de gol la foc
 * sta in randul de deasupra — "Treceri prin pereti rezistenti la foc EI30".
 * Fara legatura asta, 53 de pozitii reale ies neclasificate.
 *
 * Antetul de sectiune se recunoaste fizic, nu semantic: e o celula imbinata
 * peste mai multe coloane, deci parserul o vede repetata identic pe rand, si
 * nu are nici unitate de masura, nici cantitate. Regula nu depinde de ce
 * scrie in ea, deci merge la fel pe orice client.
 *
 * E o solutie ingusta pentru un singur nivel de sectiune. Maparea de coloane
 * per client (L1) o inlocuieste cu ceva care stie si ierarhii, si randuri de
 * continuare ("Same - Ø125 mm" din Book15.xlsx).
 */
export interface LinieCuSectiune extends LinieBruta {
  /** Textul ultimului antet de sectiune de deasupra, daca exista. */
  sectiune?: string;
}

/** true daca randul e un antet de sectiune, nu o pozitie. */
export function esteAntetSectiune(b: LinieBruta): boolean {
  if (b.um !== undefined || b.cantitate !== undefined) return false;
  const texte = b.celule.filter(
    (c): c is string => typeof c === "string" && c.trim().length > 3,
  );
  if (texte.length < 2) return false;
  const distincte = new Set(texte.map((t) => t.trim()));
  return distincte.size === 1;
}

/**
 * Ataseaza fiecarui rand sectiunea in care se afla. Sectiunea se reseteaza
 * la fiecare foaie: un antet de pe "Termice+Sanitare" nu spune nimic despre
 * randurile de pe foaia urmatoare.
 */
export function adaugaSectiuni(brute: LinieBruta[]): LinieCuSectiune[] {
  const out: LinieCuSectiune[] = [];
  let sectiune: string | undefined;
  let foaie: string | undefined;

  for (const b of brute) {
    if (b.foaie !== foaie) { foaie = b.foaie; sectiune = undefined; }
    if (esteAntetSectiune(b)) {
      sectiune = String(b.celule.find((c) => typeof c === "string" && c.trim().length > 3)).trim();
      // Antetul nu e pozitie, dar ramane in lista: raportul numara randurile
      // citite, iar indecsii trimisi la model trebuie sa ramana stabili.
      out.push(b);
      continue;
    }
    out.push(sectiune === undefined ? b : { ...b, sectiune });
  }
  return out;
}

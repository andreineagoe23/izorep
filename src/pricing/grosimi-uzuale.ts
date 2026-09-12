import { toOuterDiameter, type TipDiametru } from "./dn-table.js";
import type { SistemMatrice } from "./types.js";

/**
 * Grosimea pe care o pune firma cand clientul n-o scrie.
 *
 * Sursa: raspunsul firmei din 11 septembrie 2026. NU e dedusa din oferte —
 * prima varianta a acestui fisier era, si era gresita: reprodusese tabelul din
 * oferta TRANSAVIA (40/50/60 mm), despre care firma a spus apoi ca fusese
 * "optional la cererea clientului". O regula dedusa dintr-o singura oferta
 * poate fi exceptia, nu regula. De-aia tabelele de aici sunt cele spuse ca
 * fiind GENERALE, iar cele personalizate raman ce sunt: corectii manuale pe
 * import, peste propunere.
 *
 * Doua tabele, dupa serviciu:
 *
 *   apa calda / agent termic / abur  ->  vata minerala
 *   apa rece  / agent de frig        ->  cauciuc elastomeric
 *
 * De-aia propunerea se alege dupa SISTEMUL liniei, nu dupa un camp separat de
 * fluid: materialul pe care l-a cerut clientul spune deja in ce regim suntem.
 * Cand clientul nu scrie nici materialul, alegerea ramane a omului.
 */
export interface PragGrosime {
  /** Limita SUPERIOARA a intervalului de diametru exterior, inclusiva. */
  pana_la_od: number;
  grosime_mm: number;
}

/**
 * Vata minerala — apa calda, agent termic, abur.
 *
 * Firma a dat tabelul pe DN; aici e convertit in o (coloana ISO din
 * `tevi.md`), fiindca listele de preturi se cauta pe o si fiindca asa merge
 * si cand clientul scrie direct diametrul exterior:
 *
 *   DN15/20/25 -> 20 mm     (o21,3 · o26,9 · o33,7)
 *   DN32       -> 30 mm     (o42,4)
 *   DN40       -> 40 mm     (o48,3)
 *   DN50       -> 50 mm     (o60,3)
 *   DN65       -> 60 mm     (o76,1)
 *   DN80       -> 80 mm     (o88,9)
 *   DN100 si peste -> 100 mm
 */
export const PRAGURI_VATA: PragGrosime[] = [
  { pana_la_od: 33.7, grosime_mm: 20 },
  { pana_la_od: 42.4, grosime_mm: 30 },
  { pana_la_od: 48.3, grosime_mm: 40 },
  { pana_la_od: 60.3, grosime_mm: 50 },
  { pana_la_od: 76.1, grosime_mm: 60 },
  { pana_la_od: 88.9, grosime_mm: 80 },
];

/** Peste ultimul prag, vata ramane la 100 mm oricat de mare e teava. */
export const VATA_PESTE_ULTIMUL_PRAG = 100;

/**
 * Elastomer — apa rece, agent de frig. Dat de firma direct in o.
 *
 *   pana la o60   -> 13 mm
 *   o76 - o219    -> 19 mm
 *   o273 - o324   -> 25 mm
 *
 * 9 mm si 32 mm NU intra aici, desi exista in lista: 9 se foloseste "mai mult
 * la pluviale", iar 32 "la sisteme de racire, la o-uri mai mari, depinde de
 * mediul inconjurator". Amandoua cer o informatie care nu e pe randul din
 * Excel, deci raman alegere de om.
 */
export const PRAGURI_ELASTOMER: PragGrosime[] = [
  { pana_la_od: 60, grosime_mm: 13 },
  { pana_la_od: 219, grosime_mm: 19 },
  { pana_la_od: 324, grosime_mm: 25 },
];

/**
 * Grosimea propusa pentru un diametru, sau `null` cand nu exista temei.
 *
 * Peste ultimul prag: vata ramane la 100 mm (spus de firma), elastomerul NU
 * primeste propunere — acolo intra 32 mm, care depinde de mediu, si nimeni nu
 * poate citi mediul dintr-un rand de Excel.
 *
 * Tabla si PVC-ul n-au propunere deloc: sunt jachete, grosimea lor se deduce
 * din randul deja gasit in lista (`grosimeEfectiva`), nu din diametru.
 */
export function grosimePropusa(
  sistem: SistemMatrice,
  diametru_valoare: number,
  diametru_tip: TipDiametru,
): number | null {
  if (sistem !== "vata_minerala" && sistem !== "elastomer") return null;

  let od: number;
  try {
    od = toOuterDiameter(diametru_valoare, diametru_tip);
  } catch {
    return null; // DN care nu exista in tabel: nu se propune pe o presupunere
  }

  if (sistem === "elastomer") {
    return PRAGURI_ELASTOMER.find((p) => od <= p.pana_la_od)?.grosime_mm ?? null;
  }
  return PRAGURI_VATA.find((p) => od <= p.pana_la_od)?.grosime_mm ?? VATA_PESTE_ULTIMUL_PRAG;
}

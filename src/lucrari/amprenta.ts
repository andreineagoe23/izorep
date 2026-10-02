import type { LinieProcesata } from "../import/nucleu.js";
import { MARCA_PRET_DUBLU } from "../santier/spre-cerere.js";

/**
 * Ce e aceeasi lucrare, indiferent cum a fost scrisa. Null = linia nu e
 * izolatie sau n-are din ce sa se compare (fara pret din liste). „Pret dublu”
 * din carnet e alta pozitie, cu alt pret, desi materialul e acelasi.
 */
export function amprenta(l: LinieProcesata): string | null {
  if (l.extras.sistem === null || !l.pret) return null;
  if ("straturi" in l.pret && l.pret.straturi.length > 0) {
    const straturi = l.pret.straturi
      .map((s) => `${s.sistem}:${s.grosime_mm ?? "-"}:${s.rand_lista || Math.round(s.diametru_geometric)}`)
      .join("+");
    return `${l.extras.forma ?? "ml"}|${straturi}${l.bruta.text.includes(MARCA_PRET_DUBLU) ? "|dublu" : ""}`;
  }
  if (l.extras.sistem === "goluri_foc") {
    const e = l.extras;
    return `goluri_foc|${e.diametru_valoare ?? "-"}|${e.gol_latime_mm ?? "-"}x${e.gol_inaltime_mm ?? "-"}`;
  }
  return null;
}

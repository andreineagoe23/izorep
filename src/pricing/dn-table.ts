/**
 * DN -> diametru exterior real (mm), teava de otel, serie standard.
 *
 * Clientii ofertează în DN, listele de preturi sunt indexate pe diametru
 * exterior. Fara tabelul asta motorul nu poate cauta nimic.
 *
 * Valorile sunt confirmate din listele de cantitati ale clientului, unde
 * ambele apar in aceeasi celula:
 *   "Dn 50 (60,3x3,6 - 2'')"      "Dn 80 (88,9 x 4 - 3'')"
 *   "Dn 100 (114,3 x 4,5 - 4”)"   "Dn 125 (139,7 x 5 - 5”)"
 */
export const DN_TO_OD: Readonly<Record<number, number>> = {
  8: 13.5, 10: 17.2, 15: 21.3, 20: 26.9, 25: 33.7, 32: 42.4, 40: 48.3,
  50: 60.3, 65: 76.1, 80: 88.9, 100: 114.3, 125: 139.7, 150: 168.3,
  200: 219.1, 250: 273.0, 300: 323.9, 350: 355.6, 400: 406.4,
};

/** Conducte de plastic: dimensiunea nominala ESTE diametrul exterior. */
export const PLASTIC_IS_OD = new Set(["PPR", "PP", "PEHD", "PEX", "PVC"]);

export type TipDiametru = "DN" | "exterior" | "interior";

export class DiametruNecunoscut extends Error {
  constructor(readonly dn: number) {
    super(`DN${dn} nu exista in tabelul de conversie DN -> diametru exterior`);
    this.name = "DiametruNecunoscut";
  }
}

/** Normalizeaza orice notatie de diametru la diametru exterior in mm. */
export function toOuterDiameter(valoare: number, tip: TipDiametru): number {
  if (tip === "exterior" || tip === "interior") return valoare;
  const od = DN_TO_OD[valoare];
  if (od === undefined) throw new DiametruNecunoscut(valoare);
  return od;
}

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

/**
 * Tolii -> DN, coloana Toli din tabelul de conversie primit de la firma (vezi
 * `.claude/tevi.md`). Cheile sunt scrise cu un singur spatiu: `"1 1/4"`.
 *
 * Sta aici, langa `DN_TO_OD`, fiindca il folosesc doi cititori diferiti:
 * validatorul modelului (`valideaza.ts`), ca `Dn 2''` sa nu dea alarma de
 * diametru necitat, si extragerea determinista (`extract-regex.ts`), ca
 * `Ø1/2"` sa nu mai fie citit ca diametrul exterior 1.
 */
export const TOLI_DN: Readonly<Record<string, number>> = {
  "3/8": 10, "1/2": 15, "3/4": 20, "1": 25, "1 1/4": 32, "1 1/2": 40,
  "2": 50, "2 1/2": 65, "3": 80, "4": 100, "5": 125, "6": 150, "8": 200,
  "10": 250, "12": 300, "14": 350, "16": 400, "18": 450, "20": 500,
  "24": 600, "28": 700, "32": 800, "36": 900, "40": 1000,
};

export type TipDiametru = "DN" | "exterior" | "interior";

export class DiametruNecunoscut extends Error {
  constructor(readonly dn: number) {
    super(
      `DN${dn} nu exista in tabelul de conversie DN -> diametru exterior. ` +
      `Daca e teava de plastic sau tubulatura SPIRO, notatia e diametru exterior, ` +
      `nu DN — vezi tip: "exterior". Extragerea determinista face asta singura ` +
      `la SPIRO (confirmat de firma pe 11 septembrie 2026); aici ajung doar ` +
      `notatiile pe care nimic nu le-a putut reincadra.`,
    );
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

/**
 * Pragul de potrivire pe SERIA de teava de otel (DN_TO_OD), indiferent de
 * notatia cu care a venit diametrul.
 *
 * De ce 0,8 si nu altceva: maximul masurat pe serie e 0,70 mm (Di49 -> 48,3,
 * Di169 -> 168,3 — vezi Oferta 284). Iar o90 e la 1,1 mm de 88,9 si o75 la
 * 1,1 mm de 76,1 (tevi de plastic, nu de otel) — pragul trebuie sa ramana
 * SUB 1,1 ca tevile de plastic sa NU fie confundate cu seria de otel.
 */
export const TOLERANTA_SERIE_OTEL = 0.8;

/**
 * True daca `valoare` cade pe seria standard de teava de otel, la cel mult
 * `toleranta` mm de vreo valoare din DN_TO_OD.
 *
 * Foloseste asta, nu notatia diametrului, ca sa decizi daca se aplica regula
 * "randul cel mai apropiat": clientii scriu des seria de otel cu notatia
 * "interior" (Di21, Di49, Di169...), dar randurile listei sunt chiar seria
 * standard, deci se cauta cel mai apropiat rand, nu se rotunjeste in sus.
 */
export function peSeriaDeOtel(valoare: number, toleranta = TOLERANTA_SERIE_OTEL): boolean {
  return Object.values(DN_TO_OD).some((od) => Math.abs(od - valoare) <= toleranta);
}

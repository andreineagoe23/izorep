/**
 * Cum se cumpara un material cand omul n-a scris alt ambalaj: din evidenta de
 * achizitii a firmei (`../attachments/achizitii/evidenta-achizitii-*.xlsx`,
 * primita pe 5 octombrie 2026). Masurat pe cumpararile din 2023–2026, pe
 * ambele firme:
 *
 * | Material | Ambalaj | Dovada |
 * |---|---|---|
 * | tub de elastomer (Armaflex, K-Flex, NMC) | tub de 2 m | 1.455 din 1.508 randuri sunt multipli de 2 ml |
 * | cochilie de vata (Cochiltech) | 1 m | 652 din 652 randuri, metri intregi |
 * | placa de elastomer (Armaflex, K-Flex ST, NMC) | placa de 2 m² | 593 din 611 randuri, multipli de 2 m² |
 * | saltea de vata (LM ECO ALU M) | rola, dupa grosime | dimensiunea e in denumire (50X1000X5000 = 5 m²); 207 din 211 randuri la 50 mm sunt role intregi |
 *
 * Tabla se cumpara la kg (din rola sau coli de 1 × 2 m) si placile de vata de
 * foc (Conlit, Techrock) au pachete diferite de la produs la produs: fara
 * ambalaj implicit, se comanda cat iese din calcul.
 *
 * Un ambalaj scris de om bate oricand ce e aici (`deComandat`).
 */
import type { Categorie } from "./necesar.js";
import type { Ambalaj } from "./registru.js";

/** LM ECO ALU M: grosimea, in mm → m² pe rola (latime 1 m × lungimea din denumire). */
export const ROLA_SALTEA: Readonly<Record<number, number>> = {
  20: 10, 30: 8, 40: 6, 50: 5, 60: 4, 70: 3.5, 100: 2.5,
};

export function ambalajImplicit(
  m: { sistem: string; grosime_mm: number | null; categorie: Categorie },
): Ambalaj | null {
  if (m.categorie === "tub") {
    if (m.sistem === "elastomer") return { unitate: "tub", continut: 2 };
    if (m.sistem === "vata_minerala") return { unitate: "cochilie", continut: 1 };
    return null;
  }
  if (m.categorie === "placa" && m.sistem === "elastomer") return { unitate: "placă", continut: 2 };
  if (m.categorie === "saltea" && m.grosime_mm !== null) {
    const mp = ROLA_SALTEA[m.grosime_mm];
    return mp !== undefined ? { unitate: "rolă", continut: mp } : null;
  }
  return null;
}

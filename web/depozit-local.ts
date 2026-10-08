/**
 * Stocul prototipului, pastrat in browser.
 *
 * Doar pentru prototip: miscarile si necesarurile trimise din import stau in
 * `localStorage`, deci le vede doar browserul in care au fost facute. Stocul
 * adevarat e folosit de mai multi oameni si va sta in baza;
 * logica lui e deja in `src/stoc/`, pura, si nu se schimba.
 *
 * Depozitul e injectabil ca sa poata fi testat in Node, si e best-effort, ca
 * `meniu-stare.ts`: blocat sau stricat, ecranul porneste gol, nu cade.
 */
import type { Ambalaj, Miscare } from "../src/stoc/registru.js";
import type { MaterialNecesar, Pierderi } from "../src/stoc/necesar.js";

export const CHEIE_DEPOZIT = "izorep-depozit";

/** Necesarul unei oferte importate, trimis la depozit din pasul „Oferta". */
export interface NecesarLucrare {
  id: string;
  /** ISO. */
  creat: string;
  /** Fisierul importat. */
  fisier: string;
  /** Obiectivul din antetul ofertei, daca a fost scris. */
  obiectiv: string;
  /** Depozitul santierului, daca omul l-a legat de unul. */
  santier?: string;
  /** Pierderile la croit cu care s-a calculat (lipsesc la necesarurile de dinainte de 9 octombrie 2026). */
  pierderi?: Pierderi;
  /** Pragul tub / placa, in mm. */
  pragTub?: number;
  /** Rezerva peste calcul, la necesarurile vechi; firma nu tine rezerva (S21). */
  adaos?: number;
  materiale: MaterialNecesar[];
  /** Cate pozitii nu au necesar calculat (fara pret, pret pus de mana, goluri la foc). */
  faraNecesar: number;
}

export interface StareDepozit {
  miscari: Miscare[];
  necesare: NecesarLucrare[];
  /**
   * Cum se cumpara fiecare material (S13), pe `cheieBaza`: din listele
   * furnizorilor, cand vin. Lipsa = se comanda exact cat iese din calcul.
   */
  ambalaje?: Record<string, Ambalaj>;
}

export const GOL: StareDepozit = { miscari: [], necesare: [] };

const alege = (d?: Storage): Storage | null => {
  if (d) return d;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export function citesteDepozit(d?: Storage): StareDepozit {
  try {
    const brut = alege(d)?.getItem(CHEIE_DEPOZIT);
    if (!brut) return { miscari: [], necesare: [] };
    const s = JSON.parse(brut) as Partial<StareDepozit>;
    return {
      miscari: Array.isArray(s.miscari) ? s.miscari : [],
      // Necesarurile de dinainte de 9 octombrie 2026 aveau piesele in bucati, nu in metri.
      necesare: Array.isArray(s.necesare)
        ? s.necesare.map((n) => ({ ...n, materiale: n.materiale.map((m) => Object.assign({ piese: 0, piesePresupuse: 0, pePozitie: [] }, m)) }))
        : [],
      ...(s.ambalaje && typeof s.ambalaje === "object" ? { ambalaje: s.ambalaje } : {}),
    };
  } catch {
    return { miscari: [], necesare: [] };
  }
}

/** Intoarce fals cand nu s-a putut scrie: ecranul spune ca nu se pastreaza. */
export function scrieDepozit(s: StareDepozit, d?: Storage): boolean {
  try {
    const dep = alege(d);
    if (!dep) return false;
    dep.setItem(CHEIE_DEPOZIT, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

/** Id scurt, unic in browser. Nu e identificator de document: e al prototipului. */
export const idNou = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

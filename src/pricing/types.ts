export type Sistem = "elastomer" | "vata_minerala" | "tabla" | "pvc" | "goluri_foc";

/**
 * Sistemele tarifate din matrice ø × grosime. Etansarile la foc sunt
 * excluse deliberat: lista lor are alta forma, iar tipul trebuie sa spuna
 * asta — nu un cast care ascunde diferenta pana la runtime.
 */
export type SistemMatrice = Exclude<Sistem, "goluri_foc">;

export type Forma =
  | "ml" | "mp" | "manseta" | "cot" | "teu" | "reductie"
  | "robinet" | "vana" | "flansa" | "contor" | "compensator"
  | "pompa" | "filtru" | "distribuitor" | "schimbator";

/** Un strat de izolatie. Grosimea lipseste doar la PVC si la tabla. */
export interface Strat {
  sistem: Sistem;
  grosime_mm?: number;
}

/** Un strat dintr-un sistem tarifat din matrice. */
export interface StratMatrice extends Strat {
  sistem: SistemMatrice;
}

export interface CerereTarifare {
  /** Diametrul asa cum l-a scris clientul, plus notatia folosita. */
  diametru: { valoare: number; tip: import("./dn-table.js").TipDiametru };
  /** Straturile in ordinea montarii, dinspre teava spre exterior. */
  straturi: Strat[];
  forma: Forma;
  cantitate: number;
}

export interface StratTarifat {
  sistem: Sistem;
  grosime_mm: number | null;
  /** Diametrul geometric la care ajunge stratul, inainte de potrivire pe rand. */
  diametru_geometric: number;
  /** Randul efectiv folosit din matricea de preturi. */
  rand_lista: number;
  pret_unitar: number;
}

export interface RezultatTarifare {
  straturi: StratTarifat[];
  /** Pretul pe unitate, dupa aplicarea multiplicatorului de forma. */
  pret_unitar: number;
  multiplicator: number;
  cantitate: number;
  total: number;
  moneda: "EUR";
}

export class PozitieNetarifata extends Error {
  constructor(readonly motiv: string, readonly context: Record<string, unknown>) {
    super(motiv);
    this.name = "PozitieNetarifata";
  }
}

/* ------------------------------------------------------------------ *
 * Inchideri goluri la foc
 *
 * Termenii sunt ai firmei, luati din "Oferta pret inchideri goluri la foc.xlsx"
 * si din oferta 118.1: "inchideri goluri la foc", "goluri pana la 0,05 mp",
 * "banda WRAP", "conducta plastic" / "conducta otel", "colier de protectie
 * antifoc PROMASTOP UNICOLLAR", "urcare" / "orizontala".
 *
 * Structura de pret e ADITIVA, nu matrice ø × grosime. Nota 2 din lista:
 * "Daca inchiderile golurilor la foc necesita banda wrap, pretul acestora va
 * fi constituit din pretul inchiderii golului la foc + pretul benzii wrap".
 * ------------------------------------------------------------------ */

/** Dimensiunile golului, in mm. Scrise "130/130" in coloana "dimensiune gol". */
export interface Gol {
  latime_mm: number;
  inaltime_mm: number;
}

/**
 * Materialul conductei. Nu e detaliu descriptiv: lista are DOUA tabele de
 * banda WRAP cu preturi diferite la acelasi diametru, pentru ca numarul de
 * infasurari difera (1 la otel, 2-6 la plastic). La ø140 sunt 12,19 EUR fata
 * de 65,665 EUR.
 */
export type MaterialConducta = "plastic" | "otel";

/**
 * Cum trece conducta prin perete. Lista da doua preturi de colier per
 * diametru: "1 colier/conducta plastic (urcare)" si "2 coliere/conducta
 * plastic (orizontala)", al doilea exact dublu.
 */
export type Traversare = "urcare" | "orizontal";

export interface CerereGolFoc {
  gol: Gol;
  /**
   * Diametrul conductei, in mm, asa cum apare in coloana "Dimensiune
   * conducta" (ø32, ø110). Necesar DOAR daca se cere banda WRAP sau colier:
   * pretul golului in sine depinde numai de suprafata lui.
   */
  diametru_conducta?: number;
  material_conducta?: MaterialConducta;
  /** Banda WRAP. */
  banda_wrap?: boolean;
  /** Colier PROMASTOP UNICOLLAR, cu felul traversarii. */
  colier?: Traversare;
  /**
   * Clasa peretelui (EI30, EI60, EI120...). Se pastreaza ca ETICHETA DE
   * GRUPARE, nu ca variabila de pret: in oferta 118.1 aceeasi conducta DN15
   * costa 23,05 EUR si la EI30, si la EI120.
   */
  clasa_foc?: string;
  cantitate: number;
}

export interface ComponentaGolFoc {
  tip: "gol" | "banda_wrap" | "colier";
  descriere: string;
  pret: number;
}

export interface RezultatGolFoc {
  componente: ComponentaGolFoc[];
  /** Suprafata reala a golului, in mp. Ea alege pragul de pret. */
  suprafata_mp: number;
  /**
   * Suprafata asa cum o scrie firma in coloana "suprafata": rotunjita in sus
   * la 2 zecimale. Exista doar pentru export, nu intra in niciun calcul.
   */
  suprafata_afisata: number;
  clasa_foc: string | null;
  pret_unitar: number;
  cantitate: number;
  total: number;
  moneda: "EUR";
}

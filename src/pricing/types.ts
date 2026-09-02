export type Sistem = "elastomer" | "vata_minerala" | "tabla" | "pvc" | "goluri_foc";

export type Forma =
  | "ml" | "mp" | "manseta" | "cot" | "teu" | "reductie"
  | "robinet" | "vana" | "flansa" | "contor" | "compensator"
  | "pompa" | "filtru" | "distribuitor" | "schimbator";

/** Un strat de izolatie. Grosimea lipseste doar la PVC si la tabla. */
export interface Strat {
  sistem: Sistem;
  grosime_mm?: number;
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

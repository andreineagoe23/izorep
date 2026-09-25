export type Sistem = "elastomer" | "vata_minerala" | "tabla" | "tabla_inox" | "pvc" | "goluri_foc";

/**
 * Sistemele tarifate din matrice ø × grosime. Etansarile la foc sunt
 * excluse deliberat: lista lor are alta forma, iar tipul trebuie sa spuna
 * asta — nu un cast care ascunde diferenta pana la runtime.
 */
export type SistemMatrice = Exclude<Sistem, "goluri_foc">;

/**
 * Sistemele care au lista de preturi REZIDENTIALA.
 *
 * Tabla de inox e SINGURUL sistem fara corespondent rezidential (intrebarea
 * 15 din .claude/stare.md): a venit doar pe industrial, deci pretul lui vine
 * mereu din lista INDUSTRIALA, indiferent de restul pozitiei. Nu e o alegere
 * de segment — e singura lista care exista pentru el.
 */
export type SistemRezidential = Exclude<SistemMatrice, "tabla_inox">;

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
  /**
   * Segmentul ofertei. Implicit rezidential — asa se tarifa inainte sa existe
   * listele industriale, si asa raman reproductibile ofertele istorice din
   * suita de referinta. Un strat al carui sistem n-are lista pe segmentul
   * cerut se tarifeaza din singura care exista, cu nota pe rezultat.
   */
  destinatie?: import("./lists.js").Destinatie;
}

export interface StratTarifat {
  sistem: Sistem;
  grosime_mm: number | null;
  /** Diametrul geometric la care ajunge stratul, inainte de potrivire pe rand. */
  diametru_geometric: number;
  /** Randul efectiv folosit din matricea de preturi. */
  rand_lista: number;
  /**
   * Pretul BRUT al stratului (rotunjit la 2 zecimale), inainte de propriul
   * multiplicator. 0 cand `inclus` e fals — stratul nu s-a mai cautat in
   * matrice, deci n-are pret de raportat.
   */
  pret_unitar: number;
  /**
   * Multiplicatorul PROPRIU al acestui strat pentru forma ceruta. 0 cand
   * `inclus` e fals — nu exista un coeficient definit, deci nu e un numar
   * cu sens, doar un loc gol.
   */
  multiplicator: number;
  /**
   * Fals cand sistemul stratului n-are coeficient de forma pe banda lui
   * (ex: vata cot/teu pe banda 18-60). Stratul contribuie totusi cu
   * GEOMETRIA lui — randul si grosimea — la diametrul stratului urmator,
   * dar nu intra in pret. Vezi Oferta 284 (9/9 potriviri exacte), intrebarea 9.
   */
  inclus: boolean;
}

export interface RezultatTarifare {
  straturi: StratTarifat[];
  /** Pretul pe unitate, suma straturilor INCLUSE, fiecare cu multiplicatorul lui propriu. */
  pret_unitar: number;
  /** Multiplicatorul primului strat INCLUS (nu neaparat straturi[0] — acela poate fi exclus). */
  multiplicator: number;
  cantitate: number;
  total: number;
  moneda: "EUR";
  /**
   * Note VIZIBILE pe pozitie, nu erori — de exemplu ca un strat a fost
   * tarifat dintr-o lista de alta destinatie decat restul (tabla_inox, care
   * n-are lista rezidentiala). Pretul e corect si complet; nota e doar
   * informatie pentru omul care valideaza oferta.
   */
  note?: string[];
  /**
   * Subsetul de note care CER ochi de om. Restul sunt informative.
   *
   * Distinctia a aparut cand firma a confirmat regula "cot/teu de vata sub
   * o60 nu intra in pret" (11 septembrie 2026): nota ramane, fiindca explica
   * de ce pretul e ce e, dar nu mai are rost sa opreasca 47 de randuri la
   * validare. O regula confirmata nu mai e o presupunere.
   */
  noteDeVerificat?: string[];
  /**
   * Aceleasi note de verificat, ca valori pe care ecranul le poate numara si
   * scrie in cuvinte simple. Textul din `noteDeVerificat` ramane pentru
   * registru si pentru cine vrea detaliul.
   */
  motiveDeVerificat?: MotivVerificare[];
}

/** De ce o pozitie cu pret trebuie totusi vazuta de om. */
export type MotivVerificare =
  /** Un strat vine din lista altui segment decat cel ales la import. */
  | "segment_diferit"
  /** Primul strat e la 1 mm peste un rand; ofertele au folosit ambele randuri. */
  | "rotunjire_neconfirmata"
  /** Grosimea e cea uzuala a firmei, nu scrisa de client. */
  | "grosime_propusa"
  /** Descrierea s-a schimbat dupa ce omul verificase pozitia: e recitita din textul nou. */
  | "descriere_schimbata"
  /** UM-ul spune ml/mp, textul spune cot/teu/...; cele doua forme dau preturi diferite. */
  | "forma_contrazisa"
  /** Celula ø × grosime lipseste din lista; pretul e dedus proportional din randul urmator. */
  | "celula_dedusa"
  /** Diametru peste ultimul rand: pret din formula firmei pe mp, nu din matrice. */
  | "peste_lista";

/**
 * De ce nu s-a putut tarifa o pozitie, ca valoare STABILA.
 *
 * `motiv` ramane textul citit de om si nu se schimba — e bun si e afisat azi
 * in CLI si pe ecran. Ce lipsea era o cheie pe care se poate GRUPA: masurat pe
 * cele 10 fisiere reale, 130 de pozitii netarifate au 5 cauze, iar 64 dintre
 * ele sunt un singur raspuns nevenit de la firma (intrebarea 9). Cu `motiv`
 * text liber, gruparea aia n-are pe ce sa se faca: doua mesaje identice ca
 * sens dar diferite ca formulare ar cadea in gramezi separate, iar o
 * reformulare de mesaj ar rupe tacit ecranul. Codul e contractul; mesajul
 * ramane proza.
 */
export type CodNetarifare =
  /* --- matrice o x grosime (src/pricing/engine.ts) --- */
  | "grosime_inexistenta"      // combinatia diametru/grosime nu exista in lista
  | "grosime_ambigua"          // sistemul are mai multe grosimi la randul ala
  | "peste_maximul_listei"
  | "fara_coeficient_de_forma" // niciun strat n-are coeficient pe banda lui
  | "banda_inexistenta"        // diametrul nu cade in nicio banda de multiplicatori
  | "lista_goala"
  | "pozitie_fara_straturi"
  | "fara_pret_pe_mp"
  /* --- inchideri goluri la foc (src/pricing/goluri-foc.ts) --- */
  | "gol_fara_dimensiuni"
  | "gol_dimensiuni_invalide"
  | "banda_wrap_inexistenta"
  | "colier_inexistent"
  | "diametru_conducta_lipsa"
  | "material_conducta_lipsa"
  /* --- rutare gresita intre cele doua forme de pret --- */
  | "gol_foc_in_matrice"
  /* --- sistemul e cunoscut, dar nu se poate cauta pe nimic --- */
  | "fara_diametru"
  /* --- din DiametruNecunoscut, mapat in tarifeazaExtras --- */
  | "dn_necunoscut"
  /* --- alta lucrare decat cea din liste --- */
  | "protectie_foc_tubulatura";

export class PozitieNetarifata extends Error {
  constructor(
    readonly cod: CodNetarifare,
    readonly motiv: string,
    readonly context: Record<string, unknown>,
  ) {
    super(motiv);
    this.name = "PozitieNetarifata";
  }
}

/* ------------------------------------------------------------------ *
 * Inchideri goluri la foc
 *
 * Termenii sunt ai firmei, luati din "pret-rezidential-goluri-foc.xlsx"
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
  /**
   * Segmentul ofertei. Inchiderile la foc au lista doar pe rezidential, deci
   * pretul vine de acolo oricum; pe alt segment rezultatul poarta nota, ca la
   * straturile din `tarifeaza` (intrebarea 14).
   */
  destinatie?: import("./lists.js").Destinatie;
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
  /** Aceeasi semnificatie ca pe `RezultatTarifare`. */
  note?: string[];
  noteDeVerificat?: string[];
  motiveDeVerificat?: MotivVerificare[];
}

import elastomer from "../../data/price-lists/elastomer.json" with { type: "json" };
import vata_minerala from "../../data/price-lists/vata_minerala.json" with { type: "json" };
import tabla from "../../data/price-lists/tabla.json" with { type: "json" };
import pvc from "../../data/price-lists/pvc.json" with { type: "json" };
import goluri_foc from "../../data/price-lists/goluri_foc.json" with { type: "json" };
// Tabla de inox n-are lista rezidentiala (vezi SistemRezidential): singura
// care exista e cea industriala, importata static aici la fel ca celelalte —
// modulul trebuie sa ruleze identic in Node si in browser, deci nu se citeste
// cu fs. Nu intra in `catalogDinFisiere()`/`Catalog.matrice`, care raman pe
// destinatia rezidentiala; e disponibila doar prin `lista("tabla_inox")`.
import tabla_inox from "../../data/price-lists/industrial/tabla_inox.json" with { type: "json" };
// Celelalte trei liste industriale. Importate ca sa poata fi CITITE — ecranul
// de liste le arata pe destinatii — nu ca sa fie aplicate: `lista()` si, prin
// ea, `tarifeaza` raman pe rezidential. Vezi `PE_DESTINATIE`.
import elastomer_industrial from "../../data/price-lists/industrial/elastomer.json" with { type: "json" };
import vata_minerala_industrial from "../../data/price-lists/industrial/vata_minerala.json" with { type: "json" };
import tabla_industrial from "../../data/price-lists/industrial/tabla.json" with { type: "json" };
import type { MaterialConducta, Sistem, SistemMatrice, SistemRezidential } from "./types.js";

export interface BandaMultiplicator {
  band: [number, number];
  ml: number;
  manseta?: number | null;
  cot_teu_reductie?: number | null;
  robinet_vana_flansa_contor?: number | null;
  pompa_filtru_distribuitor?: number | null;
  flansa_robinet_contor_distribuitor?: number | null;
  pompa_filtru_vana23?: number | null;
}

export interface ListaPreturi {
  sistem: SistemMatrice;
  denumire: string;
  contine: string;
  moneda: "EUR";
  grosimi_mm: number[];
  /** Cheie "diametru|grosime". Matricea e RARA: lipsa = nu se oferteaza. */
  cells: Record<string, number>;
  per_mp: Record<string, number>;
  multiplicatori: BandaMultiplicator[];
}

/**
 * Listele sunt importate static, nu citite de pe disc: modulul de tarifare
 * trebuie sa ruleze identic in Node si in browser. Demo-ul de pe GitHub Pages
 * ruleaza exact acest cod, fara backend.
 */
const LISTE = { elastomer, vata_minerala, tabla, pvc, tabla_inox } as unknown as Record<SistemMatrice, ListaPreturi>;

/**
 * Lista unui sistem tarifat din matrice ø × grosime.
 *
 * `goluri_foc` NU e printre ele si nici nu poate fi cerut aici: lista lui are
 * alta forma (praguri de suprafata + doua tabele de banda + coliere), iar
 * tipul trebuie sa spuna asta. Pentru ea exista `listaGoluriFoc`.
 *
 * `tabla_inox` merge prin acelasi accesor ca restul, desi lista lui e
 * industriala: cine cheama `lista()` cere un pret pe sistem, nu pe destinatie.
 */
export function lista(sistem: SistemMatrice): ListaPreturi {
  const l = LISTE[sistem];
  if (!l) throw new Error(`lista de preturi lipseste: ${sistem}`);
  return l;
}

/**
 * Sistemele care NU au lista de preturi rezidentiala: pretul lor vine mereu
 * din lista industriala, indiferent de restul pozitiei. Azi doar tabla de
 * inox (intrebarea 15 din .claude/stare.md). Folosit ca sa se ataseze o nota
 * vizibila de destinatie mixta pe pozitiile care il folosesc — vezi
 * `tarifeazaExtras` din src/import/nucleu.ts.
 */
export const SISTEME_FARA_REZIDENTIAL: ReadonlySet<string> = new Set(["tabla_inox"]);

export interface PragGol {
  /** Limita SUPERIOARA a pragului, inclusiva: "Goluri pana la 0,05 mp". */
  pana_la_mp: number;
  pret_buc: number;
}

export interface IntrareBandaWrap {
  diametru: number;
  pret: number;
  /** Textul din coloana "Observatii": "3 infasurari/conducta". */
  obs: string;
}

export interface IntrareColier {
  diametru: number;
  pret_urcare_1colier: number;
  pret_orizontal_2coliere: number;
}

export interface ListaGoluriFoc {
  sistem: "goluri_foc";
  denumire: string;
  contine: string;
  moneda: "EUR";
  regula: string;
  praguri_suprafata: PragGol[];
  /** "Goluri mai mari de 1,00 mp": 134,43 EUR / mp. */
  peste_1mp_pret_pe_mp: number;
  /** Doua tabele distincte, dupa materialul conductei. Vezi MaterialConducta. */
  banda_wrap: Record<MaterialConducta, IntrareBandaWrap[]>;
  colier_promastop: IntrareColier[];
}

/** Lista de inchideri goluri la foc. Alta structura, deci alt accesor. */
export const listaGoluriFoc = (): ListaGoluriFoc => goluri_foc as unknown as ListaGoluriFoc;

export type Destinatie = "rezidential" | "industrial" | "rafinarie";

/**
 * Inventarul: ce lista EXISTA pe fiecare destinatie.
 *
 * E un inventar, nu un drum de tarifare. `tarifeaza` merge in continuare prin
 * `lista()`, adica pe rezidential (plus tabla de inox, care n-are alta
 * varianta). Cat timp regula dupa care se alege destinatia nu e raspunsa —
 * intrebarea 12 din `.claude/stare.md` — industrialele se pot CITI, nu si
 * aplica: un motor care ar alege singur segmentul ar ofert cu preturi de
 * industrial o lucrare rezidentiala, fara ca nimeni sa fi cerut asta.
 *
 * Rafinaria e listata anume, goala: absenta ei e o informatie — s-a cerut si
 * nu a venit — nu un rand care lipseste din tabel.
 */
const PE_DESTINATIE = {
  rezidential: { elastomer, vata_minerala, tabla, pvc },
  industrial: {
    elastomer: elastomer_industrial,
    vata_minerala: vata_minerala_industrial,
    tabla: tabla_industrial,
    tabla_inox,
  },
  rafinarie: {},
} as unknown as Record<Destinatie, Partial<Record<SistemMatrice, ListaPreturi>>>;

export const DESTINATII: readonly Destinatie[] = ["rezidential", "industrial", "rafinarie"];

/** Sistemele care au lista pe destinatia data, in ordinea din inventar. */
export const sistemePe = (d: Destinatie): SistemMatrice[] =>
  Object.keys(PE_DESTINATIE[d]) as SistemMatrice[];

/**
 * Inventarul complet al unei destinatii, inclusiv ce nu e matrice ø × grosime.
 *
 * Inchiderile goluri la foc au pret aditiv si accesor propriu
 * (`listaGoluriFoc`), deci nu incap in `PE_DESTINATIE`, care tine liste de
 * matrice. Dar pentru cine intreaba „ce liste am pe rezidential?" sunt o lista
 * ca oricare alta — si lipsa lor din raspuns ar fi un fals.
 */
export const inventarPe = (d: Destinatie): Sistem[] =>
  d === "rezidential" ? [...sistemePe(d), "goluri_foc"] : sistemePe(d);

/** Lista unui sistem pe o destinatie anume, sau `undefined` daca nu exista. */
export const listaPe = (sistem: SistemMatrice, d: Destinatie): ListaPreturi | undefined =>
  PE_DESTINATIE[d][sistem];

/**
 * Lista pe care se TARIFEAZA un strat, pe segmentul cerut.
 *
 * Cand segmentul ales n-are lista sistemului, se cade pe singura care exista
 * si se spune care e — nu se refuza tarifarea si nu se tace. Cazurile reale
 * sunt asimetrice in ambele sensuri: tabla de inox exista doar industrial, PVC
 * si inchiderile la foc doar rezidential. O pozitie industriala cu jacheta de
 * PVC trebuie sa iasa cu pret, dar cu nota ca acel strat vine din alt segment;
 * altfel omul ar vedea "netarifat" pentru un material care are pret.
 */
export function listaDe(
  sistem: SistemMatrice,
  dest: Destinatie,
): { lista: ListaPreturi; folosita: Destinatie } {
  const ceruta = PE_DESTINATIE[dest][sistem];
  if (ceruta) return { lista: ceruta, folosita: dest };
  for (const d of DESTINATII) {
    const alta = PE_DESTINATIE[d][sistem];
    if (alta) return { lista: alta, folosita: d };
  }
  throw new Error(`lista de preturi lipseste: ${sistem}`);
}

/** Grosimile ofertate la un diametru dat, intr-o lista deja aleasa. */
export function grosimiLaDin(l: ListaPreturi, diametru: number): number[] {
  const out: number[] = [];
  for (const k of Object.keys(l.cells)) {
    const [d, g] = k.split("|");
    if (Number(d) === diametru && g !== "-") out.push(Number(g));
  }
  return out.sort((a, b) => a - b);
}

/** Diametrele dintr-o lista data, sortate crescator. */
export function diametreDin(l: ListaPreturi): number[] {
  const s = new Set<number>();
  for (const k of Object.keys(l.cells)) s.add(Number(k.split("|")[0]));
  return [...s].sort((a, b) => a - b);
}

/** Diametrele disponibile in lista, sortate crescator. */
export function diametre(sistem: SistemMatrice): number[] {
  return diametreDin(lista(sistem));
}

/** Grosimile ofertate la un diametru dat (tabla are una singura per diametru). */
export function grosimiLa(sistem: SistemMatrice, diametru: number): number[] {
  return grosimiLaDin(lista(sistem), diametru);
}

/**
 * Toate listele unui tarifator, la un moment dat.
 *
 * Exista doua surse care produc EXACT aceeasi forma:
 *   - `catalogDinFisiere()`, de aici — pentru teste, CLI si demo-ul static
 *   - `catalogDinBaza()`, din src/db/repo-preturi.ts — pentru server
 *
 * Echivalenta lor e verificata in tests/db.test.ts. Atat timp cat trece,
 * motorul nu are nevoie sa stie de unde vin preturile.
 */
export interface Catalog {
  /**
   * Ramane pe destinatia REZIDENTIALA, nu pe toate cele din SistemMatrice.
   *
   * `seed.ts` insereaza continutul lui `catalogDinFisiere()` cu
   * `destinatie: "rezidential"`; daca tabla_inox ar intra aici, baza ar minti
   * despre destinatia lui. Lista lui industriala intra separat, prin
   * `listeIndustriale()` din seed.ts.
   */
  matrice: Record<SistemRezidential, ListaPreturi>;
  goluriFoc: ListaGoluriFoc;
}

/**
 * Catalogul din fisierele commit-uite in data/price-lists/.
 *
 * Sursa asta ramane pentru teste, pentru CLI si pentru demo-ul care ruleaza
 * fara server. Un server multi-tenant NU o foloseste: acolo listele vin din
 * baza, per tenant. Intoarce exact aceleasi 4 liste ca inainte de tabla_inox —
 * vezi comentariul de pe `Catalog.matrice`.
 */
export const catalogDinFisiere = (): Catalog => ({
  matrice: { elastomer, vata_minerala, tabla, pvc } as unknown as Record<SistemRezidential, ListaPreturi>,
  goluriFoc: goluri_foc as unknown as ListaGoluriFoc,
});

import type { CodAvertisment, CodNetarifare, LinieProcesata } from "../../src/import/nucleu.js";
import type { LinieExtrasa } from "../../src/import/schema.js";
import type { MotivVerificare } from "../../src/pricing/types.js";
import { potrivit } from "../validare.js";

/**
 * Cuvintele ecranului de import, pentru oameni care nu lucreaza cu termenii
 * nostri.
 *
 * Ecranul il folosesc oameni de la birou si de pe santier, nu programatori:
 * „sistem", „grosime ambigua", „coeficient pe banda" sau „ø" fara unitate nu
 * le spun nimic. Aici sta traducerea, pura si testata, ca randarea sa nu
 * inventeze etichete pe loc — si ca niciun cod intern sa nu ajunga pe ecran.
 * Registrul de oferta pastreaza etichetele lungi din `web/validare.ts`.
 */

export type Sistem = NonNullable<LinieExtrasa["sistem"]>;

export const MATERIAL: Record<Sistem, string> = {
  elastomer: "Elastomer",
  vata_minerala: "Vată minerală",
  tabla: "Tablă aluminiu",
  tabla_inox: "Tablă inox",
  pvc: "PVC",
  goluri_foc: "Închidere gol la foc",
};

/** Ordinea din lista de materiale a editorului: cele frecvente intai. */
export const MATERIALE: Sistem[] = ["vata_minerala", "elastomer", "tabla", "tabla_inox", "pvc", "goluri_foc"];

/** Grosimile ofertate, ca sugestii in editor. Tabla si PVC-ul n-au grosime de ales. */
export const GROSIMI: Partial<Record<Sistem, number[]>> = {
  elastomer: [9, 13, 19, 25, 32],
  vata_minerala: [20, 30, 40, 50, 60, 80, 100],
};

type Forma = NonNullable<LinieExtrasa["forma"]>;
/** Forma se scrie doar cand nu e metrul liniar obisnuit. */
const FORMA: Partial<Record<Forma, string>> = {
  mp: "pe m²", manseta: "manșetă", cot: "cot", teu: "teu", reductie: "reducție",
  robinet: "robinet", vana: "vană", flansa: "flanșă", contor: "contor",
  compensator: "compensator", pompa: "pompă", filtru: "filtru",
  distribuitor: "distribuitor", schimbator: "schimbător",
};

/** `DN100`, `Ø160`, `Di60` — cum il scrie si clientul. */
export function diametruText(e: Pick<LinieExtrasa, "diametru_valoare" | "diametru_tip">): string | null {
  if (e.diametru_valoare === null) return null;
  const v = String(e.diametru_valoare).replace(".", ",");
  if (e.diametru_tip === "DN") return `DN${v}`;
  if (e.diametru_tip === "interior") return `Di${v}`;
  return `Ø${v}`;
}

const mm = (g: number | null): string => (g === null ? "" : ` ${String(g).replace(".", ",")} mm`);

/**
 * Ce a inteles aplicatia din rand, ca etichete scurte:
 * „Vată minerală 50 mm", „+ Tablă aluminiu", „DN100", „flanșă".
 */
export function inteles(e: LinieExtrasa): string[] {
  if (e.sistem === null) return [];
  if (e.sistem === "goluri_foc") {
    return [MATERIAL.goluri_foc,
      ...(e.gol_latime_mm !== null && e.gol_inaltime_mm !== null ? [`gol ${e.gol_latime_mm}×${e.gol_inaltime_mm} mm`] : [])];
  }
  const d = diametruText(e);
  const forma = e.forma ? FORMA[e.forma] : undefined;
  return [
    `${MATERIAL[e.sistem]}${mm(e.grosime_mm)}`,
    ...e.straturi_extra.map((s) => `+ ${MATERIAL[s.sistem]}${mm(s.grosime_mm)}`),
    ...(d ? [d] : []),
    ...(forma ? [forma] : []),
  ];
}

export type Stare = "gata" | "de_validat" | "netarifate";

/** Starea unei pozitii, pe aceleasi gramezi ca registrul (`imparte`). */
export function stareLinie(l: LinieProcesata): Stare {
  if (potrivit(l, "gata")) return "gata";
  if (potrivit(l, "de_validat")) return "de_validat";
  return "netarifate";
}

export const STARE: Record<Stare, string> = {
  gata: "Gata",
  de_validat: "De verificat",
  netarifate: "Fără preț",
};

/** Orice motiv pentru care o pozitie nu e gata. */
export type CodMotiv = CodNetarifare | CodAvertisment | MotivVerificare | "citit_nesigur" | "pret_necunoscut";

/**
 * Motivul, in cuvintele omului. Scurt: sta pe un card, langa pret. Detaliul
 * tehnic ramane in registru si in `title`.
 */
export const MOTIV: Record<CodMotiv, string> = {
  grosime_ambigua: "Lipsește grosimea",
  grosime_inexistenta: "Grosimea nu e în lista de prețuri",
  peste_maximul_listei: "Diametru mai mare decât lista de prețuri",
  dn_necunoscut: "DN necunoscut",
  fara_diametru: "Lipsește diametrul",
  fara_coeficient_de_forma: "Piesa nu are preț în listă",
  banda_inexistenta: "Diametrul nu e în lista de prețuri",
  lista_goala: "Lista de prețuri e goală",
  pozitie_fara_straturi: "Lipsește materialul",
  fara_pret_pe_mp: "Nu există preț pe m² pentru grosimea asta",
  gol_fara_dimensiuni: "Lipsesc dimensiunile golului",
  gol_dimensiuni_invalide: "Dimensiunile golului sunt greșite",
  banda_wrap_inexistenta: "Banda WRAP nu are preț la diametrul ăsta",
  colier_inexistent: "Colierul nu are preț la diametrul ăsta",
  diametru_conducta_lipsa: "Lipsește diametrul conductei",
  material_conducta_lipsa: "Lipsește materialul conductei",
  gol_foc_in_matrice: "Închiderea de gol a fost citită greșit",
  notatie_contrazice_materialul: "Verifică diametrul",
  diametru_contrazis: "Verifică diametrul: DN și Ø diferite",
  diametru_necitat: "Diametrul nu apare în text",
  grosime_necitata: "Grosimea nu apare în text",
  gol_necitat: "Dimensiunea golului nu apare în text",
  grosime_in_afara_listei: "Grosime neobișnuită pentru material",
  forma_contrazice_um: "Unitatea de măsură nu se potrivește",
  segment_diferit: "Preț din lista celuilalt tip de ofertă",
  rotunjire_neconfirmata: "Diametru între două rânduri din listă",
  grosime_propusa: "Grosime propusă, nu scrisă de client",
  citit_nesigur: "Citit nesigur din text",
  pret_necunoscut: "Prețul nu s-a putut calcula",
};

/** De ce nu e gata pozitia. Gol pentru una gata. */
export function motiveLinie(l: LinieProcesata): CodMotiv[] {
  const stare = stareLinie(l);
  if (stare === "gata") return [];
  if (stare === "netarifate") return [l.codEroare ?? "pret_necunoscut"];
  const coduri: CodMotiv[] = [
    ...(l.avertismente ?? []).map((a) => a.cod),
    ...(l.pret?.motiveDeVerificat ?? []),
  ];
  return coduri.length > 0 ? [...new Set(coduri)] : ["citit_nesigur"];
}

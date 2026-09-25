import type { CodAvertisment, CodNetarifare, LinieProcesata } from "../../src/import/nucleu.js";
import type { LinieExtrasa } from "../../src/import/schema.js";
import { DN_TO_OD } from "../../src/pricing/dn-table.js";
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

/**
 * Grosimile ofertate, ca sugestii in editor. La tabla sunt zecimale si conteaza
 * mai ales la inox, unde lista are toate trei la fiecare rand (intrebarea 15):
 * fara ele, pozitia de inox nu se putea tarifa din ecran. PVC-ul n-are grosime.
 */
export const GROSIMI: Partial<Record<Sistem, number[]>> = {
  elastomer: [9, 13, 19, 25, 32],
  vata_minerala: [20, 30, 40, 50, 60, 80, 100],
  tabla: [0.6, 0.8, 1],
  tabla_inox: [0.4, 0.5, 0.6],
};

type Forma = NonNullable<LinieExtrasa["forma"]>;
/** Forma se scrie doar cand nu e metrul liniar obisnuit. */
const FORMA: Partial<Record<Forma, string>> = {
  mp: "pe m²", manseta: "manșetă", cot: "cot", teu: "teu", reductie: "reducție",
  robinet: "robinet", vana: "vană", flansa: "flanșă", contor: "contor",
  compensator: "compensator", pompa: "pompă", filtru: "filtru",
  distribuitor: "distribuitor", schimbator: "schimbător",
};

/** Formele, in ordinea din editor: metrul liniar intai, apoi piesele frecvente. */
export const FORME_EDITOR: [Forma, string][] = [
  ["ml", "metru liniar"], ["mp", "m²"], ["cot", "cot"], ["teu", "teu"], ["reductie", "reducție"],
  ["manseta", "manșetă"], ["flansa", "flanșă"], ["robinet", "robinet"], ["vana", "vană"],
  ["contor", "contor"], ["compensator", "compensator"], ["pompa", "pompă"], ["filtru", "filtru"],
  ["distribuitor", "distribuitor"], ["schimbator", "schimbător"],
];

/** Zecimale cu virgula, ca in Romania. */
const numarRo = (v: number): string => String(v).replace(".", ",");

/** `DN100`, `Ø160`, `Di60` — cum il scrie si clientul. */
export function diametruText(e: Pick<LinieExtrasa, "diametru_valoare" | "diametru_tip">): string | null {
  if (e.diametru_valoare === null) return null;
  const v = numarRo(e.diametru_valoare);
  if (e.diametru_tip === "DN") return `DN${v}`;
  if (e.diametru_tip === "interior") return `Di${v}`;
  return `Ø${v}`;
}

/**
 * Diametrul exterior in care motorul traduce notatia clientului: DN100 → 114,3.
 * `null` cand DN-ul nu e in tabelul de conversie (atunci pozitia oricum n-are
 * pret, cu `dn_necunoscut`).
 */
export function diametruExterior(e: Pick<LinieExtrasa, "diametru_valoare" | "diametru_tip">): number | null {
  if (e.diametru_valoare === null) return null;
  if (e.diametru_tip !== "DN") return e.diametru_valoare;
  return DN_TO_OD[e.diametru_valoare] ?? null;
}

/**
 * `DN100 = ø114,3` — ce a scris clientul si ce cauta motorul cu asta.
 *
 * Ecranul arata pana acum doar notatia clientului, deci conversia nu se putea
 * verifica din ochi: „DN100" si „Ø100" se citeau la fel de pe ecran, desi unul
 * e ø114,3 si celalalt ø100, adica alt rand din lista si alt pret. La Ø si Di
 * nu se adauga nimic — acolo cifra scrisa E diametrul cautat.
 */
export function diametruCuConversie(e: Pick<LinieExtrasa, "diametru_valoare" | "diametru_tip">): string | null {
  const scris = diametruText(e);
  if (scris === null || e.diametru_tip !== "DN") return scris;
  const od = diametruExterior(e);
  return od === null ? `${scris} — nu e în tabel` : `${scris} = ø${numarRo(od)}`;
}

const mm = (g: number | null): string => (g === null ? "" : ` ${String(g).replace(".", ",")} mm`);

/**
 * Ce a inteles aplicatia din rand, ca etichete scurte: „Vată minerală 50 mm ·
 * rândul 114", „+ Tablă aluminiu · rândul 220", „DN100 = ø114,3", „flanșă".
 *
 * Randul din lista vine din pretul deja calculat, cate unul per strat, in
 * aceeasi ordine. E singurul loc din care omul poate verifica unde a cazut
 * conversia — intre DN100 si randul 114 stau doua reguli (tabelul de conversie
 * si potrivirea pe rand), iar pana acum niciuna nu se vedea.
 */
export function inteles(e: LinieExtrasa, pret?: LinieProcesata["pret"]): string[] {
  if (e.sistem === null) return [];
  if (e.sistem === "goluri_foc") {
    return [MATERIAL.goluri_foc,
      ...(e.gol_latime_mm !== null && e.gol_inaltime_mm !== null ? [`gol ${e.gol_latime_mm}×${e.gol_inaltime_mm} mm`] : [])];
  }
  if (pret && "manual" in pret && pret.manual) {
    return [`${MATERIAL[e.sistem]}${mm(e.grosime_mm)}`, "preț pus de mână"];
  }
  const d = diametruCuConversie(e);
  const forma = e.forma ? FORMA[e.forma] : undefined;
  const straturi = pret && "straturi" in pret ? pret.straturi : [];
  const peRand = (k: number): string => {
    const s = straturi[k];
    if (!s) return "";
    return s.rand_lista > 0 ? ` · rândul ${numarRo(s.rand_lista)}` : " · pe mp";
  };
  return [
    `${MATERIAL[e.sistem]}${mm(e.grosime_mm)}${peRand(0)}`,
    ...e.straturi_extra.map((s, k) => `+ ${MATERIAL[s.sistem]}${mm(s.grosime_mm)}${peRand(k + 1)}`),
    ...(d ? [d] : []),
    ...(forma ? [forma] : []),
  ];
}

/**
 * Rândul de sub câmpul de diametru din editor: în ce diametru exterior se
 * traduce ce scrie acolo și pe ce rând din listă a căzut prețul.
 */
export function ajutorDiametru(l: LinieProcesata): string {
  const e = l.extras;
  if (e.sistem === "goluri_foc" || e.diametru_valoare === null) return "";
  const od = diametruExterior(e);
  if (od === null) return `DN${numarRo(e.diametru_valoare)} nu e în tabelul de conversie`;
  const rand = l.pret && "straturi" in l.pret ? l.pret.straturi[0]?.rand_lista : undefined;
  const conversie = e.diametru_tip === "DN" ? `ø${numarRo(od)} după tabelul de conversie` : `ø${numarRo(od)}`;
  return rand === undefined ? conversie : `${conversie} · rândul ${numarRo(rand)} din listă`;
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
  protectie_foc_tubulatura: "Protecție la foc a tubulaturii: fără listă de prețuri",
  livrare_teava: "Livrare de țeavă cu izolație inclusă: preț de pus manual",
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
  diametru_nenotat: "Verifică diametrul: alt număr de pe rând",
  strat_necitat: "Verifică straturile: jachetă nescrisă în text",
  grosime_interval: "Grosimea e un interval: alege una",
  grosime_necitata: "Grosimea nu apare în text",
  gol_necitat: "Dimensiunea golului nu apare în text",
  grosime_in_afara_listei: "Grosime neobișnuită pentru material",
  forma_contrazice_um: "Unitatea de măsură nu se potrivește",
  segment_diferit: "Preț din lista celuilalt tip de ofertă",
  rotunjire_neconfirmata: "Diametru între două rânduri din listă",
  grosime_propusa: "Grosime propusă, nu scrisă de client",
  descriere_schimbata: "Descrierea s-a schimbat după verificare",
  forma_contrazisa: "Textul spune altă formă decât unitatea de măsură",
  celula_dedusa: "Preț calculat: combinația lipsește din listă",
  peste_lista: "Diametru peste listă: preț din formula pe mp",
  um_bucata: "Cantitate în bucăți, preț pe metru liniar",
  serie_cupru: "Țeavă de cupru: DN după seria cuprului",
  serie_inox: "Țeavă de inox: seria diametrelor neconfirmată",
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

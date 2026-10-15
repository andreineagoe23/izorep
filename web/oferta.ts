import type { LinieProcesata } from "../src/import/nucleu.js";
import { bani } from "../src/pricing/engine.js";
import { ADAOS_FOC_INDUSTRIAL } from "../src/pricing/goluri-foc.js";
import type { PlanSantier } from "../src/lucrari/situatii.js";
import { amprenta } from "../src/lucrari/amprenta.js";

/**
 * Oferta: antetul, împărțirea pozițiilor, totalurile și planul de șantier.
 *
 * Pur, fără DOM, ca motorul: se testează în Node. Documentul ofertei (capitole,
 * numerotare, specificație) e în `web/document-oferta.ts`, Excelul pentru
 * client în `web/registru-oferta.ts`; `Blob` și `<a download>` stau singure în
 * `web/descarca.ts`.
 */

/** Antetul ofertei: ce completează omul înainte de descărcare. */
export interface AntetOferta {
  /** Seria firmei emitente (`RAD`, `ISO`) — din `FIRME`, `web/date/firme.ts`. */
  serie: string;
  numar: string;
  /** Data ofertei, scrisă cum apare în document: `27.05.2026`. */
  data: string;
  /** Persoana de contact: „In atentia d-lui …". */
  persoana: string;
  client: string;
  obiectiv: string;
  /** Denumirea firmei emitente, cea din colțul de jos-dreapta. */
  firma: string;
  localitate: string;
  /**
   * Discountul comercial, în procente. Lipsă sau 0 = fără discount, iar atunci
   * registrul are un singur rând de total, ca înainte.
   *
   * Ofertele reale îl poartă: oferta 284 are `TOTAL LUCRARI = 94.575,063`,
   * `DISCOUNT 3 % = 2.837,25189` și `TOTAL GENERAL = 91.737,81111`. Fără el,
   * registrul nostru nu e trimisibil ca atare pe nicio lucrare negociată cu
   * discount — omul ar trebui să adauge rândurile de mână în Excel, adică
   * exact munca pe care exportul o scutește.
   *
   * Zecimalele de mai sus sunt din fișierul semnat și arată de ce trece totul
   * prin `bani()`: firma scrie azi cinci zecimale într-un document semnat.
   */
  discountProcent?: number;
  /** Condiția discountului, scrisă în paranteză după procent. */
  discountConditie?: string;
  /**
   * Ajustarea tehnicului, în procente, pe TOATE prețurile unitare: 10 = „crește
   * tot cu 10 %”, −5 = scade. Lipsă sau 0 = prețurile din liste, neatinse.
   * Spre deosebire de discount, clientul nu vede un rând separat: vede
   * prețurile unitare deja ajustate (`cuAjustare`).
   */
  ajustareProcent?: number;
}

/**
 * Proveniența, copiată în document — nu referențiată.
 *
 * Regula 3 din `.claude/arhitectura.md`: prețul se **copiază** în document,
 * altfel o ofertă de acum doi ani nu mai e reproductibilă. Aici e versiunea
 * minimă a aceleiași idei: peste un an, listele se vor fi schimbat, modelul va
 * fi altul, iar întrebarea „de unde a ieșit 13,74 pe rândul ăla?" trebuie să
 * aibă răspuns în fișierul însuși, nu într-o bază la care nimeni nu mai are
 * acces.
 */
export interface Provenienta {
  /** Momentul generării, ISO. */
  generatLa: string;
  /** Segmentul ales la import: listele din care s-au calculat chiar prețurile din registru. */
  destinatie: string;
  /** Snapshot-ul de model folosit la import, sau `null` pe calea deterministă. */
  model: string | null;
  /** `SesiuneImport.id` din `web/istoric.ts`: legătura cu importul care a produs oferta. */
  sesiune: string;
  fisierSursa: string;
}

export interface CerereOferta {
  linii: LinieProcesata[];
  antet: AntetOferta;
  provenienta: Provenienta;
}

/** Cele trei grămezi în care se împarte un import la ieșire. */
export interface ImpartireOferta {
  /** Au preț ȘI nu cer validare: doar astea intră în ofertă și în total. */
  oferta: LinieProcesata[];
  /** Au preț, dar sunt marcate. Prețul e o propunere, nu o ofertă. */
  deValidat: LinieProcesata[];
  /** N-au preț deloc. */
  netarifate: LinieProcesata[];
}

/**
 * Împarte pozițiile pe cele trei foi.
 *
 * Funcție separată și exportată pentru că e **regula**, nu formatare: ce are
 * voie să plece la client. Un rând marcat care s-ar strecura în foaia `Ofertă`
 * ar fi un preț nevalidat semnat de firmă.
 *
 * Rândurile care nu sunt poziții de izolație (antete, note, totaluri) nu intră
 * nicăieri: în oferta trimisă clientului n-au ce căuta, iar la „netarifate" ar
 * fi zgomot, nu o problemă de rezolvat — aceeași regulă ca la lentila
 * `netarifate` din `web/validare.ts`.
 */
export function imparte(linii: LinieProcesata[]): ImpartireOferta {
  const izo = linii.filter((l) => l.extras.sistem !== null);
  return {
    oferta: izo.filter((l) => l.pret && !l.necesitaValidare),
    deValidat: izo.filter((l) => l.pret && l.necesitaValidare),
    netarifate: izo.filter((l) => !l.pret),
  };
}

/**
 * Valoarea unei linii ca în ofertele firmei: preț unitar × cantitate, EXACT,
 * nerotunjit la bani. Oferta 284 are 5,6 ml × 25,68 = `143.808` în celulă,
 * afișat 143,81 — iar totalul documentului e suma valorilor exacte.
 *
 * Plafonat la 4 zecimale: produsul unui preț cu 2 zecimale și al unei
 * cantități cu cel mult 2 e exact acolo, iar restul e zgomot de float
 * (`2323.0899999999997` din aceeași ofertă).
 */
export const valoareLinie = (l: LinieProcesata): number =>
  l.pret ? Math.round(l.pret.pret_unitar * l.pret.cantitate * 10000) / 10000 : 0;

/**
 * Totalul ofertei, calculat cum îl calculează Excel-ul firmei: suma valorilor
 * exacte ale liniilor, rotunjită O SINGURĂ DATĂ, la final.
 *
 * Rotunjit pe fiecare linie și apoi adunat, Oferta 284 ieșea 94.575,07 în loc
 * de 94.575,06 semnat: șase linii au cantități cu zecimale (5,6 · 1,1 · 29,1 ·
 * 15,3 · 28,4 · 2,8 ml), iar fiecare rotunjire mută un sfert de ban.
 */
export const totalOferta = (linii: LinieProcesata[]): number =>
  bani(linii.reduce((s, l) => s + valoareLinie(l), 0));

/**
 * Ajustarea tehnicului pe toate prețurile: fiecare preț unitar × (1 + p/100),
 * rotunjit la bani, ca un preț din listă. Liniile se copiază; sesiunea de
 * import rămâne pe prețurile din liste, deci ajustarea se poate schimba oricând.
 */
/**
 * Linia cu denumirea scrisă de om pe ecranul ofertei (15 octombrie 2026).
 * Înlocuiește textul clientului în ofertă, în Excel și pe planul de șantier;
 * nu schimbă ce s-a citit din rând, deci nici prețul.
 */
export type LinieCuDenumire = LinieProcesata & { denumireOferta?: string };

export const denumireScrisa = (l: LinieProcesata): string | undefined =>
  (l as LinieCuDenumire).denumireOferta?.trim() || undefined;

/** Liniile cu denumirile scrise de om puse pe ele; restul rămân aceleași obiecte. */
export function cuDenumiri(linii: LinieProcesata[], denumiri: ReadonlyMap<number, string>): LinieProcesata[] {
  if (denumiri.size === 0) return linii;
  return linii.map((l) => {
    const d = denumiri.get(l.extras.index);
    return d ? ({ ...l, denumireOferta: d } as LinieCuDenumire) : l;
  });
}

export function cuAjustare(linii: LinieProcesata[], procent = 0): LinieProcesata[] {
  if (!procent) return linii;
  return linii.map((l) => {
    if (!l.pret) return l;
    const unitar = bani(l.pret.pret_unitar * (1 + procent / 100));
    return { ...l, pret: { ...l.pret, pret_unitar: unitar, total: bani(unitar * l.pret.cantitate) } } as LinieProcesata;
  });
}

/**
 * Adaosul închiderilor la foc pe o ofertă industrială: 20 % pe TOTALUL lor,
 * nu pe fiecare produs (regula firmei, 29 septembrie 2026). Pozițiile rămân
 * pe prețul din lista rezidențială; adaosul e un rând separat în ofertă.
 */
export function adaosFocIndustrial(oferta: LinieProcesata[], destinatie: string): number {
  if (destinatie !== "industrial") return 0;
  const foc = oferta.filter((l) => l.extras.sistem === "goluri_foc");
  return foc.length === 0 ? 0 : bani(totalOferta(foc) * ADAOS_FOC_INDUSTRIAL);
}

/** Totalul lucrărilor așa cum apare în ofertă: pozițiile plus adaosul de foc industrial. */
export const totalCuAdaos = (oferta: LinieProcesata[], destinatie: string): number =>
  bani(totalOferta(oferta) + adaosFocIndustrial(oferta, destinatie));

/**
 * Ce plătește clientul: după ajustarea tehnicului, adaosul de foc și discount.
 * Aceeași socoteală în pasul „Oferta” și pe server, care o refuză pe cea
 * trimisă dacă nu iese din liniile salvate.
 */
export function valoareOferta(c: CerereOferta): { valoare: number; pozitii: number } {
  const { oferta } = imparte(cuAjustare(c.linii, c.antet.ajustareProcent ?? 0));
  const brut = totalCuAdaos(oferta, c.provenienta.destinatie);
  return { valoare: bani(brut - bani(brut * (c.antet.discountProcent ?? 0) / 100)), pozitii: oferta.length };
}

/** Cantitatea de pe rând. Lipsa ei înseamnă „o bucată", ca la tarifare. */
const cantitatea = (l: LinieProcesata): number => l.bruta.cantitate ?? 1;

/** Textul poziției, pe un singur rând: descrierile din fișiere sunt multi-linie. */
/** Textele de pe rând, în ordinea coloanelor (`LinieBruta.text` le leagă cu „ | "). */
export const segmente = (l: LinieProcesata): string[] =>
  l.bruta.text.split(" | ").map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);

/**
 * Codul sau categoria clientului, când rândul începe cu una: „IZOLATII” în
 * cererea TRANSAVIA, „01.82.02.01A” în Oferta 27.04.2026. Doar majuscule,
 * cifre și punctuație de cod, scurt, fără diametru — „Teava OL/OLZN DN15”
 * (Matari) e descriere, nu cod.
 */
export function codRand(l: LinieProcesata): string | null {
  const s = segmente(l);
  if (s.length < 2) return null;
  const primul = s[0]!;
  return primul.length <= 20 && /^[A-ZĂÂÎȘȚŞŢ0-9][A-ZĂÂÎȘȚŞŢ0-9 .\-_/]*$/.test(primul) && !/\bDN\s*\d|[øØ]/.test(primul)
    ? primul : null;
}

/**
 * Coloana „Denumire”: textul rândului, fără codul care a plecat în
 * Identificare_Norma. Altfel, pe cererea TRANSAVIA, fiecare denumire ieșea
 * „IZOLATII | Caseta izolatie…”, iar oferta semnată are doar „Caseta izolatie…”.
 */
const denumirea = (l: LinieProcesata): string => {
  const scrisa = denumireScrisa(l);
  if (scrisa) return scrisa;
  const text = (codRand(l) ? segmente(l).slice(1) : segmente(l)).join(" | ");
  const g = l.extras.grosime_mm;
  // Grosimea pe care clientul n-a scris-o (luată de la conductă, sau cea uzuală
  // confirmată de om) trebuie să apară în ofertă: e ce se vinde. Oferta 284 a
  // rescris exact așa denumirile casetelor — „… DN100 vata minerala gr. 50 mm …”.
  if (g === null || l.extras.sistem === "goluri_foc" || scrieGrosimea(l.bruta.text, g)) return text;
  return `${text}, gr. ${String(g).replace(".", ",")} mm`;
};

/** Grosimea apare deja în textul clientului: „g50”, „gr. 50 mm”, „50 mm”, „50mm”. */
function scrieGrosimea(text: string, g: number): boolean {
  const n = String(g).replace(".", "[.,]");
  return new RegExp(`(?:\\bg|gr\\.?|grosime)\\s*${n}\\b|\\b${n}\\s*mm\\b`, "i").test(text);
}

/** `{ [cheie]: valoare }` doar când valoarea există (exactOptionalPropertyTypes). */
const optional = <K extends string, V>(cheie: K, v: V | null | undefined): { [P in K]?: V } =>
  (v === null || v === undefined || v === "" ? {} : { [cheie]: v }) as { [P in K]?: V };

/**
 * Planul de șantier din ofertă: exact pozițiile, cantitățile și prețurile care
 * pleacă în registrul `Ofertă` (aceeași împărțire, aceeași ajustare, aceeași
 * denumire), copiate. Situațiile de lucrări se fac pe el.
 */
export function planDinOferta(c: CerereOferta, id: string, sectiuni?: ReadonlyMap<number, string>): PlanSantier {
  const ajustare = c.antet.ajustareProcent ?? 0;
  const { oferta } = imparte(cuAjustare(c.linii, ajustare));
  return {
    id, creat: c.provenienta.generatLa,
    denumire: c.antet.obiectiv || c.antet.client || c.provenienta.fisierSursa,
    client: c.antet.client,
    firma: c.antet.firma,
    oferta: c.antet.numar ? `${c.antet.serie}${c.antet.numar} / ${c.antet.data}` : "",
    fisier: c.provenienta.fisierSursa,
    cerere: c.provenienta.sesiune,
    destinatie: c.provenienta.destinatie,
    ajustareProcent: ajustare,
    discountProcent: c.antet.discountProcent ?? 0,
    adaosFocProcent: c.provenienta.destinatie === "industrial" ? ADAOS_FOC_INDUSTRIAL * 100 : 0,
    pozitii: oferta.map((l, i) => ({
      nr: i + 1, denumire: denumirea(l), um: l.bruta.um ?? "", cantitate: cantitatea(l),
      pretUnitar: bani(l.pret!.pret_unitar), foc: l.extras.sistem === "goluri_foc",
      ...optional("amprenta", amprenta(l)),
      ...optional("zona", sectiuni?.get(l.bruta.index)),
    })),
    situatii: [],
  };
}

/**
 * Numele clientului, propus din numele fisierului importat.
 *
 * E o PROPUNERE, nu o deducere: campul ramane editabil, iar omul il corecteaza
 * intr-o secunda. Se scot extensia si zgomotul care apare in toate numele
 * reale — "Oferta", "Cerere oferta", data, si sufixele de copie `(1)` — pentru
 * ca `Oferta 27.04.2026 Matari.xlsx` sa propuna "Matari", nu tot sirul. Cand
 * nu ramane nimic, se propune numele intreg: mai bine ceva de sters decat un
 * camp gol pe care omul nu stie ce ar trebui sa contina.
 */
export function clientPropus(numeFisier: string): string {
  const fara = numeFisier
    .replace(/\.(xlsx|xls)$/i, "")
    // Fisierele facute de noi din lista de tevi sau din carnet: sufixul e al nostru, nu al clientului.
    .replace(/\s*-\s*(izolatie pe foaie|masuratori santier)\s*$/i, "")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b/g, " ")
    .replace(/[_-]+/g, " ")
    // „cerere de oferta 2", „oferta 118 1": cuvantul si numarul documentului, nu clientul.
    .replace(/\b(cerere\s+(de\s+)?)?oferta(\s+nr\.?)?(\s+\d+){0,2}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Numele scrise tot cu litere mici (`transavia-abur`) primesc majuscula la fiecare cuvant.
  if (fara && fara === fara.toLowerCase()) return fara.replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
  return fara || numeFisier.replace(/\.(xlsx|xls)$/i, "");
}

/** Data de azi, in forma in care o scriu ofertele firmei: `27.05.2026`. */
export function dataAzi(acum = new Date()): string {
  const dd = String(acum.getDate()).padStart(2, "0");
  const mm = String(acum.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${acum.getFullYear()}`;
}

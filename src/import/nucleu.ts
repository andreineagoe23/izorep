import { liniile, type FoaieBruta, type LinieBruta } from "./rand.js";
import type { Destinatie } from "../pricing/lists.js";
import { amprentaFoaie, aplicaCantitateDinAntet, aplicaMapare } from "./mapare.js";
// Type-only: precedentul e in mapari-statice.ts. `cache-mapari.ts` scrie pe
// disc cu `node:fs` — importat ca valoare aici, ar trage Node in bundle-ul de
// browser. Ca tip, dispare la compilare si nu ramane nimic in JS emis.
import type { MapareSalvata } from "./cache-mapari.js";
import { adaugaSectiuni, type LinieCuSectiune } from "./sectiuni.js";
import { aplicaContinuare } from "./continuare.js";
import {
  areIntervalDeGrosime, esteProtectieLaFocTubulatura, esteTeavaDeInox, extrageDeterminist, formaElementDinText,
  formaExplicitaDinText, grosimeProtectieFoc, grosimeScrisa, scrieGrosime, sistemScris,
} from "./extract-regex.js";
import {
  diametruContrazisDeText, notatieContraziceMaterialul, valideazaExtragere,
  type Avertisment, type CodAvertisment,
} from "./valideaza.js";
import { grupeazaPeSablon, extindePeSablon, type LinieSursa } from "./sabloane.js";
import { aplicaMemorie, type StocSabloane } from "./memorie.js";
import type { LinieExtrasa, Sursa } from "./schema.js";
import { bani, tarifeaza, tarifeazaPeMp } from "../pricing/engine.js";
import { diametreDin, listaDe } from "../pricing/lists.js";
import { grosimePropusa } from "../pricing/grosimi-uzuale.js";
import { tarifeazaGolFoc } from "../pricing/goluri-foc.js";
import {
  PozitieNetarifata,
  type CodNetarifare, type MotivVerificare, type RezultatGolFoc, type RezultatTarifare,
} from "../pricing/types.js";

export { esteProtectieLaFocTubulatura } from "./extract-regex.js";
import { DN_TO_OD, DN_TO_OD_CUPRU, DiametruNecunoscut, TOLERANTA_SERIE_OTEL, toOuterDiameter } from "../pricing/dn-table.js";

/**
 * Nucleul comun de import, IZOMORF: fara `node:*`, fara DOM.
 *
 * `pipeline.ts` (CLI, Node) si `web/ecrane/import.ts` (browser) fac amandoua
 * L0 -> L4 peste acelasi registru, dar pana acum ecranul REIMPLEMENTA L2a-L4 in
 * loc sa treaca prin `pipeline.ts` — care oricum nu putea fi importat direct
 * din browser, fiindca traga dupa el clientul OpenAI (`extract-llm.ts`) intr-un
 * bundle care nu trebuie sa vada cheia API. Din driftul asta au iesit trei
 * bug-uri masurate (vezi comentariile de la fiecare pas mai jos): guardrails
 * care nu rulau pe ecran, `modelFaraRaspuns` care nu se numara acolo, si
 * plafonul de linii trimise la model aplicat per apel in loc de per import.
 *
 * `pipeline.ts` ramane invelisul de Node: citeste fisierul, cache-ul de mapari
 * de pe disc si cheama modelul prin `extract-llm.ts`. Ecranul e invelisul de
 * browser: citeste fisierul din `File`/`ArrayBuffer`, ia maparile din bundle-ul
 * static (`mapari-statice.ts`) si cheama modelul prin `fetch` catre
 * serverul de dezvoltare. Tot ce e determinist — sectiuni, continuare, regex,
 * memorie, dedup pe sablon, guardrails, tarifare — sta o singura data aici.
 */

/**
 * Re-export pentru `web/`: `tests/structura.test.ts` interzice ecranelor sa
 * importe direct `valideaza.js` sau `extract-regex.js` — bariera care spune ca
 * ecranul nu mai reimplementeaza L2a-L4 pe cont propriu. Ecranul are insa
 * nevoie de TIPURILE avertismentelor ca sa le grupeze pe cauza, iar regex-ul
 * barierei se uita la calea importului, nu la `import type`. Nucleul e usa
 * legitima catre stratul de import, deci tipurile trec pe aici.
 */
export type { Avertisment, CodAvertisment } from "./valideaza.js";
export type { CodNetarifare } from "../pricing/types.js";

/** In ce faza a dedupului pe sablon se afla liniile trimise unui `Extractor`. */
export interface ContextExtragere { faza: "reprezentanti" | "ramase" }

/**
 * Stratul cu model, ca functie. CLI-ul o implementeaza cu `extrageCuModel`
 * direct; ecranul, cu loturi paralele peste `fetch("/api/extrage")`. Nucleul nu
 * stie si nu-i pasa care e — de-aia poate ramane izomorf.
 */
export type Extractor = (linii: LinieSursa[], ctx: ContextExtragere) => Promise<LinieExtrasa[]>;

export interface OptiuniNucleu {
  /** Memoria de sabloane. CLI-ul da `stocPeDisc()`, ecranul `stocLocal()`. */
  stoc: StocSabloane;
  /** Maparile de coloane (L1), indexate pe amprenta de layout. Lipsa = fara L1. */
  mapari?: Map<string, MapareSalvata>;
  /** Prag de incredere sub care o linie merge obligatoriu la validare umana. */
  prag?: number;
  /** Stratul cu model. Lipsa = fara el (`--fara-model`, sau build fara server). */
  extrage?: Extractor;
  /** Plafon de linii trimise la model, COMUN celor doua treceri ale dedupului. */
  maxLiniiModel?: number;
  /**
   * Segmentul ofertei. Implicit rezidential — asa se tarifa pana sa existe
   * listele industriale, deci CLI-ul si testele nu-si schimba rezultatul.
   */
  destinatie?: Destinatie;
  /**
   * Grosimile uzuale ale firmei (`grosimi-uzuale.ts`) pe care omul a cerut sa
   * fie puse, pe indexul liniei. Se aplica DOAR liniilor fara grosime extrasa
   * si NU le confirma: o grosime propusa decide pretul, dar n-a scris-o
   * clientul, deci linia ramane de validat pana o confirma omul.
   *
   * Sta separat de `rezolvate` fiindca `reevalueaza` re-extrage de la zero
   * liniile care nu sunt "om", iar grosimea propusa nu vine din textul lor.
   * Pana acum butonul punea `sursa: "om"`, adica o confirmare in masa ascunsa:
   * 24 de casete de pe cererea Abur plecau direct in oferta, fara validare.
   */
  grosimiPropuse?: ReadonlyMap<number, number>;
  /**
   * Liniile a caror descriere s-a schimbat dupa ce le verificase omul sau le
   * citise modelul. `reevalueaza` le reciteste din textul nou si le ADAUGA aici;
   * raman „de verificat" pana le confirma omul din nou, cand ies din set.
   *
   * E al apelantului, ca `grosimiPropuse`, si din acelasi motiv: dupa recitire
   * linia nu mai e nici `om`, nici `model`, deci recalculul urmator n-ar mai
   * avea de unde sti ca fusese verificata. Ecranul il salveaza in istoric.
   */
  descrieriSchimbate?: Set<number>;
  /**
   * Preturile unitare puse de om, pe indexul liniei, in EUR. Pentru pozitiile
   * pe care listele nu le acopera: distribuitorul de abur din Oferta 284
   * (2.296,70, echipament la comanda), livrarea tevii cu izolatia inclusa,
   * protectia la foc a tubulaturii. Fara ele, registrul ramanea sub oferta
   * semnata cu exact acele pozitii — n-aveau niciun drum spre foaia `Ofertă`.
   *
   * Bate tarifarea, dar nu o ascunde: nota spune ce dadea lista. E al
   * apelantului, ca `grosimiPropuse`, si se salveaza in istoric.
   */
  preturiManuale?: ReadonlyMap<number, number>;
  laProgres?: (p: Progres) => void;
}

export interface Progres { faza: "mapare" | "determinist" | "memorie" | "model" | "tarifare"; gata: number; total: number }

/**
 * O linie de pozitie dupa L0-L4: bruta, extrasa, sursa extragerii si rezultatul
 * tarifarii sau motivul pentru care n-a mers.
 *
 * Mutata aici din `pipeline.ts`: era acolo doar pentru ca pipeline-ul era
 * singurul loc care parcurgea L0-L4 cap-coada. `tests/golden.test.ts` importa
 * `tarifeazaExtras` din `pipeline.ts` — ramane asa, `pipeline.ts` re-exporta.
 */
export interface LinieProcesata {
  bruta: LinieBruta;
  extras: LinieExtrasa;
  sursa: Sursa;
  /**
   * Cele doua forme de rezultat au altceva inauntru — straturi la matrice,
   * componente la inchiderile la foc — dar impart pret_unitar, cantitate si
   * total, singurele campuri de care are nevoie raportul.
   */
  pret?: RezultatTarifare | RezultatGolFoc;
  /** Motivul pentru care linia nu s-a putut tarifa, ca text citit de om. */
  eroare?: string;
  /**
   * Aceeasi cauza, ca valoare stabila pe care se poate GRUPA.
   *
   * Sta LANGA `eroare`, nu in locul lui: `eroare` e afisat azi si in CLI, si in
   * `web/ecrane/import.ts`, iar inlocuirea lui ar rupe cod care merge fara sa
   * castige nimic. Textul ramane pentru citit, codul pentru numarat — ecranul
   * poate spune "64 de pozitii sunt blocate de acelasi lucru", ceea ce dintr-un
   * camp de text liber nu se poate deduce.
   */
  codEroare?: CodNetarifare;
  /**
   * Ce n-a trecut de validarea de plauzibilitate. Se recalculeaza aici, desi
   * un `Extractor` poate sa fi aplicat deja aceleasi reguli (`extrageCuModel`
   * o face): acolo efectul e coborarea increderii, ca sa nu poata fi sarita de
   * niciun apelant; aici e nevoie de lista in forma structurata, pentru raport
   * si pentru ecranul de validare. Functia e pura, deci a doua trecere nu
   * costa nimic — si e singura garantie ca guardrails-urile chiar ruleaza
   * indiferent CE `Extractor` e conectat (un `Extractor` de test, sau liniile
   * deduse pe sablon, care nu trec niciodata prin `extrageCuModel`).
   */
  avertismente?: Avertisment[];
  /** true daca linia trebuie sa treaca prin ecranul de validare umana. */
  necesitaValidare: boolean;
  /**
   * Randul descrie ceva care vine izolat de la producator (`estePreizolat`):
   * nu e pozitie de ofertat. `extras.sistem` e pus pe null, deci randul iese
   * din oferta; campul spune de ce, ca sa nu para un rand pierdut.
   */
  preizolat?: true;
}

/**
 * Contoarele unui import. Exact ce tinea `RaportImport` de azi, minus `fisier`
 * si `linii` — alea sunt treaba invelisului (Node stie calea, ecranul n-are
 * fisier de disc), nu a nucleului.
 */
export interface Statistici {
  foi: number;
  foiMapate: number;
  total: number;
  liniiIzolatie: number;
  prinRegex: number;
  prinModel: number;
  prinSablon: number;
  prinMemorie: number;
  /** Linii confirmate sau corectate direct de om, in ecranul de import. */
  prinOm: number;
  faraMasura: number;
  trimiseLaModel: number;
  reziduale: number;
  modelFaraRaspuns: number;
  /** Linii care n-au mai plecat la model din cauza plafonului `maxLiniiModel`. */
  trunchiat: number;
  tarifate: number;
  deValidat: number;
  cuAvertisment: number;
  netarifate: number;
  /** Randuri care vin izolate de la producator, scoase din oferta (`estePreizolat`). */
  preizolate: number;
  valoareTotala: number;
  /**
   * Randuri care spun ca fisierul e o lista de MANOPERA, nu de material +
   * manopera.
   *
   * Nu e un detaliu de afisare, e o capcana de pret masurata. `Anexa 1 la
   * contract - Oferta 06.12.2024.xlsx` e o oferta de manopera pura: sectiunile
   * ei scriu "1. Izolatii conducte PPR cu Armaflex gr. 9 mm - manopera :", iar
   * preturile semnate sunt 2,20 / 2,30 / 3,00 EUR/ml — tariful plat de
   * manopera din `.claude/liste-preturi.md`. Listele pe care le are motorul
   * sunt material + manopera, deci aceleasi pozitii ies la 5,79-8,84 EUR/ml,
   * adica **de 2,5 pana la 3,8 ori** pretul semnat.
   *
   * Fisierul iese azi cu 0 pozitii, fiindca randurile lui de date n-au text
   * (descrierea sta in antetul de sectiune, randul are doar cifre). Rezultatul
   * e CORECT — ce ar fi gresit e sa fortam acoperirea pana cand pozitiile se
   * tarifeaza din matricea nepotrivita. Contorul asta exista ca ecranul sa
   * poata spune "n-avem lista" in loc sa arate o foaie goala.
   */
  randuriManopera: number;
}

/**
 * O linie rezolvata: extragerea, de unde vine, si textul din care a iesit.
 *
 * `text` e textul randului in momentul in care extragerea i-a fost data —
 * citita de model, confirmata sau corectata de om. Fara el, o descriere
 * schimbata dupa aceea nu se vedea: linia `om` nu se re-extragea, iar a
 * modelului se pastra, deci pretul ramanea pe textul vechi, marcat „Gata".
 * Verificat in browser pe 15 septembrie 2026: dupa „Modifică", scoasa tabla din
 * descriere, pozitia ramanea la 45,24 €/ml. Lipsa lui inseamna „textul de acum",
 * pe care nucleul il completeaza la prima trecere (`stampileazaText`).
 */
export interface Rezolvare {
  extras: LinieExtrasa;
  sursa: Sursa;
  text?: string;
}

export interface Rezultat {
  foi: FoaieBruta[];
  brute: LinieCuSectiune[];
  rezolvate: Map<number, Rezolvare>;
  linii: LinieProcesata[];
  statistici: Statistici;
}

/**
 * Ce citeste stratul determinist dintr-un text dat. Pentru editorul de pozitie,
 * care arata campurile recitite dintr-o descriere inainte ca omul s-o salveze.
 *
 * Trece pe aici, nu direct prin `extract-regex.js`: e aceeasi regula ca la
 * import, iar `tests/structura.test.ts` nu lasa ecranul sa aiba alta.
 */
export function citesteText(
  index: number, text: string, um?: string, sectiune?: string, cantitate?: number,
): LinieExtrasa {
  return extrageDeterminist(index, text, um, sectiune, cantitate).linie;
}

const JACHETE = new Set<string>(["tabla", "tabla_inox", "pvc"]);

/**
 * Jacheta (tabla, inox, PVC) sta mereu PESTE izolatie, oricum ar fi fost
 * scrisa ordinea in extragere.
 *
 * Motorul pune primul strat pe teava si creste geometria de acolo, deci o
 * jacheta pusa prima muta toate randurile. Modelul face exact greseala asta,
 * si nu constant: pe „Caseta izolatie armaturi ... din tabla inox 304 si vata
 * minerala" (Izolatii Transavia), la `temperature 0`, o rulare a dat 14 linii
 * cu `tabla_inox` ca sistem principal, urmatoarea niciuna. E fizica, nu
 * interpretare, deci se repara aici, stabil — ordinea dintre izolatii si
 * dintre jachete ramane cea scrisa.
 */
function jachetaLaExterior<T extends { sistem: string }>(straturi: T[]): T[] {
  return [...straturi.filter((s) => !JACHETE.has(s.sistem)), ...straturi.filter((s) => JACHETE.has(s.sistem))];
}

/**
 * Livrarea unei TEVI, cu izolatia doar „inclusiv": clientul cumpara teava.
 *
 * `oferta-118-nisal.xlsx`, randul 83: „Edelstahlrohr für Abgas von
 * Dieselpumpen | Teava de inox pentru evacuarea gazelor arse ...; inclusiv
 * izolatie termica avand grosimea de vata minerala 50 mm ...; inclusiv
 * confectionare pipa ... vopsire". Semnat 20,09 €/m; vata 50 pe ø125 da 14,68,
 * si nicio combinatie din liste nu da 20,09 — pretul e al tevii, al pipei si
 * al vopsirii, facut de om. Ca la protectia la foc a tubulaturii: alta lucrare,
 * fara lista.
 *
 * La fel `cerere-de-oferta-spital.xlsx`, foile „teava olzn canelata +
 * izolatie", „teava prev can + izolatie", „teava PEX+izolatie": „Teava din
 * otel zincata serie medie, imbinata prin cuplaje rapide, inclusiv fitinguri,
 * treceri prin pereti ..., sistem complet de sustinere ..., izolatie in
 * grosime de 20 mm". Pe calea cu model ieseau „Gata", cu vata si tabla.
 *
 * Cere AMBELE: randul incepe cu teava (sau o coloana a lui incepe cu ea) si
 * spune ca e livrarea ei — izolatia „inclusiv", sau imbinari, fitinguri,
 * sustineri, seria tevii. „Izolatie ... pe teava DN50" nu intra aici.
 */
const RE_TEAVA_LIVRATA = /(?:^|\|)\s*(?:[a-zäöü]*rohr\b|teav[aă]\b|țeav[aă]\b|tevi\b|țevi\b|pipe\b)/i;
const RE_IZOLATIE_INCLUSA = /inclusiv\s+izola|including\s+(?:thermal\s+)?insulation|inkl\.?\s+(?:w[aä]rme)?d[aä]mm/i;
const RE_LIVRARE_TEAVA =
  /[îi]mbinat|fitinguri|cuplaj|sus[țt]inere|serie\s+(?:medie|u[șs]oar[aă]|grea)|manson\s+alunecator/i;

export function esteLivrareDeTeava(text: string): boolean {
  return RE_TEAVA_LIVRATA.test(text) && (RE_IZOLATIE_INCLUSA.test(text) || RE_LIVRARE_TEAVA.test(text));
}

/**
 * Izolarea unui ECHIPAMENT, nu a unei tevi: listele sunt pe metru de teava.
 *
 * Cererea TRANSAVIA (abur), randul 25: „Izolare echipament DISTRIBUITOR ABUR
 * cu vata minerala si protectie cu tabla de aluminiu, g100 D=500, L=4500, 10
 * racorduri". Oferta 284 are 2.296,70 €/buc. Determinist iesea „fara
 * diametru"; modelul citea D=500 ca teava si dadea 191,83 € prin formula pe mp
 * (−92%). Nicio regula din liste nu da 2.296,70: 17,5 × pretul pe ml la ø500
 * g100, iar 17,5 nu iese nici din L, nici din coeficientul de distribuitor
 * (4,5), nici din racorduri. Pretul e al omului.
 *
 * Doar pe cuvantul „echipament": „distribuitor" singur e si o FORMA din liste
 * (coloana „pompa, filtru, distribuitor", multiplicator pe pretul tevii).
 */
const RE_ECHIPAMENT = /\bechipament|\bequipment\b/i;

export function esteIzolareDeEchipament(text: string): boolean {
  return RE_ECHIPAMENT.test(text);
}

/**
 * Ce vine deja izolat de la producator: nu e lucrarea firmei, deci nu e
 * pozitie de ofertat. Firma, la intalnirea din 5 octombrie 2026: „de obicei nu
 * se face izolatia pe tevile preizolate".
 *
 * `cerere-de-oferta-book15.xlsx`: „insulated flexible circular duct ... with
 * 25 mm fiberglass insulation" (12 randuri) si „Storage tank ... with 20 mm
 * closed polyethylene cells insulation, with PVC outer protection" — tubulatura
 * flexibila si rezervorul se cumpara izolate. Iesea „fara pret" (vata 25 mm nu
 * exista, PVC peste lista).
 */
const RE_PREIZOLAT =
  /insulated\s+flexible|flexibil[aă],?\s+(?:izolat|insulat)|pre-?izolat|pre-?insulated|storage\s+tank|rezervor\s+de\s+acumulare/i;

export function estePreizolat(text: string): boolean {
  return RE_PREIZOLAT.test(text);
}

/**
 * Pretul protectiei la foc a tubulaturii, pe m²: singurul pret semnat de firma
 * pentru lucrarea asta. Oferta 27.04.2026 (NISAL), „Entrauchungskanal ...
 * izolare termica la foc a tubulaturii pentru obtinerea clasificarii EI60min,
 * cu vata minerala grosime 60mm": 48 €/m².
 *
 * Firma (5 octombrie 2026): EI120 cu Conlit, EI60 cu Conlit sau Techrock, pret
 * pus de mana. Deci pretul iese, dar pozitia merge mereu la om: la EI120 /
 * EI180 materialul e mai gros decat la singura valoare semnata.
 */
export const PRET_PROTECTIE_FOC_MP = 48;

function tarifeazaProtectieFoc(
  extras: LinieExtrasa, cantitate: number, text: string,
): RezultatTarifare {
  const grosime = grosimeProtectieFoc(text) ?? extras.grosime_mm;
  let mpPeMl = 1;
  let od = 0;
  // Pe metru doar cand randul e chiar in metri si are diametru: o „inchidere de
  // gol" citita gresit de model poarta diametrul tevii, nu al tubulaturii.
  if (extras.diametru_valoare !== null && extras.diametru_tip && extras.forma === "ml"
      && extras.sistem !== "goluri_foc") {
    od = toOuterDiameter(extras.diametru_valoare, extras.diametru_tip);
    mpPeMl = bani((od + 2 * (grosime ?? 0)) / 1000 * PI_FIRMA);
  }
  const unitar = bani(PRET_PROTECTIE_FOC_MP * mpPeMl);
  const clasa = text.match(/\bEI\s?(\d{2,3})/i)?.[1];
  const n = `protectie la foc a tubulaturii${clasa ? ` EI${clasa}` : ""}: ${PRET_PROTECTIE_FOC_MP} €/m², singurul pret ` +
    "semnat (EI60, vata 60 mm, Oferta 27.04.2026)" +
    (od ? `; pe ø${od}: ${mpPeMl} m²/ml` : "") +
    ". Firma pune pretul de mana (Conlit / Techrock): de verificat";
  return {
    straturi: [{
      sistem: "vata_minerala", grosime_mm: grosime, diametru_geometric: od, rand_lista: 0,
      pret_unitar: PRET_PROTECTIE_FOC_MP, multiplicator: mpPeMl, inclus: true,
    }],
    pret_unitar: unitar, multiplicator: mpPeMl, cantitate, total: bani(unitar * cantitate), moneda: "EUR",
    note: [n], noteDeVerificat: [n], motiveDeVerificat: ["protectie_foc"],
  };
}

/** π al firmei, din regula ei pentru suprafete („3,14"). */
const PI_FIRMA = 3.14;

/**
 * Izolarea unui echipament, pe suprafata lui: manta + doua capace, cu regula
 * firmei pentru suprafete, × pretul pe mp al straturilor × `K_ECHIPAMENT`.
 *
 * Singurul echipament cu pret semnat e distribuitorul de abur din Oferta 284:
 * g100, D=500, L=4500, 10 racorduri, 2.296,70 €. Suprafata cu vata 100 e
 * 10,66 m², iar vata 100 + tabla 0,8 pe mp fac 87,13 €: 928,83 €. Restul pana
 * la pretul semnat (×2,47) sunt racordurile, capacele si manopera pe un corp
 * care nu e teava. Factorul e dintr-o singura oferta, deci pozitia merge la om.
 */
const K_ECHIPAMENT = 2296.70 / 928.8318;

const RE_DIAMETRU_ECHIPAMENT = /(?:\bD\s*=|[Øø∅Ф])\s*(\d{3,4})/i;
const RE_LUNGIME_ECHIPAMENT = /\b[LH]\s*=\s*(\d{3,5})/i;

function tarifeazaEchipament(
  extras: LinieExtrasa, cantitate: number, destinatie: Destinatie, text: string,
): RezultatTarifare | null {
  const d = Number(text.match(RE_DIAMETRU_ECHIPAMENT)?.[1]);
  const l = Number(text.match(RE_LUNGIME_ECHIPAMENT)?.[1]);
  if (!d || !l || extras.sistem === null || extras.sistem === "goluri_foc") return null;
  const straturi = jachetaLaExterior([
    { sistem: extras.sistem, ...(extras.grosime_mm !== null ? { grosime_mm: extras.grosime_mm } : {}) },
    ...extras.straturi_extra.map((s) => ({ sistem: s.sistem, ...(s.grosime_mm !== null ? { grosime_mm: s.grosime_mm } : {}) })),
  ]);
  const peMp = tarifeazaPeMp({ straturi, cantitate: 1, destinatie });
  const izolatie = peMp.straturi.filter((s) => !JACHETE.has(s.sistem)).reduce((s, t) => s + (t.grosime_mm ?? 0), 0);
  const exterior = (d + 2 * izolatie) / 1000;
  const suprafata = PI_FIRMA * exterior * (l / 1000) + 2 * PI_FIRMA * (exterior / 2) ** 2;
  const unitar = bani(suprafata * peMp.pret_unitar * K_ECHIPAMENT);
  const n = `izolarea unui echipament: suprafata ${bani(suprafata)} m² (D=${d}, L=${l}, cu capace) × ` +
    `${peMp.pret_unitar} €/m² × ${K_ECHIPAMENT.toFixed(2)}, factorul distribuitorului din Oferta 284 (2.296,70 €). ` +
    "O singura valoare semnata: de verificat";
  return {
    straturi: peMp.straturi, pret_unitar: unitar, multiplicator: 1, cantitate,
    total: bani(unitar * cantitate), moneda: "EUR", suprafata_mp: bani(suprafata),
    note: [...(peMp.note ?? []), n], noteDeVerificat: [...(peMp.noteDeVerificat ?? []), n],
    motiveDeVerificat: [...(peMp.motiveDeVerificat ?? []), "echipament_suprafata"],
  };
}

/** Banda autoadeziva pe armaturi: un rand fara diametru, in metri. */
const RE_BANDA_ARMATURI = /band[aă]\s+autoadeziv/i;

/** Adauga o nota care cere ochi, cu motivul ei. */
function marcheaza(r: RezultatTarifare, n: string, motiv: MotivVerificare): void {
  r.note = [...(r.note ?? []), n];
  r.noteDeVerificat = [...(r.noteDeVerificat ?? []), n];
  r.motiveDeVerificat = [...(r.motiveDeVerificat ?? []), motiv];
}

/**
 * Grosimi scrise de client care inseamna, in practica firmei, alta grosime din
 * lista. Elastomerul nu se face in 20 mm (9 / 13 / 19 / 25 / 32), iar „S=20mm"
 * din Oferta 27.04.2026 e tarifat de firma cu pretul de 19 mm: DN100 15,71,
 * DN150 17,66, DN200 19,44 — 3 din 3, exact. Se aplica doar perechilor dovedite;
 * restul (vata g48) raman netarifate, decizia omului.
 */
const ECHIVALENTE: Partial<Record<string, Record<number, number>>> = {
  elastomer: { 20: 19 },
};

function cuEchivalente<T extends { sistem: string; grosime_mm?: number }>(
  straturi: T[], destinatie: Destinatie, forma: LinieExtrasa["forma"],
): { straturi: T[]; note: string[]; deVerificat: string[]; pesteLista: boolean } {
  const note: string[] = [];
  const deVerificat: string[] = [];
  let pesteLista = false;
  const out = straturi.map((s) => {
    if (s.grosime_mm === undefined) return s;
    const g = ECHIVALENTE[s.sistem]?.[s.grosime_mm];
    if (g !== undefined) {
      note.push(`${s.sistem} ${s.grosime_mm} mm nu exista in lista; tarifat ca ${g} mm, ca in Oferta 27.04.2026 (3 din 3)`);
      return { ...s, grosime_mm: g };
    }
    // Orice alta grosime scrisa care nu e in lista: cea mai apropiata, la
    // egalitate cea mai groasa, marcata. Transavia inox, „Di60, g48 - COT":
    // 48 nu e grosime de vata (20 / 30 / 40 / 50 …), iar regula 20 → 19 a
    // elastomerului e tot „cea mai apropiata". Peste ultima grosime, pe mp,
    // pretul se extrapoleaza in motor (`pretPeMp`), nu se coboara.
    if (s.sistem !== "vata_minerala" && s.sistem !== "elastomer") return s;
    const grosimi = listaDe(s.sistem, destinatie).lista.grosimi_mm;
    if (grosimi.length === 0 || grosimi.includes(s.grosime_mm)) return s;
    if (forma === "mp" && s.grosime_mm > Math.max(...grosimi)) return s;
    const scrisa = s.grosime_mm;
    const aproape = [...grosimi].sort((a, b) => Math.abs(a - scrisa) - Math.abs(b - scrisa) || b - a)[0]!;
    // Peste cea mai groasa din lista nu e o rotunjire (20 → 19), e alta
    // lucrare: doua straturi sau alt material. Pretul e propus, nu dovedit.
    const peste = scrisa > Math.max(...grosimi);
    pesteLista ||= peste;
    const n = peste
      ? `${s.sistem} ${scrisa} mm e peste cea mai groasa din lista (${Math.max(...grosimi)} mm); tarifat ca ${aproape} mm`
      : `${s.sistem} ${scrisa} mm nu exista in lista; tarifat ca ${aproape} mm, cea mai apropiata grosime`;
    note.push(n);
    deVerificat.push(n);
    return { ...s, grosime_mm: aproape };
  });
  return { straturi: out, note, deVerificat, pesteLista };
}

/**
 * L3 pe o singura linie extrasa.
 *
 * Sta separat de bucla pentru ca acelasi drum e parcurs si de testul de golden
 * files, pe iesirea inregistrata a modelului. Daca ar fi ramas inline, testul
 * ala ar fi verificat o COPIE a regulii, nu regula.
 *
 * Pozitia fara pret se MARCHEAZA, nu se ghiceste.
 */
export function tarifeazaExtras(
  extras: LinieExtrasa,
  cantitate: number,
  destinatie: Destinatie = "rezidential",
  /** Textul randului, pentru regulile care depind de el; lipsa = nu se aplica. */
  text?: string,
  /**
   * Textul pentru regulile care spun CE LUCRARE e randul (protectia la foc a
   * tubulaturii, echipamentul, livrarea de teava). Implicit `text`. Pe linia
   * confirmata de om, `text` lipseste (forma si straturile sunt ale lui), dar
   * lucrarea ramane cea scrisa de client: fara asta, distribuitorul TRANSAVIA
   * confirmat ramanea fara pret, iar torcretul confirmat cadea pe lista de vata.
   */
  textLucrare: string | undefined = text,
): { pret?: RezultatTarifare | RezultatGolFoc; eroare?: string; codEroare?: CodNetarifare } {
  // Protectia la foc a tubulaturii: si cand modelul a citit-o „inchidere de
  // gol" (spitalul, „Protectie la foc EI 60 pentru tubulaturile ... torcret"),
  // atata timp cat randul n-are dimensiunile unui gol.
  const golCuDimensiuni = extras.sistem === "goluri_foc"
    && extras.gol_latime_mm !== null && extras.gol_inaltime_mm !== null;
  if (textLucrare !== undefined && extras.sistem !== null && !golCuDimensiuni && esteProtectieLaFocTubulatura(textLucrare)) {
    try {
      return { pret: tarifeazaProtectieFoc(extras, cantitate, textLucrare) };
    } catch (e) {
      if (e instanceof DiametruNecunoscut) return { eroare: e.message, codEroare: "dn_necunoscut" };
      throw e;
    }
  }
  const material = textLucrare !== undefined && extras.sistem !== null && extras.sistem !== "goluri_foc";
  if (material && esteIzolareDeEchipament(textLucrare)) {
    const r = tarifeazaEchipament(extras, cantitate, destinatie, textLucrare);
    if (r) return { pret: r };
    return {
      eroare: "izolarea unui echipament fara D si L pe rand: suprafata nu se poate calcula",
      codEroare: "echipament",
    };
  }
  const t = tarifeazaIzolatie(extras, cantitate, destinatie, text);
  // Livrarea tevii cu izolatia „inclusiv": firma face izolatia, teava o livreaza
  // instalatorul. Se tarifeaza izolatia din liste; NISAL r83 a fost semnat
  // 20,09 €/m fata de 14,68 din liste, deci pozitia merge la om.
  if (material && t.pret && "straturi" in t.pret && esteLivrareDeTeava(textLucrare)) {
    marcheaza(t.pret, "livrare de teava cu izolatia inclusa: s-a tarifat doar izolatia din liste; teava, "
      + "fitingurile si sustinerile nu sunt in pret", "doar_izolatia");
  }
  return t;
}

function tarifeazaIzolatie(
  extras: LinieExtrasa,
  cantitate: number,
  destinatie: Destinatie,
  text?: string,
): { pret?: RezultatTarifare | RezultatGolFoc; eroare?: string; codEroare?: CodNetarifare } {
  try {
    if (extras.sistem === "goluri_foc") {
      if (extras.gol_latime_mm === null || extras.gol_inaltime_mm === null) {
        throw new PozitieNetarifata(
          "gol_fara_dimensiuni",
          "inchidere gol la foc fara dimensiunea golului; pretul vine din suprafata lui",
          { index: extras.index },
        );
      }
      return {
        pret: tarifeazaGolFoc({
          gol: { latime_mm: extras.gol_latime_mm, inaltime_mm: extras.gol_inaltime_mm },
          cantitate,
          destinatie,
        }),
      };
    }
    // Fara sistem linia nu e pozitie de izolatie: nimic de tarifat, nicio cauza.
    if (extras.sistem === null) return {};
    const { straturi, note: echivalente, deVerificat: apropiate, pesteLista } = cuEchivalente(jachetaLaExterior([
      { sistem: extras.sistem, ...(extras.grosime_mm !== null ? { grosime_mm: extras.grosime_mm } : {}) },
      ...extras.straturi_extra.map((s) => ({
        sistem: s.sistem, ...(s.grosime_mm !== null ? { grosime_mm: s.grosime_mm } : {}),
      })),
    ]), destinatie, extras.forma);
    const cuNote = <R extends RezultatTarifare>(r: R): R => {
      const out: R = echivalente.length ? { ...r, note: [...echivalente, ...(r.note ?? [])] } : r;
      if (apropiate.length) {
        out.noteDeVerificat = [...(out.noteDeVerificat ?? []), ...apropiate];
        out.motiveDeVerificat = [...(out.motiveDeVerificat ?? []), pesteLista ? "grosime_peste_lista" : "grosime_apropiata"];
      }
      return out;
    };
    if (extras.sistem && extras.diametru_valoare !== null && extras.diametru_tip) {
      const pret = cuNote(tarifeaza({
        diametru: { valoare: extras.diametru_valoare, tip: extras.diametru_tip },
        straturi,
        forma: extras.forma ?? "ml",
        cantitate,
        destinatie,
      }));
      return { pret };
    }

    // Sistemul e cunoscut, dar diametrul nu — deci nu se poate cauta NICIUN
    // rand: listele sunt indexate doar pe o. Pana acum aici se intorcea `{}`,
    // adica pozitia ramanea fara pret, fara eroare, fara cod si — daca modelul
    // raportase incredere peste prag — fara sa fie nici macar marcata. Se vedea
    // exclusiv ca diferenta intre doua contoare.
    //
    // Masurat pe golden files: doua pozitii din `oferta-118-nisal.xlsx`,
    // amandoua tubulatura RECTANGULARA (`Luftleitg. eckig`,
    // `Entrauchungskanal`, UM `m²`) — care chiar n-are diametru, ci A x B.
    // Conversia perimetrului e in `.claude/tevi.md` si nu e implementata.
    // Pana atunci pozitia se MARCHEAZA, ca oricare alta fara pret.
    // Fara diametru, dar pe suprafata: tubulatura rectangulara in m² se
    // tarifeaza din coloana `per_mp` a listei (Oferta 27.04.2026, 79,73 exact).
    if (extras.sistem !== null && extras.forma === "mp") {
      return { pret: cuNote(tarifeazaPeMp({ straturi, cantitate, destinatie })) };
    }
    // Doar jacheta, fara diametru si fara m² pe UM: spitalul, „Sistem complet de
    // protectie mecanica a izolatiilor ... din tabla zincata", 56 si 22 „buc."
    // in doua sectiuni unde celelalte scriu mp. Tabla se masoara pe suprafata.
    if (straturi.every((s) => JACHETE.has(s.sistem))) {
      const r = cuNote(tarifeazaPeMp({ straturi, cantitate, destinatie }));
      marcheaza(r, "protectie cu tabla fara diametru: tarifata pe mp, cantitatea luata ca m²", "um_bucata");
      return { pret: r };
    }
    // Banda autoadeziva pe armaturi (spitalul, „Izolatii armaturi banda
    // autoadeziva", 45 m): cea mai subtire izolatie de elastomer, pe primul rand.
    if (extras.sistem === "elastomer" && text !== undefined && RE_BANDA_ARMATURI.test(text)) {
      const rand = diametreDin(listaDe("elastomer", destinatie).lista)[0]!;
      const r = cuNote(tarifeaza({
        diametru: { valoare: rand, tip: "exterior" }, straturi: [{ sistem: "elastomer", grosime_mm: 9 }],
        forma: "ml", cantitate, destinatie,
      }));
      marcheaza(r, `banda autoadeziva pe armaturi: pretul elastomerului de 9 mm pe randul ${rand}, pe metru`, "banda_armaturi");
      return { pret: r };
    }
    if (extras.sistem !== null) {
      throw new PozitieNetarifata(
        "fara_diametru",
        "pozitia n-are diametru, iar listele de preturi se cauta doar pe diametru exterior; "
        + "tubulatura rectangulara se masoara A x B si nu are inca regula de conversie",
        { index: extras.index, sistem: extras.sistem, forma: extras.forma },
      );
    }
    return {};
  } catch (e) {
    // `DiametruNecunoscut` nu e `PozitieNetarifata` — vine din `dn-table.ts`,
    // care nu stie nimic despre tarifare — dar pentru omul care se uita la
    // ecran e exact acelasi fel de blocaj: o pozitie fara pret, cu o cauza.
    // Se mapeaza aici, la granita, ca sa nu se imprastie doua ierarhii de
    // erori mai departe in cod.
    if (e instanceof DiametruNecunoscut) {
      return { eroare: e.message, codEroare: "dn_necunoscut" };
    }
    if (e instanceof PozitieNetarifata) {
      return { eroare: e.message, codEroare: e.cod };
    }
    return { eroare: String(e) };
  }
}

/**
 * Plasa de siguranta: ce a vazut determinismul pe o linie pe care n-a
 * rezolvat-o nimeni altcineva.
 *
 * Pana acum extragerea partiala se arunca. Masurat pe cererea reala TRANSAVIA:
 * "Caseta izolatie armaturi cu flanse DN100 din tabla aluminiu si vata
 * minerala" da sistem + diametru + forma, dar clientul nu scrie grosimea —
 * deci `complet: false`, deci linia pleca la model si, fara model, disparea cu
 * totul. Nu aparea nici macar ca pozitie: omul vedea un rand gol, fara sa afle
 * CE lipseste.
 *
 * Acum ramane pozitie, cu increderea ei mica (0,3), deci marcata pentru
 * validare. Nu concureaza cu nimic: se aplica DOAR pe indecsii pe care nici
 * memoria, nici sablonul, nici modelul nu i-au rezolvat.
 */
function completeazaCuPartiale(
  rezolvate: Map<number, Rezolvare>,
  partiale: Map<number, LinieExtrasa>,
): void {
  for (const [index, extras] of partiale) {
    if (!rezolvate.has(index)) rezolvate.set(index, { extras, sursa: "regex" });
  }
}

/**
 * Raspunsurile modelului, doar pe indecsii care i s-au trimis in apelul ASTA.
 *
 * Indexul e singura legatura dintre raspuns si rand, iar modelul il scrie
 * singur. Un index strain ar suprascrie o linie rezolvata deja de reguli; unul
 * intors de doua ori inseamna ca raspunsurile s-au decalat, deci nu stim care
 * obiect e al liniei — amandoua se arunca, linia ramane fara raspuns
 * (`modelFaraRaspuns`) si cade pe ce a citit determinismul, marcata.
 */
function doarLiniileTrimise(extrase: LinieExtrasa[], trimise: LinieSursa[]): LinieExtrasa[] {
  const permise = new Set(trimise.map((l) => l.index));
  const aparitii = new Map<number, number>();
  for (const e of extrase) aparitii.set(e.index, (aparitii.get(e.index) ?? 0) + 1);
  return extrase.filter((e) => permise.has(e.index) && aparitii.get(e.index) === 1);
}

/**
 * Pune raspunsul modelului (sau proiectia lui pe sablon), cu o exceptie: un
 * `sistem: null` nu sterge ce stia deja determinismul.
 *
 * `null` inseamna „nu e pozitie de izolatie", iar o linie asa dispare din
 * lista. Dar regulile vad si antetul de sectiune, iar modelul vede doar randul:
 * pe Oferta Matari, 12 randuri `Teava OL/OLZN DN15` isi iau sistemul numai din
 * „Treceri prin pereti rezistenti la foc EI120" de deasupra. Un model care
 * raspunde `null` le-ar fi scos din „Netarifate" fara nicio cauza. Ramane
 * citirea partiala, cu increderea ei mica, deci la validare.
 */
function puneDinModel(
  rezolvate: Map<number, Rezolvare>,
  partiale: ReadonlyMap<number, LinieExtrasa>,
  e: LinieExtrasa,
  sursa: "model" | "sablon",
): void {
  if (e.sistem === null && partiale.get(e.index)?.sistem != null) return;
  rezolvate.set(e.index, { extras: e, sursa });
}

/**
 * Textul din care a iesit fiecare extragere care inca nu-l are — vezi
 * `Rezolvare.text`. Obiect nou, nu mutatie: ecranul tine instantanee ale
 * intrarilor vechi pentru „Anulează".
 */
function stampileazaText(brute: LinieCuSectiune[], rezolvate: Map<number, Rezolvare>): void {
  for (const b of brute) {
    const r = rezolvate.get(b.index);
    if (r && r.text === undefined) rezolvate.set(b.index, { ...r, text: b.text });
  }
}

/** Diametrul exterior al unei extrageri, ca sa se poata compara intre linii scrise diferit. */
function diametruExterior(e: LinieExtrasa): number | null {
  if (e.diametru_valoare === null || e.diametru_tip === null) return null;
  try {
    return toOuterDiameter(e.diametru_valoare, e.diametru_tip);
  } catch {
    return null;
  }
}

interface GrosimeDeLaConducta {
  grosime: number; rand: number; foaie: string;
  /** Conductele de acelasi diametru au mai multe grosimi; s-a luat cea mai mare. */
  alternative?: number[];
  /** Nicio conducta de acelasi diametru: diametrul exterior al celei mai apropiate. */
  vecina?: number;
}

/**
 * Teava de cupru, numita explicit. NU „Cu": in romana e prepozitia din „cu
 * vata minerala".
 */
const RE_CUPRU = /\bcupru\b|\bcopper\b|kupfer/i;

interface SeriePeMaterial {
  extras: LinieExtrasa;
  nota: string;
  motiv: "serie_cupru" | "serie_inox";
}

/**
 * Diametrul unei tevi date in DN, dupa materialul ei.
 *
 * `DN_TO_OD` e seria de OTEL, iar firma a spus-o scris: cuprul si inoxul „se
 * dau in DN, dar nu se convertesc pe coloana ISO". Pentru cupru seria e in
 * registrul ei de conversie (`DN_TO_OD_CUPRU`): DN15 → ø18, nu ø21,3. Pozitia
 * se tarifeaza pe ø-ul de cupru, rotunjit in sus ca orice ø, dar merge la om —
 * nicio oferta semnata n-are inca teava de cupru.
 *
 * Pentru inox nu exista serie in datele firmei (inoxul presat merge pe seria
 * cuprului, cel sudat pe ISO), deci pretul ramane pe ISO si pozitia e marcata.
 * Un Ø scris pe rand bate oricum DN-ul, din `extract-regex.ts`; aici ajung
 * doar DN-urile singure.
 */
function serieDupaMaterial(e: LinieExtrasa, text: string): SeriePeMaterial | null {
  if (e.diametru_tip !== "DN" || e.diametru_valoare === null || e.sistem === "goluri_foc") return null;
  const dn = e.diametru_valoare;
  if (RE_CUPRU.test(text)) {
    const od = DN_TO_OD_CUPRU[dn];
    if (od === undefined || od === DN_TO_OD[dn]) return null;
    return {
      extras: { ...e, diametru_valoare: od, diametru_tip: "exterior" },
      nota: `teava de cupru: DN${dn} = ø${String(od).replace(".", ",")} pe seria cuprului `
        + `(registrul de conversie al firmei), nu ø${String(DN_TO_OD[dn] ?? "?").replace(".", ",")} ca la otel`,
      motiv: "serie_cupru",
    };
  }
  if (esteTeavaDeInox(text)) {
    return {
      extras: e,
      nota: `teava de inox: DN${dn} tarifat pe seria de otel (ISO); la inoxul presat seria e alta `
        + "(DN15 = ø18), iar lista firmei n-o spune",
      motiv: "serie_inox",
    };
  }
  return null;
}

/** Unitati de masura care numara bucati: „buc", „buc.", „pcs", „Stk". */
const RE_UM_BUCATA = /^(buc|bucati|bucăți|pcs|pc|stk|st)\.?$/i;

/**
 * Grosimea pe care clientul n-a scris-o, luata de la conducta de ACELASI
 * diametru si ACELASI material din aceeasi lista.
 *
 * Cererea TRANSAVIA (abur) scrie „Caseta izolatie armaturi cu flanse DN100 din
 * tabla aluminiu si vata minerala" fara grosime, dar aceeasi lista are
 * conducta „Di114, g50". Oferta semnata a dat casetei exact grosimea conductei
 * ei, la toate cele 11 diametre (DN15…DN250, 24 de casete): armatura se
 * izoleaza ca teava pe care sta. E o citire din fisierul clientului, nu o
 * presupunere a noastra — de-aia bate grosimea uzuala a firmei.
 *
 * Doar cand pe acel diametru lista are O SINGURA grosime pentru material: doua
 * conducte DN100 cu 50 si 80 mm (tur si retur, alt agent) nu spun care e a
 * armaturii, deci pozitia ramane fara grosime, ca inainte. Se compara
 * diametrul exterior, cu toleranta seriei de otel: DN100 (ø114,3) si Di114
 * sunt aceeasi teava.
 *
 * Nu si cand randul SCRIE o grosime pe care extragerea a respins-o: pe
 * `cerere-de-oferta-transavia-inox.xlsx`, „Di76, g48 - COT" (48 nu e grosime
 * de vata) primea 50 mm de la conducta „Di76, g50 - ML", cu incredere 0,99.
 * Clientul a scris ceva; ce a vrut sa scrie e al omului, nu al conductei.
 */
function grosimiDeLaConducte(
  brute: LinieCuSectiune[], rezolvate: Map<number, Rezolvare>,
): Map<number, GrosimeDeLaConducta> {
  const surse: { sistem: string; od: number; grosime: number; rand: number; foaie: string }[] = [];
  for (const b of brute) {
    const e = rezolvate.get(b.index)?.extras;
    if (!e || e.sistem === null || e.grosime_mm === null) continue;
    const od = diametruExterior(e);
    if (od !== null) surse.push({ sistem: e.sistem, od, grosime: e.grosime_mm, rand: b.rand, foaie: b.foaie });
  }
  const out = new Map<number, GrosimeDeLaConducta>();
  for (const b of brute) {
    const e = rezolvate.get(b.index)?.extras;
    if (!e || e.grosime_mm !== null || (e.sistem !== "vata_minerala" && e.sistem !== "elastomer")) continue;
    if (scrieGrosime(b.text)) continue;
    const od = diametruExterior(e);
    if (od === null) continue;
    const acelasi = surse.filter((s) => s.sistem === e.sistem);
    let potrivite = acelasi.filter((s) => Math.abs(s.od - od) <= TOLERANTA_SERIE_OTEL);
    // Nicio conducta de acelasi diametru (Transavia inox: caseta DN150, iar
    // conductele se opresc la Di140): conducta cu diametrul cel mai apropiat.
    const vecina = potrivite.length === 0 && acelasi.length > 0;
    if (vecina) {
      const cel = Math.min(...acelasi.map((s) => Math.abs(s.od - od)));
      potrivite = acelasi.filter((s) => Math.abs(s.od - od) === cel);
    }
    const grosimi = [...new Set(potrivite.map((s) => s.grosime))].sort((a, b) => a - b);
    if (grosimi.length === 0) continue;
    // Doua conducte de acelasi diametru cu grosimi diferite (Transavia inox:
    // Di114 g40 si g50): armatura primeste grosimea mai mare, marcata — ea
    // acopera oricare dintre conducte.
    const max = grosimi.at(-1)!;
    const sursa = potrivite.find((s) => s.grosime === max)!;
    out.set(b.index, {
      grosime: max, rand: sursa.rand, foaie: sursa.foaie,
      ...(grosimi.length > 1 ? { alternative: grosimi } : {}),
      ...(vecina ? { vecina: Math.round(sursa.od * 10) / 10 } : {}),
    });
  }
  return out;
}

/**
 * Liniile carora determinismul le-a citit tot in afara de grosime, iar
 * grosimea o da conducta de acelasi diametru (`grosimiDeLaConducte`): raman
 * ale regulilor, nu mai pleaca la model. Intoarce restul, care pleaca.
 *
 * Cererea TRANSAVIA (abur): cele 24 de casete „… cu flanse DN100 din tabla
 * aluminiu si vata minerala" plecau la model doar pentru grosime, care nu e in
 * text. Modelul intorcea grosimea null si o incredere de 0,85 intr-o rulare,
 * mai mica in alta; grosimea de la conducta le completa, dar increderea
 * ramanea a modelului. La 0,85 ieseau „Gata", sub 0,85 toate 24 „De verificat"
 * fara motiv („citit nesigur") — acelasi fisier, alta stare de la o rulare la
 * alta, pe preturi exacte fata de Oferta 284. Fara model, aceleasi linii ieseau
 * „Gata" cu 0,99: calea cu model o facea mai proasta.
 *
 * Dupa memorie, nu inainte: ce a corectat omul pe tiparul asta castiga.
 */
function completeazaDinConducte(
  brute: LinieCuSectiune[],
  rezolvate: Map<number, Rezolvare>,
  partiale: Map<number, LinieExtrasa>,
  ramase: LinieSursa[],
): LinieSursa[] {
  const cuPartiale = new Map(rezolvate);
  for (const [index, extras] of partiale) {
    if (!cuPartiale.has(index)) cuPartiale.set(index, { extras, sursa: "regex" });
  }
  const deLaConducte = grosimiDeLaConducte(brute, cuPartiale);
  return ramase.filter((l) => {
    const partiala = partiale.get(l.index);
    if (!partiala || !deLaConducte.has(l.index)) return true;
    rezolvate.set(l.index, { extras: partiala, sursa: "regex" });
    return false;
  });
}

/** Textul unui rand fara dimensiunea golului si fara spatii: „Teava OL /OLZNDN20". */
const cheieTeava = (text: string): string =>
  text.toLowerCase().replace(/\d+\s*[x/×]\s*\d+/g, "").replace(/[\s|]+/g, "");

/**
 * Dimensiunea golului pe care randul n-o scrie, luata de la ACEEASI teava din
 * acelasi fisier.
 *
 * Oferta Matari: sectiunea EI180 are 12 randuri („Teava OL/OLZN DN15", 4 buc.)
 * fara dimensiunea golului, iar sectiunile EI30 / EI60 / EI120 de deasupra au
 * aceleasi tevi cu golul scris (DN15 130/130, DN100 320/320, PEHD 110 320/320).
 * Golul e al trecerii tevii prin perete, nu al clasei de foc, iar clasa nu
 * schimba pretul. Daca aceeasi teava apare cu goluri diferite, se ia cel mai
 * des intalnit, la egalitate cel mai mare.
 */
function goluriDeLaAceeasiTeava(
  brute: LinieCuSectiune[], rezolvate: Map<number, Rezolvare>,
): Map<string, { latime: number; inaltime: number }> {
  const numarate = new Map<string, Map<string, number>>();
  for (const b of brute) {
    const e = rezolvate.get(b.index)?.extras;
    if (e?.sistem !== "goluri_foc" || e.gol_latime_mm === null || e.gol_inaltime_mm === null) continue;
    const k = cheieTeava(b.text);
    const m = numarate.get(k) ?? new Map<string, number>();
    const dim = `${e.gol_latime_mm}x${e.gol_inaltime_mm}`;
    m.set(dim, (m.get(dim) ?? 0) + 1);
    numarate.set(k, m);
  }
  const out = new Map<string, { latime: number; inaltime: number }>();
  for (const [k, m] of numarate) {
    const [dim] = [...m].sort((a, b) => b[1] - a[1] || arie(b[0]) - arie(a[0]))[0]!;
    const [latime, inaltime] = dim.split("x").map(Number) as [number, number];
    out.set(k, { latime, inaltime });
  }
  return out;
}

const arie = (dim: string): number => dim.split("x").map(Number).reduce((a, b) => a * b, 1);

/**
 * L3 + guardrails, pentru toata lista de linii brute rezolvate.
 *
 * Comun lui `proceseazaRegistru` si `reevalueaza`, ca sa nu poata drifta unul
 * fata de celalalt exact cum a driftat ecranul fata de pipeline.
 */
function construiesteLinii(
  brute: LinieCuSectiune[],
  rezolvate: Map<number, Rezolvare>,
  prag: number,
  destinatie: Destinatie,
  grosimiPropuse?: ReadonlyMap<number, number>,
  descrieriSchimbate?: ReadonlySet<number>,
  preturiManuale?: ReadonlyMap<number, number>,
): LinieProcesata[] {
  const linii: LinieProcesata[] = [];
  const deLaConducte = grosimiDeLaConducte(brute, rezolvate);
  const goluri = goluriDeLaAceeasiTeava(brute, rezolvate);
  for (const b of brute) {
    const r = rezolvate.get(b.index);
    if (!r) continue;
    const { sursa } = r;

    if (sursa !== "om" && r.extras.sistem !== null && estePreizolat(b.text)) {
      linii.push({
        bruta: b, sursa, preizolat: true, necesitaValidare: false,
        extras: { ...r.extras, sistem: null, motiv: "vine izolat de la producator: nu se izoleaza, nu se oferteaza" },
      });
      continue;
    }

    // Guardrails (bugul 1): nu pe regex — citeste direct din text, are teste
    // proprii — si nu pe corectia omului: validatorul exista ca sa verifice
    // MODELUL, nu omul care se uita la fisierul sursa.
    //
    // `notatieContraziceMaterialul` e insa APELATA SEPARAT, si pe regex: nu e
    // o verificare a increderii in model, e o verificare a TEXTULUI SURSA, care
    // spune ca notatia minte. SPIRO e prins chiar de `RE_DN` din
    // `extract-regex.ts`, deci pe calea determinista nu trecea pe la niciun
    // validator — si tocmai acolo `DN125` se tarifa tacut pe seria de otel,
    // cu +21%. Singura sursa exceptata ramane "om": el s-a uitat la fisier.
    const avertismente = sursa === "om" ? [] : [
      ...(sursa === "regex"
        ? []
        : valideazaExtragere(r.extras, { text: b.text, ...(b.um ? { um: b.um } : {}) })),
      ...notatieContraziceMaterialul(r.extras, b.text),
      ...diametruContrazisDeText(r.extras, b.text),
    ];

    // Increderea coboara la 0 cand ceva nu se verifica in text, la fel ca in
    // `aplicaValidarea` — dar AICI, nu doar in `extrageCuModel`. Un `Extractor`
    // conectat la nucleu (de test, sau chiar liniile deduse pe sablon, care nu
    // trec niciodata prin `extrageCuModel`) poate sa nu fi validat nimic:
    // fara pasul asta, o linie sablon cu un numar necitat ar ajunge pe ecran
    // cu increderea reprezentantului ei, nesuspecta. Idempotent pentru CLI:
    // acolo `extrageCuModel` a zerorizat-o deja, deci a doua zerorizare nu
    // schimba nimic.
    // Grosimea de la conducta de acelasi diametru completeaza o citire careia ii
    // lipsea DOAR grosimea: pe o linie citita de reguli, linia devine completa.
    const conducta = r.extras.grosime_mm === null ? deLaConducte.get(b.index) : undefined;
    // Grosimea scrisa, dar respinsa la extragere fiindca nu e in lista („g48"):
    // se pune inapoi, iar tarifarea o duce la cea mai apropiata, marcat.
    const scrisa = r.extras.grosime_mm === null && sursa !== "om"
      && (r.extras.sistem === "vata_minerala" || r.extras.sistem === "elastomer")
      ? grosimeScrisa(b.text) : null;
    const completat = conducta
      ? { ...r.extras, grosime_mm: conducta.grosime, ...(sursa === "regex" ? { incredere: 0.99 } : {}) }
      : scrisa !== null ? { ...r.extras, grosime_mm: scrisa } : r.extras;
    const golGasit = completat.sistem === "goluri_foc" && sursa !== "om"
      && (completat.gol_latime_mm === null || completat.gol_inaltime_mm === null)
      ? goluri.get(cheieTeava(b.text)) : undefined;
    const cuGol = golGasit
      ? { ...completat, gol_latime_mm: golGasit.latime, gol_inaltime_mm: golGasit.inaltime }
      : completat;
    const extras = avertismente.length > 0 ? { ...cuGol, incredere: 0 } : cuGol;

    // Grosimea propusa intra DUPA guardrails: nu vine din text, deci
    // `grosime_necitata` s-ar aprinde pe o valoare pe care chiar omul a cerut-o.
    // Fara grosime de nicaieri (nici scrisa, nici de la o conducta din lista):
    // grosimea uzuala a firmei dupa diametru, propusa si marcata, ca la butonul
    // „Pune grosimea uzuala". Nicio pozitie nu ramane fara pret doar pentru ca
    // lista clientului n-a scris grosimea.
    const uzuala = sursa !== "om" && extras.grosime_mm === null && extras.diametru_valoare !== null
      && extras.diametru_tip !== null && (extras.sistem === "vata_minerala" || extras.sistem === "elastomer")
      ? grosimePropusa(extras.sistem, extras.diametru_valoare, extras.diametru_tip) : null;
    const propusa = grosimiPropuse?.get(b.index) ?? uzuala ?? undefined;
    const cuPropunere = propusa !== undefined && extras.grosime_mm === null
      && extras.sistem !== null && extras.sistem !== "goluri_foc";
    const cuGrosime = cuPropunere ? { ...extras, grosime_mm: propusa } : extras;
    // Seria tevii dupa material (cupru, inox), doar cand textul o spune. Nu si
    // pe "om": acolo diametrul e cel pe care l-a pus omul.
    const serie = sursa === "om" ? null : serieDupaMaterial(cuGrosime, b.text);
    const cuSerie = serie?.extras ?? cuGrosime;
    // O jacheta pe care textul n-o numeste (`strat_necitat`) nu intra in pret.
    // Spitalul, „izolatie in grosime de 20 mm protejata cu folie" pe 50 de
    // randuri: modelul punea tabla (fata vatei caserate), 23,31 €/ml in loc de
    // 6,23. Avertismentul ramane, deci pozitia merge oricum la om.
    const necitate = avertismente.some((a) => a.cod === "strat_necitat")
      ? cuSerie.straturi_extra.filter((x) => JACHETE.has(x.sistem) && !sistemScris(b.text, x.sistem)) : [];
    const deTarifat = necitate.length
      ? { ...cuSerie, straturi_extra: cuSerie.straturi_extra.filter((x) => !necitate.includes(x)) }
      : cuSerie;

    // Descrierea schimbata dupa verificare: linia a fost recitita din textul
    // nou, deci ce a vazut omul nu mai e ce se tarifeaza. Nu si pe "om": o noua
    // confirmare e chiar raspunsul.
    const schimbata = sursa !== "om" && (descrieriSchimbate?.has(b.index) ?? false);

    const proc: LinieProcesata = {
      bruta: b, extras: deTarifat, sursa,
      ...(avertismente.length ? { avertismente } : {}),
      necesitaValidare: sursa !== "om" && extras.sistem !== null
        && (extras.incredere < prag || avertismente.length > 0 || schimbata),
    };

    // Textul intra in regulile de forma si straturi doar cand nu e linia
    // omului: acolo el a decis. Ce lucrare e randul ramane insa cea scrisa de client.
    const t = tarifeazaExtras(deTarifat, b.cantitate ?? 1, destinatie, sursa === "om" ? undefined : b.text, b.text);
    if (t.pret && conducta) {
      t.pret.note = [...(t.pret.note ?? []),
        `grosime ${conducta.grosime} mm luata de la conducta de acelasi diametru din lista (randul ${conducta.rand}); `
        + "clientul n-a scris-o pe randul asta"];
      if (conducta.vecina !== undefined) {
        const n = `nicio conducta de acelasi diametru in lista: grosimea e de la conducta cea mai apropiata, ø${conducta.vecina}`;
        t.pret.note.push(n);
        t.pret.noteDeVerificat = [...(t.pret.noteDeVerificat ?? []), n];
        t.pret.motiveDeVerificat = [...(t.pret.motiveDeVerificat ?? []), "grosime_propusa"];
      }
      if (conducta.alternative) {
        const n = `conductele de acelasi diametru au ${conducta.alternative.join(" si ")} mm: s-a luat ${conducta.grosime} mm`;
        t.pret.note.push(n);
        t.pret.noteDeVerificat = [...(t.pret.noteDeVerificat ?? []), n];
        t.pret.motiveDeVerificat = [...(t.pret.motiveDeVerificat ?? []), "grosime_propusa"];
      }
    }
    // Forma scrisa explicit in text („- COT") a batut UM-ul: se spune pe pozitie.
    if (t.pret && b.um && /^(ml|m|lm)$/i.test(b.um.trim()) && deTarifat.forma !== null
        && deTarifat.forma === formaExplicitaDinText(b.text)) {
      t.pret.note = [...(t.pret.note ?? []),
        `UM-ul e "${b.um}", dar textul spune "${deTarifat.forma}": tarifat ca ${deTarifat.forma}, ca in Oferta 284`];
    }
    if (t.pret && serie) {
      t.pret.note = [...(t.pret.note ?? []), serie.nota];
      t.pret.noteDeVerificat = [...(t.pret.noteDeVerificat ?? []), serie.nota];
      t.pret.motiveDeVerificat = [...(t.pret.motiveDeVerificat ?? []), serie.motiv];
    }
    if (t.pret && cuPropunere) {
      const n = `grosime ${propusa} mm propusa dupa diametru (grosimea uzuala a firmei), nu scrisa de client`;
      t.pret.note = [...(t.pret.note ?? []), n];
      t.pret.noteDeVerificat = [...(t.pret.noteDeVerificat ?? []), n];
      t.pret.motiveDeVerificat = [...(t.pret.motiveDeVerificat ?? []), "grosime_propusa"];
    }
    if (t.pret && necitate.length) {
      const n = `${necitate.map((x) => x.sistem).join(", ")}: nu e numit in text, scos din pret`;
      t.pret.note = [...(t.pret.note ?? []), n];
    }
    if (t.pret && golGasit) {
      const n = `golul nu e scris pe rand: ${golGasit.latime}/${golGasit.inaltime}, de la aceeasi teava din fisier`;
      t.pret.note = [...(t.pret.note ?? []), n];
      t.pret.noteDeVerificat = [...(t.pret.noteDeVerificat ?? []), n];
      t.pret.motiveDeVerificat = [...(t.pret.motiveDeVerificat ?? []), "gol_de_la_aceeasi_teava"];
    }
    // Grosimea data ca interval („20 to 50mm", „0.6 – 0.8 mm"): s-a luat capatul
    // de sus (extragerea determinista, `capatulDeSus`). Pe model, avertismentul
    // `grosime_interval` o trimite deja la om.
    if (t.pret && "straturi" in t.pret && sursa !== "om" && sursa !== "model" && areIntervalDeGrosime(b.text)) {
      const n = "clientul a dat grosimea ca interval: s-a luat capatul de sus";
      t.pret.note = [...(t.pret.note ?? []), n];
      t.pret.noteDeVerificat = [...(t.pret.noteDeVerificat ?? []), n];
      t.pret.motiveDeVerificat = [...(t.pret.motiveDeVerificat ?? []), "grosime_interval"];
    }
    if (t.pret && schimbata) {
      const n = "descrierea s-a schimbat dupa ce pozitia fusese verificata; e recitita din textul nou";
      t.pret.note = [...(t.pret.note ?? []), n];
      t.pret.noteDeVerificat = [...(t.pret.noteDeVerificat ?? []), n];
      t.pret.motiveDeVerificat = [...(t.pret.motiveDeVerificat ?? []), "descriere_schimbata"];
    }
    // Forma a venit din UM (ml/mp), dar textul numeste un element: Oferta 284,
    // „Di169, g50 - COT" cu UM `ml` iesea 51,44 € „Gata", oferta semnata are
    // cotul, 102,88 €. Nu stim care greseste, deci se pastreaza UM-ul si se
    // marcheaza — dar numai daca cele doua forme chiar dau alt pret: la Di76
    // cotul de vata are coeficient 1, iar un semnal fara efect nu mai e citit.
    if (t.pret && sursa !== "om" && b.um && deTarifat.sistem !== "goluri_foc"
        && (deTarifat.forma === "ml" || deTarifat.forma === "mp")) {
      const dinText = formaElementDinText(b.text);
      if (dinText) {
        const alt = tarifeazaExtras({ ...deTarifat, forma: dinText }, b.cantitate ?? 1, destinatie);
        if (alt.pret?.pret_unitar !== t.pret.pret_unitar) {
          const n = `UM-ul "${b.um}" da ${t.pret.pret_unitar} €, dar textul spune "${dinText}", care `
            + (alt.pret ? `da ${alt.pret.pret_unitar} €` : "nu se poate tarifa") + "; s-a pastrat UM-ul";
          t.pret.note = [...(t.pret.note ?? []), n];
          t.pret.noteDeVerificat = [...(t.pret.noteDeVerificat ?? []), n];
          t.pret.motiveDeVerificat = [...(t.pret.motiveDeVerificat ?? []), "forma_contrazisa"];
        }
      }
    }
    // UM-ul e bucata, dar textul nu numeste nicio piesa (cot, teu, flansa ...):
    // forma cade pe ml, deci cantitatea in bucati se inmulteste cu un pret pe
    // metru. Pe `cerere-de-oferta-spital.xlsx`, randurile 26–28 („Izolatie din
    // spuma elastomerica ... Dn 100", 750 buc.) ieseau „Gata". Daca bucata e
    // tubul de 2 m, pretul e jumatate. Nicio oferta semnata n-are izolatie
    // dreapta in bucati, deci nu exista regula de dedus: pretul ramane pe ml,
    // dar pozitia merge la om.
    // Echipamentul se tarifeaza chiar pe bucata (suprafata lui), deci nu intra aici.
    if (t.pret && sursa !== "om" && extras.forma === null && deTarifat.sistem !== "goluri_foc"
        && b.um && RE_UM_BUCATA.test(b.um.trim()) && !("suprafata_mp" in t.pret)) {
      const n = `UM-ul e "${b.um.trim()}", dar textul nu numeste nicio piesa: pretul e pe metru liniar`;
      t.pret.note = [...(t.pret.note ?? []), n];
      t.pret.noteDeVerificat = [...(t.pret.noteDeVerificat ?? []), n];
      t.pret.motiveDeVerificat = [...(t.pret.motiveDeVerificat ?? []), "um_bucata"];
    }
    if (t.pret) proc.pret = t.pret;
    // Doar notele care CER ochi opresc linia la validare: pretul venit din
    // lista altui segment, rotunjirea neconfirmata, grosimea propusa. Regula
    // "cot/teu de vata sub o60 nu intra in pret" era si ea aici pana cand
    // firma a confirmat-o (11 sep 2026): nota ramane, dar nu mai cheama omul.
    //
    // Nu si pe "om": confirmarea ESTE raspunsul la nota. Fara exceptia asta, o
    // pozitie confirmata ramanea marcata la nesfarsit si nu ajungea niciodata
    // pe foaia `Ofertă` — butonul de confirmare n-avea niciun efect pe ea.
    if (sursa !== "om" && t.pret?.noteDeVerificat?.length && cereOchi(t.pret.motiveDeVerificat)) {
      proc.necesitaValidare = true;
    }
    // Regulile de citire au lasat randul incomplet, dar o regula dovedita l-a
    // completat (golul de la aceeasi teava, grosimea cea mai apropiata, D si L
    // la echipament): pretul e al regulii, deci nu mai cere ochi.
    if (sursa === "regex" && t.pret && !avertismente.length && !schimbata
        && t.pret.motiveDeVerificat?.length && !cereOchi(t.pret.motiveDeVerificat)) {
      proc.necesitaValidare = false;
    }
    if (t.eroare !== undefined) {
      proc.eroare = t.eroare;
      if (t.codEroare !== undefined) proc.codEroare = t.codEroare;
      // Nu si pe "om": omul s-a uitat la fisierul sursa, nu la o propunere a
      // modelului. Ramane netarifata si vizibila prin `eroare`/absenta lui
      // `pret`, dar nu intra la coada de validare de plauzibilitate.
      if (sursa !== "om") proc.necesitaValidare = true;
    }
    const manual = extras.sistem !== null ? preturiManuale?.get(b.index) : undefined;
    if (manual !== undefined) {
      const cantitate = b.cantitate ?? 1;
      const dinListe = t.pret ? `din liste iesea ${t.pret.pret_unitar} €` : `din liste: ${t.eroare ?? "fara pret"}`;
      proc.pret = {
        straturi: [], pret_unitar: bani(manual), multiplicator: 1, cantitate,
        total: bani(manual * cantitate), moneda: "EUR", manual: true,
        note: [`pret unitar pus de om: ${bani(manual)} €; ${dinListe}`],
      };
      delete proc.eroare;
      delete proc.codEroare;
      proc.necesitaValidare = false;
    }
    linii.push(proc);
  }
  return linii;
}

/**
 * Motivele care NU mai opresc pozitia la „De verificat” (10 octombrie 2026,
 * Andrei: scopul e sa nu verifice omul linie cu linie). Pretul iese dintr-o
 * regula dovedita; nota ramane pe pozitie, ca sa se vada de unde vine.
 *
 * Opresc in continuare doar: ce firma a spus ca decide omul (protectia la foc,
 * Conlit / Techrock), ce e ambiguu in textul clientului (interval de grosime,
 * bucati fara piesa numita, DN contrazis), ce contrazice o oferta semnata
 * (livrarea tevii NISAL; golurile EI180 fara dimensiuni de la Matari, lasate
 * fara pret in oferta semnata; formula peste lista, cu 0,13 € sub SPIRO ø250 /
 * ø315 si PEHD D250 din NISAL), extrapolarile fara dovada si citirile nesigure
 * ale modelului. Un motiv intra aici doar cu dovada scrisa langa el: fiecare
 * pozitie „Gata” din ofertele semnate iese exact ca semnat (sau pe regula
 * spusa de firma, unde semnatul s-a abatut de la ea: ø90 / ø160, randul de sus).
 */
export const MOTIVE_DOVEDITE: ReadonlySet<MotivVerificare> = new Set<MotivVerificare>([
  // Oferta 284: 7,90 € dedus, exact ca semnat.
  "celula_dedusa",
  // Oferta 284: distribuitorul, 2.296,70 € exact.
  "echipament_suprafata",
  // Tabelul de grosimi uzuale al firmei (11 septembrie) si grosimea conductei
  // de acelasi diametru (casetele din Oferta 284, 24 din 24).
  "grosime_propusa",
  // Grosimea cea mai apropiata din lista (20 → 19 la elastomer, 3 din 3 in ofertele
  // semnate; „min 0,5 mm” → 0,6, cea mai subtire care o acopera).
  "grosime_apropiata",
  "grosime_jacheta_apropiata",
  // Tabla pe mp: 0,8 e identic in ambele liste, deci pretul pe mp nu depinde de segment.
  "mp_din_celalalt_segment",
  // Seria de cupru din registrul de conversie al firmei.
  "serie_cupru",
]);

/** Pozitia cere ochi daca are macar un motiv nedovedit (sau o nota fara motiv). */
export const cereOchi = (motive: readonly MotivVerificare[] | undefined): boolean =>
  !motive?.length || motive.some((m) => !MOTIVE_DOVEDITE.has(m));

/** Partea de `Statistici` care se recalculeaza intotdeauna din `linii`. */
/** „- manopera :" din antetele de sectiune ale ofertelor de manopera. */
const RE_MANOPERA = /manoper/i;

function statisticiDeterministe(
  foi: FoaieBruta[], foiMapate: number, brute: LinieCuSectiune[], linii: LinieProcesata[],
): Omit<Statistici, "trimiseLaModel" | "reziduale" | "modelFaraRaspuns" | "trunchiat"> {
  const izolatie = linii.filter((l) => l.extras.sistem !== null);
  const faraMasura = brute.filter((b) => b.um === undefined && b.cantitate === undefined).length;
  return {
    foi: foi.length,
    foiMapate,
    total: brute.length,
    liniiIzolatie: izolatie.length,
    prinRegex: izolatie.filter((l) => l.sursa === "regex").length,
    prinModel: izolatie.filter((l) => l.sursa === "model").length,
    prinSablon: izolatie.filter((l) => l.sursa === "sablon").length,
    prinMemorie: izolatie.filter((l) => l.sursa === "memorie").length,
    prinOm: izolatie.filter((l) => l.sursa === "om").length,
    faraMasura,
    tarifate: izolatie.filter((l) => l.pret).length,
    deValidat: izolatie.filter((l) => l.necesitaValidare).length,
    cuAvertisment: izolatie.filter((l) => l.avertismente?.length).length,
    netarifate: izolatie.filter((l) => !l.pret).length,
    preizolate: linii.filter((l) => l.preizolat).length,
    // Se numara pe RANDURILE BRUTE, nu pe pozitii: intr-o oferta de manopera
    // marcajul sta in antetele de sectiune, iar alea nu sunt pozitii — daca
    // s-ar cauta doar in pozitii, exact fisierul care are nevoie de semnal ar
    // iesi cu zero.
    randuriManopera: brute.filter((b) => RE_MANOPERA.test(b.text)).length,
    // Ca in ofertele firmei: suma valorilor exacte, rotunjita o data (vezi
    // `totalOferta` din web/oferta.ts).
    valoareTotala: Math.round(izolatie.reduce(
      (s, l) => s + (l.pret ? l.pret.pret_unitar * l.pret.cantitate : 0), 0) * 100) / 100,
  };
}

/**
 * L1 pe fiecare foaie: maparea cunoscuta, altfel doar coloana de cantitate din
 * antet (`aplicaCantitateDinAntet`). Intoarce cate foi au avut mapare.
 */
function mapeazaFoi(foi: FoaieBruta[], o: OptiuniNucleu): number {
  let foiMapate = 0;
  for (const foaie of foi) {
    const m = o.mapari?.get(amprentaFoaie(foaie));
    if (m) { aplicaMapare(foaie, m.mapare); foiMapate++; }
    else aplicaCantitateDinAntet(foaie);
  }
  return foiMapate;
}

/**
 * L0-L4 peste un registru deja parsat (`FoaieBruta[]`), pana la tarifare.
 *
 * Ordinea e cea din pipeline-ul de CLI de dinainte de nucleu, plus randurile
 * de continuare (`aplicaContinuare`), care lipseau de peste tot:
 *
 *   L1 mapare -> sectiuni + continuare -> L2a regex -> L4 memorie ->
 *   L2b model (dedup pe sablon, buget comun) -> guardrails -> L3 tarifare
 *
 * Nu prinde exceptiile aruncate de `o.extrage`: toleranta la erori de
 * transport (un lot cazut, un timeout) e treaba apelantului — ecranul prinde
 * per lot si continua, CLI-ul lasa sa crape. Amestecarea celor doua politici
 * aici ar insemna sa aleaga nucleul in locul apelantului.
 */
export async function proceseazaRegistru(foi: FoaieBruta[], o: OptiuniNucleu): Promise<Rezultat> {
  const prag = o.prag ?? 0.85;

  // L1 - maparea de coloane, daca layoutul foii e deja cunoscut. Muta datele
  // PE LOC (`aplicaMapare`), inainte de contextul de sectiune si de extragere.
  const foiMapate = mapeazaFoi(foi, o);
  o.laProgres?.({ faza: "mapare", gata: foiMapate, total: foi.length });

  // L0b + randurile de continuare ("Same - O125 mm" din cerere-de-oferta-book15.xlsx): fara ele,
  // 19 din cele 24 de pozitii ale fisierului ies neclasificate.
  const brute = aplicaContinuare(adaugaSectiuni(liniile(foi)));

  // L2a - determinist
  const rezolvate = new Map<number, Rezolvare>();
  const reziduale: LinieSursa[] = [];
  const partiale = new Map<number, LinieExtrasa>();
  for (const b of brute) {
    const r = extrageDeterminist(b.index, b.text, b.um, b.sectiune, b.cantitate);
    if (r.complet) rezolvate.set(b.index, { extras: r.linie, sursa: "regex" });
    else {
      reziduale.push({
        index: b.index, text: b.text, ...(b.um ? { um: b.um } : {}), ...(b.sectiune ? { sectiune: b.sectiune } : {}),
      });
      if (r.linie.sistem !== null) partiale.set(b.index, r.linie);
    }
  }
  o.laProgres?.({ faza: "determinist", gata: rezolvate.size, total: brute.length });

  // L4 - memoria de sabloane: ce a corectat omul deja nu se mai intreaba.
  const dinMemorie = aplicaMemorie(reziduale, o.stoc);
  for (const e of dinMemorie.rezolvate) rezolvate.set(e.index, { extras: e, sursa: "memorie" });
  const deLucrat = completeazaDinConducte(brute, rezolvate, partiale, dinMemorie.ramase);
  o.laProgres?.({ faza: "memorie", gata: rezolvate.size, total: brute.length });

  // L2b - model, doar pe rest, cate un reprezentant per sablon, cu un buget
  // COMUN celor doua treceri (bugul 3: ecranul il taia separat pe fiecare
  // trecere, deci putea trimite pana la 2x plafonul, iar a doua taiere nici nu
  // se aduna in `trunchiat`).
  const maxModel = o.maxLiniiModel ?? 400;
  let trimise = 0;
  let trunchiat = 0;
  let faraRaspuns = 0;
  if (o.extrage && deLucrat.length > 0) {
    let buget = maxModel;
    const grupuri = grupeazaPeSablon(deLucrat);
    const reprezentanti = grupuri.map((g) => g.reprezentant);

    const deTrimis1 = reprezentanti.slice(0, buget);
    trunchiat += reprezentanti.length - deTrimis1.length;
    buget -= deTrimis1.length;

    const raspunse = new Set<number>();
    const extrase = deTrimis1.length > 0
      ? doarLiniileTrimise(await o.extrage(deTrimis1, { faza: "reprezentanti" }), deTrimis1)
      : [];
    for (const e of extrase) {
      raspunse.add(e.index);
      puneDinModel(rezolvate, partiale, e, "model");
    }

    const { proiectate, ramase } = extindePeSablon(grupuri, extrase);
    for (const p of proiectate) puneDinModel(rezolvate, partiale, p, "sablon");

    // Ce n-a putut fi proiectat merge la model ca orice alta linie, sub
    // ACELASI buget — nu unul nou.
    const deTrimis2 = ramase.slice(0, buget);
    trunchiat += ramase.length - deTrimis2.length;

    const extrase2 = deTrimis2.length > 0
      ? doarLiniileTrimise(await o.extrage(deTrimis2, { faza: "ramase" }), deTrimis2)
      : [];
    for (const e of extrase2) {
      raspunse.add(e.index);
      puneDinModel(rezolvate, partiale, e, "model");
    }

    trimise = deTrimis1.length + deTrimis2.length;
    // Contractul e "cate un obiect per linie, cu acelasi index". Modelul il
    // incalca in tacere (bugul 2): masurat pe `oferta-118-nisal.xlsx`, 43 de
    // linii trimise, 35 intoarse — si disparitia lor nu se vedea nicaieri pe
    // ecran, doar in CLI. Se numara doar ce s-a TRIMIS efectiv, nu tot
    // reziduul: liniile netrimise din cauza plafonului sunt `trunchiat`, nu
    // "fara raspuns". Se numara pe ce a RASPUNS modelul, nu pe `rezolvate`:
    // un `null` refuzat de `puneDinModel` e tot un raspuns.
    const trimiseToate = [...deTrimis1, ...deTrimis2];
    faraRaspuns = trimiseToate.filter((r) => !raspunse.has(r.index)).length;

    o.laProgres?.({ faza: "model", gata: trimise, total: trimise + trunchiat });
  }

  // Guardrails + L3
  completeazaCuPartiale(rezolvate, partiale);
  stampileazaText(brute, rezolvate);
  const linii = construiesteLinii(
    brute, rezolvate, prag, o.destinatie ?? "rezidential", o.grosimiPropuse, o.descrieriSchimbate, o.preturiManuale,
  );
  o.laProgres?.({ faza: "tarifare", gata: linii.length, total: brute.length });

  const statistici: Statistici = {
    ...statisticiDeterministe(foi, foiMapate, brute, linii),
    trimiseLaModel: trimise,
    reziduale: reziduale.length,
    modelFaraRaspuns: faraRaspuns,
    trunchiat,
  };

  return { foi, brute, rezolvate, linii, statistici };
}

/**
 * Re-ruleaza tot ce e determinist, dupa o corectie facuta in grila
 * (`scrieCelula` + `reconstruieste`) sau in coloanele extrase (`sursa: "om"`).
 *
 * Reface TOT, nu peticeste chirurgical linia atinsa: o corectie poate schimba
 * un antet de sectiune sau descrierea-parinte a unui rand de continuare, deci
 * efectul ei nu e local la randul editat. Si o cale de recalcul separata de
 * `proceseazaRegistru` ar drifta de ea exact cum a driftat ecranul de
 * pipeline — motivul pentru care exista nucleul asta.
 *
 * NU cheama modelul: e sincrona si O(n) — pe un fisier de 400 de randuri costa
 * milisecunde, deci se poate rula dupa fiecare tasta, nu doar la salvare.
 *
 * O linie cu `sursa: "om"` nu se re-extrage aici cat timp textul ei e cel pe
 * care l-a vazut omul: corectia lui bate orice strat. Daca descrierea s-a
 * schimbat de atunci, corectia nu mai descrie randul — linia se reciteste ca
 * oricare alta si intra in `descrieriSchimbate`. La fel extragerea modelului:
 * pastrata doar pe textul pe care l-a citit.
 */
export function reevalueaza(rez: Rezultat, o: OptiuniNucleu): void {
  const prag = o.prag ?? 0.85;

  const foiMapate = mapeazaFoi(rez.foi, o);

  const brute = aplicaContinuare(adaugaSectiuni(liniile(rez.foi)));
  rez.brute = brute;

  const vechi = rez.rezolvate;
  const rezolvate = new Map<number, Rezolvare>();
  const schimbate = o.descrieriSchimbate ?? new Set<number>();

  // Trecerea 1: liniile confirmate de om raman pe loc si nu intra in
  // candidatii pentru determinist/memorie de mai jos — cat timp textul lor e
  // cel pe care l-a vazut omul. Altfel corectia lui nu mai descrie randul:
  // linia se reciteste ca oricare alta si trece la „de verificat".
  const candidati: LinieCuSectiune[] = [];
  for (const b of brute) {
    const existent = vechi.get(b.index);
    if (existent?.sursa === "om") {
      if ((existent.text ?? b.text) === b.text) {
        rezolvate.set(b.index, { ...existent, text: b.text });
        schimbate.delete(b.index);
        continue;
      }
      schimbate.add(b.index);
    }
    candidati.push(b);
  }

  // Trecerea 2: determinist, pe restul.
  const reziduale: LinieSursa[] = [];
  const partiale = new Map<number, LinieExtrasa>();
  for (const b of candidati) {
    const r = extrageDeterminist(b.index, b.text, b.um, b.sectiune, b.cantitate);
    if (r.complet) rezolvate.set(b.index, { extras: r.linie, sursa: "regex" });
    else {
      reziduale.push({
        index: b.index, text: b.text, ...(b.um ? { um: b.um } : {}), ...(b.sectiune ? { sectiune: b.sectiune } : {}),
      });
      if (r.linie.sistem !== null) partiale.set(b.index, r.linie);
    }
  }

  // Trecerea 3: memorie, pe ce a ramas dupa determinist.
  const dinMemorie = aplicaMemorie(reziduale, o.stoc);
  for (const e of dinMemorie.rezolvate) rezolvate.set(e.index, { extras: e, sursa: "memorie" });

  // Ce nici memoria n-a rezolvat pastreaza extragerea veche, DOAR daca venea
  // de la model sau de la sablon — nu exista de unde s-o recitim fara sa
  // rechemam modelul, iar `reevalueaza` n-are voie sa faca asta. Si doar pe
  // textul pe care l-a citit modelul: pe o descriere schimbata ar tarifa
  // descrierea veche, deci ramane ce se poate citi determinist, marcat.
  for (const l of completeazaDinConducte(brute, rezolvate, partiale, dinMemorie.ramase)) {
    const existent = vechi.get(l.index);
    if (existent && (existent.sursa === "model" || existent.sursa === "sablon")) {
      if ((existent.text ?? l.text) === l.text) rezolvate.set(l.index, existent);
      else schimbate.add(l.index);
    }
  }

  completeazaCuPartiale(rezolvate, partiale);
  stampileazaText(brute, rezolvate);
  rez.rezolvate = rezolvate;
  rez.linii = construiesteLinii(
    brute, rezolvate, prag, o.destinatie ?? "rezidential", o.grosimiPropuse, schimbate, o.preturiManuale,
  );
  rez.statistici = {
    ...statisticiDeterministe(rez.foi, foiMapate, brute, rez.linii),
    // Astea descriu apelul la model care a produs starea INITIALA a lui `rez`;
    // `reevalueaza` nu cheama modelul, deci n-are ce sa recalculeze aici —
    // raman cele de dinainte de corectie.
    trimiseLaModel: rez.statistici.trimiseLaModel,
    reziduale: rez.statistici.reziduale,
    modelFaraRaspuns: rez.statistici.modelFaraRaspuns,
    trunchiat: rez.statistici.trunchiat,
  };
}

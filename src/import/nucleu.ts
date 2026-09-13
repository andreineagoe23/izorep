import { liniile, type FoaieBruta, type LinieBruta } from "./rand.js";
import type { Destinatie } from "../pricing/lists.js";
import { amprentaFoaie, aplicaMapare } from "./mapare.js";
// Type-only: precedentul e in mapari-statice.ts. `cache-mapari.ts` scrie pe
// disc cu `node:fs` — importat ca valoare aici, ar trage Node in bundle-ul de
// browser. Ca tip, dispare la compilare si nu ramane nimic in JS emis.
import type { MapareSalvata } from "./cache-mapari.js";
import { adaugaSectiuni, type LinieCuSectiune } from "./sectiuni.js";
import { aplicaContinuare } from "./continuare.js";
import { extrageDeterminist } from "./extract-regex.js";
import {
  notatieContraziceMaterialul, valideazaExtragere,
  type Avertisment, type CodAvertisment,
} from "./valideaza.js";
import { grupeazaPeSablon, extindePeSablon, type LinieSursa } from "./sabloane.js";
import { aplicaMemorie, type StocSabloane } from "./memorie.js";
import type { LinieExtrasa, Sursa } from "./schema.js";
import { tarifeaza } from "../pricing/engine.js";
import { tarifeazaGolFoc } from "../pricing/goluri-foc.js";
import {
  PozitieNetarifata,
  type CodNetarifare, type RezultatGolFoc, type RezultatTarifare,
} from "../pricing/types.js";
import { DiametruNecunoscut } from "../pricing/dn-table.js";

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

export interface Rezultat {
  foi: FoaieBruta[];
  brute: LinieCuSectiune[];
  rezolvate: Map<number, { extras: LinieExtrasa; sursa: Sursa }>;
  linii: LinieProcesata[];
  statistici: Statistici;
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
    if (extras.sistem && extras.diametru_valoare !== null && extras.diametru_tip) {
      const pret = tarifeaza({
        diametru: { valoare: extras.diametru_valoare, tip: extras.diametru_tip },
        straturi: [
          { sistem: extras.sistem, ...(extras.grosime_mm !== null ? { grosime_mm: extras.grosime_mm } : {}) },
          ...extras.straturi_extra.map((s) => ({
            sistem: s.sistem, ...(s.grosime_mm !== null ? { grosime_mm: s.grosime_mm } : {}),
          })),
        ],
        forma: extras.forma ?? "ml",
        cantitate,
        destinatie,
      });
      return { pret };
    }

    // Sistemul e cunoscut, dar diametrul nu — deci nu se poate cauta NICIUN
    // rand: listele sunt indexate doar pe o. Pana acum aici se intorcea `{}`,
    // adica pozitia ramanea fara pret, fara eroare, fara cod si — daca modelul
    // raportase incredere peste prag — fara sa fie nici macar marcata. Se vedea
    // exclusiv ca diferenta intre doua contoare.
    //
    // Masurat pe golden files: doua pozitii din `Oferta 27.04.2026.xlsx`,
    // amandoua tubulatura RECTANGULARA (`Luftleitg. eckig`,
    // `Entrauchungskanal`, UM `m²`) — care chiar n-are diametru, ci A x B.
    // Conversia perimetrului e in `.claude/tevi.md` si nu e implementata.
    // Pana atunci pozitia se MARCHEAZA, ca oricare alta fara pret.
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
  rezolvate: Map<number, { extras: LinieExtrasa; sursa: Sursa }>,
  partiale: Map<number, LinieExtrasa>,
): void {
  for (const [index, extras] of partiale) {
    if (!rezolvate.has(index)) rezolvate.set(index, { extras, sursa: "regex" });
  }
}

/**
 * L3 + guardrails, pentru toata lista de linii brute rezolvate.
 *
 * Comun lui `proceseazaRegistru` si `reevalueaza`, ca sa nu poata drifta unul
 * fata de celalalt exact cum a driftat ecranul fata de pipeline.
 */
function construiesteLinii(
  brute: LinieCuSectiune[],
  rezolvate: Map<number, { extras: LinieExtrasa; sursa: Sursa }>,
  prag: number,
  destinatie: Destinatie,
  grosimiPropuse?: ReadonlyMap<number, number>,
): LinieProcesata[] {
  const linii: LinieProcesata[] = [];
  for (const b of brute) {
    const r = rezolvate.get(b.index);
    if (!r) continue;
    const { sursa } = r;

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
    ];

    // Increderea coboara la 0 cand ceva nu se verifica in text, la fel ca in
    // `aplicaValidarea` — dar AICI, nu doar in `extrageCuModel`. Un `Extractor`
    // conectat la nucleu (de test, sau chiar liniile deduse pe sablon, care nu
    // trec niciodata prin `extrageCuModel`) poate sa nu fi validat nimic:
    // fara pasul asta, o linie sablon cu un numar necitat ar ajunge pe ecran
    // cu increderea reprezentantului ei, nesuspecta. Idempotent pentru CLI:
    // acolo `extrageCuModel` a zerorizat-o deja, deci a doua zerorizare nu
    // schimba nimic.
    const extras = avertismente.length > 0 ? { ...r.extras, incredere: 0 } : r.extras;

    // Grosimea propusa intra DUPA guardrails: nu vine din text, deci
    // `grosime_necitata` s-ar aprinde pe o valoare pe care chiar omul a cerut-o.
    const propusa = grosimiPropuse?.get(b.index);
    const cuPropunere = propusa !== undefined && extras.grosime_mm === null
      && extras.sistem !== null && extras.sistem !== "goluri_foc";
    const deTarifat = cuPropunere ? { ...extras, grosime_mm: propusa } : extras;

    const proc: LinieProcesata = {
      bruta: b, extras: deTarifat, sursa,
      ...(avertismente.length ? { avertismente } : {}),
      necesitaValidare: sursa !== "om" && extras.sistem !== null
        && (extras.incredere < prag || avertismente.length > 0 || cuPropunere),
    };

    const t = tarifeazaExtras(deTarifat, b.cantitate ?? 1, destinatie);
    if (t.pret && cuPropunere) {
      const n = `grosime ${propusa} mm propusa dupa diametru (grosimea uzuala a firmei), nu scrisa de client`;
      t.pret.note = [...(t.pret.note ?? []), n];
      t.pret.noteDeVerificat = [...(t.pret.noteDeVerificat ?? []), n];
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
    if (sursa !== "om" && t.pret?.noteDeVerificat?.length) {
      proc.necesitaValidare = true;
    }
    if (t.eroare !== undefined) {
      proc.eroare = t.eroare;
      if (t.codEroare !== undefined) proc.codEroare = t.codEroare;
      // Nu si pe "om": omul s-a uitat la fisierul sursa, nu la o propunere a
      // modelului. Ramane netarifata si vizibila prin `eroare`/absenta lui
      // `pret`, dar nu intra la coada de validare de plauzibilitate.
      if (sursa !== "om") proc.necesitaValidare = true;
    }
    linii.push(proc);
  }
  return linii;
}

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
    // Se numara pe RANDURILE BRUTE, nu pe pozitii: intr-o oferta de manopera
    // marcajul sta in antetele de sectiune, iar alea nu sunt pozitii — daca
    // s-ar cauta doar in pozitii, exact fisierul care are nevoie de semnal ar
    // iesi cu zero.
    randuriManopera: brute.filter((b) => RE_MANOPERA.test(b.text)).length,
    valoareTotala: Math.round(izolatie.reduce((s, l) => s + (l.pret?.total ?? 0), 0) * 100) / 100,
  };
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
  let foiMapate = 0;
  if (o.mapari) {
    for (const foaie of foi) {
      const m = o.mapari.get(amprentaFoaie(foaie));
      if (!m) continue;
      aplicaMapare(foaie, m.mapare);
      foiMapate++;
    }
  }
  o.laProgres?.({ faza: "mapare", gata: foiMapate, total: foi.length });

  // L0b + randurile de continuare ("Same - O125 mm" din Book15.xlsx): fara ele,
  // 19 din cele 24 de pozitii ale fisierului ies neclasificate.
  const brute = aplicaContinuare(adaugaSectiuni(liniile(foi)));

  // L2a - determinist
  const rezolvate = new Map<number, { extras: LinieExtrasa; sursa: Sursa }>();
  const reziduale: LinieSursa[] = [];
  const partiale = new Map<number, LinieExtrasa>();
  for (const b of brute) {
    const r = extrageDeterminist(b.index, b.text, b.um, b.sectiune, b.cantitate);
    if (r.complet) rezolvate.set(b.index, { extras: r.linie, sursa: "regex" });
    else {
      reziduale.push({ index: b.index, text: b.text, ...(b.um ? { um: b.um } : {}) });
      if (r.linie.sistem !== null) partiale.set(b.index, r.linie);
    }
  }
  o.laProgres?.({ faza: "determinist", gata: rezolvate.size, total: brute.length });

  // L4 - memoria de sabloane: ce a corectat omul deja nu se mai intreaba.
  const dinMemorie = aplicaMemorie(reziduale, o.stoc);
  for (const e of dinMemorie.rezolvate) rezolvate.set(e.index, { extras: e, sursa: "memorie" });
  const deLucrat = dinMemorie.ramase;
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

    const extrase = deTrimis1.length > 0 ? await o.extrage(deTrimis1, { faza: "reprezentanti" }) : [];
    for (const e of extrase) rezolvate.set(e.index, { extras: e, sursa: "model" });

    const { proiectate, ramase } = extindePeSablon(grupuri, extrase);
    for (const p of proiectate) rezolvate.set(p.index, { extras: p, sursa: "sablon" });

    // Ce n-a putut fi proiectat merge la model ca orice alta linie, sub
    // ACELASI buget — nu unul nou.
    const deTrimis2 = ramase.slice(0, buget);
    trunchiat += ramase.length - deTrimis2.length;

    const extrase2 = deTrimis2.length > 0 ? await o.extrage(deTrimis2, { faza: "ramase" }) : [];
    for (const e of extrase2) rezolvate.set(e.index, { extras: e, sursa: "model" });

    trimise = deTrimis1.length + deTrimis2.length;
    // Contractul e "cate un obiect per linie, cu acelasi index". Modelul il
    // incalca in tacere (bugul 2): masurat pe `Oferta 27.04.2026.xlsx`, 43 de
    // linii trimise, 35 intoarse — si disparitia lor nu se vedea nicaieri pe
    // ecran, doar in CLI. Se numara doar ce s-a TRIMIS efectiv, nu tot
    // reziduul: liniile netrimise din cauza plafonului sunt `trunchiat`, nu
    // "fara raspuns".
    const trimiseToate = [...deTrimis1, ...deTrimis2];
    faraRaspuns = trimiseToate.filter((r) => !rezolvate.has(r.index)).length;

    o.laProgres?.({ faza: "model", gata: trimise, total: trimise + trunchiat });
  }

  // Guardrails + L3
  completeazaCuPartiale(rezolvate, partiale);
  const linii = construiesteLinii(brute, rezolvate, prag, o.destinatie ?? "rezidential", o.grosimiPropuse);
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
 * O linie cu `sursa: "om"` nu se re-extrage NICIODATA aici: corectia omului
 * bate orice strat, indiferent ce ar gasi determinismul sau memoria pe textul
 * (eventual schimbat de alte editari) al randului ei.
 */
export function reevalueaza(rez: Rezultat, o: OptiuniNucleu): void {
  const prag = o.prag ?? 0.85;

  let foiMapate = 0;
  if (o.mapari) {
    for (const foaie of rez.foi) {
      const m = o.mapari.get(amprentaFoaie(foaie));
      if (!m) continue;
      aplicaMapare(foaie, m.mapare);
      foiMapate++;
    }
  }

  const brute = aplicaContinuare(adaugaSectiuni(liniile(rez.foi)));
  rez.brute = brute;

  const vechi = rez.rezolvate;
  const rezolvate = new Map<number, { extras: LinieExtrasa; sursa: Sursa }>();

  // Trecerea 1: liniile confirmate de om raman pe loc, neatinse, si nu intra
  // in candidatii pentru determinist/memorie de mai jos.
  const candidati: LinieCuSectiune[] = [];
  for (const b of brute) {
    const existent = vechi.get(b.index);
    if (existent?.sursa === "om") { rezolvate.set(b.index, existent); continue; }
    candidati.push(b);
  }

  // Trecerea 2: determinist, pe restul.
  const reziduale: LinieSursa[] = [];
  const partiale = new Map<number, LinieExtrasa>();
  for (const b of candidati) {
    const r = extrageDeterminist(b.index, b.text, b.um, b.sectiune, b.cantitate);
    if (r.complet) rezolvate.set(b.index, { extras: r.linie, sursa: "regex" });
    else {
      reziduale.push({ index: b.index, text: b.text, ...(b.um ? { um: b.um } : {}) });
      if (r.linie.sistem !== null) partiale.set(b.index, r.linie);
    }
  }

  // Trecerea 3: memorie, pe ce a ramas dupa determinist.
  const dinMemorie = aplicaMemorie(reziduale, o.stoc);
  for (const e of dinMemorie.rezolvate) rezolvate.set(e.index, { extras: e, sursa: "memorie" });

  // Ce nici memoria n-a rezolvat pastreaza extragerea veche, DOAR daca venea
  // de la model sau de la sablon — nu exista de unde s-o recitim fara sa
  // rechemam modelul, iar `reevalueaza` n-are voie sa faca asta.
  for (const l of dinMemorie.ramase) {
    const existent = vechi.get(l.index);
    if (existent && (existent.sursa === "model" || existent.sursa === "sablon")) {
      rezolvate.set(l.index, existent);
    }
  }

  completeazaCuPartiale(rezolvate, partiale);
  rez.rezolvate = rezolvate;
  rez.linii = construiesteLinii(brute, rezolvate, prag, o.destinatie ?? "rezidential", o.grosimiPropuse);
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

import { parseFoi, liniile, type LinieBruta } from "./parse-workbook.js";
import { amprentaFoaie, aplicaMapare } from "./mapare.js";
import { citesteMapari } from "./cache-mapari.js";
import { adaugaSectiuni } from "./sectiuni.js";
import { extrageDeterminist } from "./extract-regex.js";
import { extrageCuModel, type OptiuniModel } from "./extract-llm.js";
import { valideazaExtragere, type Avertisment } from "./valideaza.js";
import { grupeazaPeSablon, extindePeSablon } from "./sabloane.js";
import { aplicaMemorie, type StocSabloane } from "./memorie.js";
import { stocPeDisc } from "./stoc-sabloane.js";
import type { LinieExtrasa, Sursa } from "./schema.js";
import { tarifeaza } from "../pricing/engine.js";
import { tarifeazaGolFoc } from "../pricing/goluri-foc.js";
import {
  PozitieNetarifata,
  type RezultatGolFoc, type RezultatTarifare,
} from "../pricing/types.js";

export type { Sursa } from "./schema.js";

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
  /** Motivul pentru care linia nu s-a putut tarifa. */
  eroare?: string;
  /**
   * Ce n-a trecut de validarea de plauzibilitate. Se recalculeaza aici, desi
   * `extrageCuModel` a aplicat deja aceleasi reguli: acolo efectul e coborarea
   * increderii, ca sa nu poata fi sarita de niciun apelant; aici e nevoie de
   * lista in forma structurata, pentru raport si pentru ecranul de validare.
   * Functia e pura, deci a doua trecere nu costa nimic.
   */
  avertismente?: Avertisment[];
  /** true daca linia trebuie sa treaca prin ecranul de validare umana. */
  necesitaValidare: boolean;
}

export interface RaportImport {
  fisier: string;
  /** Cate foi are registrul si pentru cate exista mapare de coloane (L1). */
  foi: number;
  foiMapate: number;
  total: number;
  liniiIzolatie: number;
  prinRegex: number;
  prinModel: number;
  tarifate: number;
  deValidat: number;
  /** Linii pe care modelul a produs ceva ce nu se verifica in textul sursa. */
  cuAvertisment: number;
  /** Linii deduse dintr-o linie geamana din acelasi fisier. */
  prinSablon: number;
  /** Linii rezolvate din memoria de sabloane, fara apel la model. */
  prinMemorie: number;
  /**
   * Randuri cu text dar fara unitate de masura si fara cantitate — note,
   * titluri, semnaturi. Nu sunt pozitii. Se numara ca sa se vada daca intr-un
   * fisier nou incepe sa cada ceva real in categoria asta.
   */
  faraMasura: number;
  /** Cate linii au plecat efectiv la model, din cate reziduale erau. */
  trimiseLaModel: number;
  reziduale: number;
  /** Linii trimise la model pentru care nu a intors niciun obiect. */
  modelFaraRaspuns: number;
  netarifate: number;
  valoareTotala: number;
  linii: LinieProcesata[];
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
): { pret?: RezultatTarifare | RezultatGolFoc; eroare?: string } {
  try {
    if (extras.sistem === "goluri_foc") {
      if (extras.gol_latime_mm === null || extras.gol_inaltime_mm === null) {
        throw new PozitieNetarifata(
          "inchidere gol la foc fara dimensiunea golului; pretul vine din suprafata lui",
          { index: extras.index },
        );
      }
      return {
        pret: tarifeazaGolFoc({
          gol: { latime_mm: extras.gol_latime_mm, inaltime_mm: extras.gol_inaltime_mm },
          cantitate,
        }),
      };
    }
    if (extras.sistem && extras.diametru_valoare !== null && extras.diametru_tip) {
      return {
        pret: tarifeaza({
          diametru: { valoare: extras.diametru_valoare, tip: extras.diametru_tip },
          straturi: [
            { sistem: extras.sistem, ...(extras.grosime_mm !== null ? { grosime_mm: extras.grosime_mm } : {}) },
            ...extras.straturi_extra.map((s) => ({
              sistem: s.sistem, ...(s.grosime_mm !== null ? { grosime_mm: s.grosime_mm } : {}),
            })),
          ],
          forma: extras.forma ?? "ml",
          cantitate,
        }),
      };
    }
    return {};
  } catch (e) {
    return { eroare: e instanceof PozitieNetarifata ? e.message : String(e) };
  }
}

/**
 * Pipeline-ul de import, L0 -> L4.
 *
 * Ce NU face: nu scrie in baza de date si nu emite nimic. Produce un raport
 * pe care omul il confirma. Nicio linie nu devine deviz fara acel pas.
 */
export async function importaFisier(
  cale: string,
  optiuni: OptiuniModel & {
    pragIncredere?: number;
    faraModel?: boolean;
    faraMapare?: boolean;
    /** Memoria de sabloane. Implicit cea de pe disc; teste dau alta. */
    stoc?: StocSabloane;
  } = {},
): Promise<RaportImport> {
  const prag = optiuni.pragIncredere
    ?? Number(process.env["IZOREP_CONFIDENCE_THRESHOLD"] ?? 0.85);

  // L1 - maparea de coloane, daca layoutul foii e deja cunoscut.
  //
  // Se aplica INAINTE de contextul de sectiune si de extragere: schimba textul
  // liniei (doar coloana de denumire, nu concatenarea tuturor celulelor),
  // unitatea de masura si cantitatea, deci tot ce urmeaza lucreaza pe date
  // mapate, nu ghicite. Fara mapare in cache, nu se schimba nimic — se merge
  // pe euristica de azi. Se inregistreaza cu `npm run mapare`.
  const foi = await parseFoi(cale);
  // Comutatorul exista ca sa se poata masura A/B ce aduce maparea pe un fisier
  // real, nu ca sa fie folosit in mod normal.
  const faraMapare = optiuni.faraMapare ?? process.env["IZOREP_FARA_MAPARE"] === "1";
  const mapari = faraMapare ? new Map() : citesteMapari();
  let foiMapate = 0;
  for (const foaie of foi) {
    const m = mapari.get(amprentaFoaie(foaie));
    if (!m) continue;
    aplicaMapare(foaie, m.mapare);
    foiMapate++;
  }

  const brute = adaugaSectiuni(liniile(foi));

  // L2a - determinist
  const rezolvate = new Map<number, { extras: LinieExtrasa; sursa: Sursa }>();
  const reziduale: { index: number; text: string; um?: string }[] = [];
  for (const b of brute) {
    const r = extrageDeterminist(b.index, b.text, b.um, b.sectiune, b.cantitate);
    if (r.complet) rezolvate.set(b.index, { extras: r.linie, sursa: "regex" });
    else reziduale.push({ index: b.index, text: b.text, ...(b.um ? { um: b.um } : {}) });
  }

  // L4 - memoria de sabloane: ce a corectat omul deja nu se mai intreaba.
  //
  // Sta INAINTE de model si inainte de deduplicare, fiindca e mai ieftina decat
  // amandoua: zero apeluri, rezultat determinist. Ce nu stie merge mai departe
  // pe drumul obisnuit, deci acoperirea nu scade niciodata din cauza ei.
  const stoc = optiuni.stoc ?? stocPeDisc();
  const dinMemorie = aplicaMemorie(reziduale, stoc);
  for (const e of dinMemorie.rezolvate) rezolvate.set(e.index, { extras: e, sursa: "memorie" });
  const deLucrat = dinMemorie.ramase;

  // L2b - model, doar pe rest, si doar cate un reprezentant per sablon
  //
  // Liniile reziduale se repeta masiv in acelasi fisier: masurat pe cele 9
  // fisiere de client, 697 de linii reziduale inseamna 318 sabloane. Se
  // trimite un reprezentant, iar rolul lui se duce pe restul grupului cu
  // numerele recitite din fiecare linie. Verificat pe golden files: 27 de
  // linii proiectate, 27 identice cu ce raspunsese modelul pentru ele.
  let faraRaspuns = 0;
  let trimise = 0;
  if (!optiuni.faraModel && deLucrat.length > 0) {
    const grupuri = grupeazaPeSablon(deLucrat);
    const reprezentanti = grupuri.map((g) => g.reprezentant);
    trimise = reprezentanti.length;

    const extrase = await extrageCuModel(reprezentanti, optiuni);
    for (const e of extrase) rezolvate.set(e.index, { extras: e, sursa: "model" });

    const { proiectate, ramase } = extindePeSablon(grupuri, extrase);
    for (const p of proiectate) rezolvate.set(p.index, { extras: p, sursa: "sablon" });

    // Ce n-a putut fi proiectat merge la model ca orice alta linie. Deduplicarea
    // e o optimizare de cost; acoperirea nu are voie sa scada din cauza ei.
    if (ramase.length > 0) {
      trimise += ramase.length;
      for (const e of await extrageCuModel(ramase, optiuni)) {
        rezolvate.set(e.index, { extras: e, sursa: "model" });
      }
    }
    // Contractul e "cate un obiect per linie, cu acelasi index". Modelul il
    // incalca in tacere: masurat pe `Oferta 27.04.2026.xlsx`, 43 de linii
    // trimise, 35 intoarse. Liniile lipsa nu apar nicaieri in raport — nici ca
    // pozitii, nici ca erori — deci disparitia lor arata exact ca un fisier cu
    // mai putine pozitii. Se numara, ca sa se vada.
    faraRaspuns = deLucrat.filter((r) => !rezolvate.has(r.index)).length;
  }

  // L3 - tarifare determinista
  const linii: LinieProcesata[] = [];
  for (const b of brute) {
    const r = rezolvate.get(b.index);
    if (!r) continue;
    const { extras, sursa } = r;

    // Nu si pe stratul determinist: acela citeste numerele direct din text,
    // deci nu poate inventa, iar regulile lui au deja teste proprii. Liniile
    // venite prin sablon se verifica la fel ca cele din model — numerele lor
    // vin din alt text decat cel citit de model, deci merita recontrolate.
    const avertismente = sursa !== "regex"
      ? valideazaExtragere(extras, { text: b.text, ...(b.um ? { um: b.um } : {}) })
      : [];

    const proc: LinieProcesata = {
      bruta: b, extras, sursa,
      ...(avertismente.length ? { avertismente } : {}),
      necesitaValidare: extras.sistem !== null
        && (extras.incredere < prag || avertismente.length > 0),
    };

    const t = tarifeazaExtras(extras, b.cantitate ?? 1);
    if (t.pret) proc.pret = t.pret;
    if (t.eroare !== undefined) { proc.eroare = t.eroare; proc.necesitaValidare = true; }
    linii.push(proc);
  }

  const izolatie = linii.filter((l) => l.extras.sistem !== null);
  const faraMasura = brute.filter((b) => b.um === undefined && b.cantitate === undefined).length;
  return {
    fisier: cale,
    foi: foi.length,
    foiMapate,
    total: brute.length,
    liniiIzolatie: izolatie.length,
    prinRegex: izolatie.filter((l) => l.sursa === "regex").length,
    prinModel: izolatie.filter((l) => l.sursa === "model").length,
    prinSablon: izolatie.filter((l) => l.sursa === "sablon").length,
    prinMemorie: izolatie.filter((l) => l.sursa === "memorie").length,
    faraMasura,
    trimiseLaModel: trimise,
    reziduale: reziduale.length,
    tarifate: izolatie.filter((l) => l.pret).length,
    deValidat: izolatie.filter((l) => l.necesitaValidare).length,
    cuAvertisment: izolatie.filter((l) => l.avertismente?.length).length,
    modelFaraRaspuns: faraRaspuns,
    netarifate: izolatie.filter((l) => !l.pret).length,
    valoareTotala: Math.round(izolatie.reduce((s, l) => s + (l.pret?.total ?? 0), 0) * 100) / 100,
    linii,
  };
}

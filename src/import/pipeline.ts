import { parseFoi } from "./parse-workbook.js";
import { citesteMapari } from "./cache-mapari.js";
import { stocPeDisc } from "./stoc-sabloane.js";
import { extrageCuModel, type OptiuniModel } from "./extract-llm.js";
import { proceseazaRegistru, type LinieProcesata, type OptiuniNucleu } from "./nucleu.js";
import type { StocSabloane } from "./memorie.js";

export type { Sursa } from "./schema.js";
export type { LinieProcesata } from "./nucleu.js";
// `tests/golden.test.ts` importa functia asta de AICI, nu din `nucleu.ts`: era
// definita in pipeline.ts inainte de refactor, iar mutarea barierei ar fi
// schimbat testul degeaba. Nucleul ramane sursa reala; pipeline-ul doar
// re-exporta, ca sa nu strice un import existent.
export { tarifeazaExtras } from "./nucleu.js";

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
  /** Linii confirmate sau corectate direct de om (ecranul de import). */
  prinOm: number;
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
  /** Linii ramase netrimise din cauza plafonului `maxLiniiModel`, PER IMPORT. */
  trunchiat: number;
  netarifate: number;
  valoareTotala: number;
  /**
   * Randuri care spun ca fisierul e o oferta de MANOPERA (tarif plat), nu de
   * material + manopera. Vezi `Statistici.randuriManopera` din `nucleu.ts`:
   * pe `Anexa 1` acelasi rand tarifat din matricea noastra iese de 2,5-3,8 ori
   * pretul semnat.
   */
  randuriManopera: number;
  linii: LinieProcesata[];
}

/**
 * Pipeline-ul de import, L0 -> L4. Invelisul de Node peste nucleul izomorf
 * din `nucleu.ts`: citeste fisierul de pe disc, cache-ul de mapari si cheama
 * modelul prin `extract-llm.ts` — trei lucruri pe care browserul nu le poate
 * face (`node:fs`, respectiv cheia API care n-are voie sa ajunga in pagina).
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
    /** Preturile puse de om. Vezi `OptiuniNucleu.preturiManuale`. */
    preturiManuale?: ReadonlyMap<number, number>;
    /** Tipul ofertei. Implicit rezidential, ca in ecran. */
    destinatie?: OptiuniNucleu["destinatie"];
  } = {},
): Promise<RaportImport> {
  const prag = optiuni.pragIncredere
    ?? Number(process.env["IZOREP_CONFIDENCE_THRESHOLD"] ?? 0.85);

  const foi = await parseFoi(cale);

  // Comutatorul exista ca sa se poata masura A/B ce aduce maparea pe un fisier
  // real, nu ca sa fie folosit in mod normal. Lipsa mapare = nucleul sare L1.
  const faraMapare = optiuni.faraMapare ?? process.env["IZOREP_FARA_MAPARE"] === "1";
  const mapari = faraMapare ? undefined : citesteMapari();
  const stoc = optiuni.stoc ?? stocPeDisc();

  const opt: OptiuniNucleu = {
    stoc, prag,
    ...(mapari ? { mapari } : {}),
    ...(optiuni.preturiManuale ? { preturiManuale: optiuni.preturiManuale } : {}),
    ...(optiuni.destinatie ? { destinatie: optiuni.destinatie } : {}),
    ...(optiuni.faraModel ? {} : { extrage: (linii) => extrageCuModel(linii, optiuni) }),
  };

  const rez = await proceseazaRegistru(foi, opt);

  return { fisier: cale, ...rez.statistici, linii: rez.linii };
}

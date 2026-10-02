/**
 * Masuratorile din timpul lucrarii, puse pe pozitiile planului de santier.
 *
 * Pozele din carnet vin in doua momente (Andrei, 2 octombrie 2026): inainte de
 * oferta — la clientii din apropiere firma masoara si oferta se face din poze —
 * si in timpul lucrarii, cand spun ce s-a executat. Al doilea drum se termina
 * aici: randurile confirmate de om devin cantitatile unei situatii noi.
 *
 * Potrivirea nu are reguli proprii. Randurile din poze trec prin acelasi import
 * care a facut oferta (`executatDinMasuratori`), deci primesc aceleasi straturi,
 * pe aceleasi randuri din lista, ca pozitiile planului. Amprenta compara exact
 * asta: forma si, strat cu strat, materialul, grosimea si randul din lista.
 * Notatia nu conteaza — „DN50” din cererea clientului si „ø60” din carnet cad
 * pe acelasi rand.
 *
 * Cand acelasi material e pe mai multe pozitii (zone, etaje), decide zona
 * randului; daca nici ea nu alege una singura, alege omul. Nimic nu se pune
 * pe o pozitie ghicita.
 */
import { parseFoiBuffer } from "../import/parse-workbook.js";
import { proceseazaRegistru } from "../import/nucleu.js";
import { stocInMemorie } from "../import/memorie.js";
import type { Destinatie } from "../pricing/lists.js";
import type { RandSantier } from "../santier/agrega.js";
import { spreCerere } from "../santier/spre-cerere.js";
import { registruCerere } from "../santier/registru.js";
import type { PlanSantier } from "./situatii.js";
import { amprenta } from "./amprenta.js";

export { amprenta };

/** Un rand executat, citit din poze si trecut prin import. */
export interface RandExecutat {
  /** Textul randului, cum il vede omul („Izolatie conducta ø60 cu vata …”). */
  text: string;
  zona: string;
  cantitate: number;
  amprenta: string | null;
}

/**
 * Randurile confirmate, prin acelasi import ca o cerere de oferta, pe tipul
 * ofertei din plan. Fara memoria de sabloane: ce a invatat ecranul de import
 * nu are voie sa schimbe ce s-a executat.
 */
export async function executatDinMasuratori(randuri: readonly RandSantier[], destinatie: Destinatie): Promise<RandExecutat[]> {
  const linii = spreCerere(randuri);
  if (linii.length === 0) return [];
  const foi = await parseFoiBuffer(await registruCerere(linii, "Masuratori din timpul lucrarii"));
  const rez = await proceseazaRegistru(foi, { stoc: stocInMemorie(), destinatie });
  const izolatie = rez.linii.filter((l) => l.extras.sistem !== null);
  // `spreCerere` scrie cate un rand de registru pe linie, in ordine, si fiecare
  // e citit determinist (`tests/santier.test.ts`): a i-a pozitie e a i-a linie.
  return linii.map((c, i) => ({
    text: c.text, zona: c.zona, cantitate: c.cantitate,
    amprenta: izolatie[i] && izolatie[i]!.bruta.cantitate === c.cantitate ? amprenta(izolatie[i]!) : null,
  }));
}

export interface Potrivire {
  /** Cantitatea executata, pe numarul pozitiei din plan. */
  cantitati: Record<number, number>;
  /** Randurile puse pe o pozitie, cu numarul ei. */
  puse: { rand: RandExecutat; pozitie: number }[];
  /** Acelasi material pe mai multe pozitii, iar zona nu decide: alege omul. */
  deAles: { rand: RandExecutat; pozitii: number[] }[];
  /** Nu e in plan: lucrare in plus, sau citita altfel. Decide omul. */
  nepotrivite: RandExecutat[];
  /** Planul e facut inainte sa pastreze amprentele: nu se poate potrivi nimic. */
  planVechi: boolean;
}

const normal = (s: string): string => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

export function potriveste(plan: PlanSantier, executat: readonly RandExecutat[]): Potrivire {
  const p: Potrivire = { cantitati: {}, puse: [], deAles: [], nepotrivite: [], planVechi: false };
  if (plan.pozitii.length > 0 && plan.pozitii.every((x) => x.amprenta === undefined)) {
    return { ...p, nepotrivite: [...executat], planVechi: true };
  }
  for (const rand of executat) {
    const candidati = rand.amprenta === null ? [] : plan.pozitii.filter((x) => x.amprenta === rand.amprenta);
    const inZona = candidati.length > 1 ? candidati.filter((x) => x.zona && normal(x.zona) === normal(rand.zona)) : candidati;
    if (candidati.length === 0) p.nepotrivite.push(rand);
    else if (inZona.length === 1) {
      const nr = inZona[0]!.nr;
      p.cantitati[nr] = Math.round(((p.cantitati[nr] ?? 0) + rand.cantitate) * 1000) / 1000;
      p.puse.push({ rand, pozitie: nr });
    } else p.deAles.push({ rand, pozitii: (inZona.length > 1 ? inZona : candidati).map((x) => x.nr) });
  }
  return p;
}

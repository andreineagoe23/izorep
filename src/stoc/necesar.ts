/**
 * Necesarul de materiale dintr-o oferta importata.
 *
 * Puntea dintre import si stoc: fiecare pozitie tarifata stie deja, strat cu
 * strat, materialul, grosimea, diametrul pe care se pune si randul din lista.
 * De aici iese cat material trebuie, fara nicio presupunere noua despre
 * preturi — doar geometrie.
 *
 * Suprafata e formula din registrul firmei (`conversie-ml-mp-tevi-tubulaturi`,
 * transcrisa in `data/referinte/conversii-tevi.json`):
 *
 *   m2/ml = PI × (φ + 2 × izolatie) / 1000
 *
 * cu π intreg, ca in registru (φ33,7 → 0,105871672…), nu 3,14 din formula de
 * pret peste lista. φ e diametrul geometric pe care se pune stratul.
 *
 * Coturile, teurile, flansele si casetele se numara ca BUCATI: materialul unei
 * piese nu reiese din lista, iar registrul spune doar „+5–10% suprafata pentru
 * coturi si fitinguri". Adaosul e deci un parametru vizibil, pus peste metri si
 * metri patrati, nu o cifra ascunsa in piese.
 *
 * Pur, fara I/O: ruleaza la fel in browser si in teste.
 */
import type { LinieProcesata } from "../import/nucleu.js";
import type { RezultatTarifare, StratTarifat } from "../pricing/types.js";

/** Registrul firmei: „+5–10% suprafata pentru coturi si fitinguri". */
export const ADAOS_IMPLICIT = 0.1;

export interface MaterialNecesar {
  /** sistem|grosime|rand — aceeasi cheie ca articolul din stoc. */
  cheie: string;
  sistem: string;
  grosime_mm: number | null;
  /** Randul din lista (ø pe care se croieste). Null pe suprafata (tubulatura in m²). */
  rand: number | null;
  /** Metri liniari, cu adaos. */
  ml: number;
  /** Metri patrati, cu adaos. */
  m2: number;
  /** Piese (cot, teu, flansa, caseta ...), fara adaos. */
  bucati: number;
  /** Cate pozitii din oferta au contribuit. */
  pozitii: number;
}

export interface FaraNecesar {
  rand: number;
  text: string;
  motiv: string;
}

export interface Necesar {
  adaos: number;
  materiale: MaterialNecesar[];
  faraNecesar: FaraNecesar[];
}

export const cheieMaterial = (sistem: string, grosime: number | null, rand: number | null): string =>
  `${sistem}|${grosime ?? "-"}|${rand ?? "-"}`;

/** m² pe metru liniar pentru un strat de grosime g pus pe φ. */
export const m2PeMetru = (fi: number, grosime: number): number => (Math.PI * (fi + 2 * grosime)) / 1000;

const ORDINE = ["elastomer", "vata_minerala", "tabla", "tabla_inox", "pvc"];
const rotunjit = (n: number): number => Math.round(n * 100) / 100;
const estePeMatrice = (p: LinieProcesata["pret"]): p is RezultatTarifare =>
  p !== undefined && "straturi" in p && !p.manual;

export function necesarDinLinii(linii: LinieProcesata[], adaos = ADAOS_IMPLICIT): Necesar {
  const acc = new Map<string, MaterialNecesar & { brutMl: number; brutM2: number }>();
  const faraNecesar: FaraNecesar[] = [];

  for (const l of linii) {
    if (l.extras.sistem === null) continue;
    const fara = (motiv: string): void => { faraNecesar.push({ rand: l.bruta.rand, text: l.bruta.text, motiv }); };
    if (!l.pret) { fara("fără preț: materialul nu se poate calcula"); continue; }
    if ("manual" in l.pret && l.pret.manual) { fara("preț pus de mână: materialul nu reiese din liste"); continue; }
    if (!estePeMatrice(l.pret) || l.pret.straturi.length === 0) {
      fara("închidere de gol la foc: materialele ei nu sunt în liste");
      continue;
    }

    const cantitate = l.bruta.cantitate ?? l.pret.cantitate;
    const forma = l.extras.forma ?? "ml";
    for (const s of l.pret.straturi) {
      const peSuprafata = forma === "mp" || s.diametru_geometric === 0;
      const rand = peSuprafata ? null : randStrat(s);
      const cheie = cheieMaterial(s.sistem, s.grosime_mm, rand);
      const m = acc.get(cheie) ?? {
        cheie, sistem: s.sistem, grosime_mm: s.grosime_mm, rand, ml: 0, m2: 0, bucati: 0, pozitii: 0, brutMl: 0, brutM2: 0,
      };
      m.pozitii++;
      if (forma === "mp") m.brutM2 += cantitate;
      else if (forma === "ml") {
        m.brutMl += cantitate;
        m.brutM2 += cantitate * m2PeMetru(s.diametru_geometric, s.grosime_mm ?? 0);
      } else m.bucati += cantitate;
      acc.set(cheie, m);
    }
  }

  const materiale = [...acc.values()]
    .map(({ brutMl, brutM2, ...m }) => ({ ...m, ml: rotunjit(brutMl * (1 + adaos)), m2: rotunjit(brutM2 * (1 + adaos)) }))
    .sort((a, b) => ORDINE.indexOf(a.sistem) - ORDINE.indexOf(b.sistem)
      || (a.grosime_mm ?? 0) - (b.grosime_mm ?? 0) || (a.rand ?? 0) - (b.rand ?? 0));
  return { adaos, materiale, faraNecesar };
}

/**
 * Randul pe care se croieste stratul. Peste lista (`rand_lista` 0) nu exista
 * rand: se ia diametrul geometric, rotunjit la milimetru.
 */
function randStrat(s: StratTarifat): number {
  return s.rand_lista > 0 ? s.rand_lista : Math.round(s.diametru_geometric);
}

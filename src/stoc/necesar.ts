/**
 * Necesarul de materiale dintr-o oferta importata: ce se comanda pentru santier.
 *
 * Puntea dintre import si stoc: fiecare pozitie tarifata stie deja, strat cu
 * strat, materialul, grosimea si diametrul pe care se pune. De aici iese cat
 * material trebuie, fara nicio presupunere noua despre preturi — doar geometrie.
 *
 * Regulile sunt cele spuse de firma la telefon (29 septembrie 2026):
 *
 * - **Pana la 3 toli** (teava ≤ ø90: DN80 = 88,9, PP-R ø90) se comanda
 *   **tuburi** (elastomer, cochilie de vata), pe diametru si grosime, in metri.
 * - **Peste 3 toli** nu se mai folosesc tuburile — ar costa mai mult — ci
 *   placa / saltea, **pe metru patrat**:
 *
 *     m²/ml = (φ + 2 × grosime) / 1000 × 3,14, rotunjit la 2 zecimale
 *
 *   Exemplul firmei: ø114 cu vata de 30 → 0,174 × 3,14 = 0,5463… → 0,55 m²/ml;
 *   100 m de teava cer 55 m² de vata. π e 3,14, ca in regula de pret peste
 *   lista; rotunjirea e pe m²/ml, inainte de inmultirea cu metrii.
 * - **Coturile si teurile peste 3 toli** se transforma in metri de teava, deci
 *   in m²: dintr-un metru se fac 3 piese la ø114–140, 2 la ø159–168 si una de la
 *   ø219 in sus (`piesePeMetru`).
 * - Tabla (aluminiu, inox) si PVC-ul sunt mereu pe suprafata, cu aceeasi formula.
 *
 * Firma a mai spus: lista de preturi include si manopera, deci necesarul e mai
 * mic decat oferta, iar scopul lui e sa nu ramana material pe stoc. De-aia
 * rezerva peste calcul (`adaos`) e zero implicit: se alege, nu se ascunde.
 *
 * Pur, fara I/O: ruleaza la fel in browser si in teste.
 */
import type { LinieProcesata } from "../import/nucleu.js";
import type { RezultatTarifare, StratTarifat } from "../pricing/types.js";
import { bani } from "../pricing/engine.js";

/** Fara rezerva: firma comanda cat iese din calcul, ca sa nu ramana pe stoc. */
export const ADAOS_IMPLICIT = 0;

/** 3 toli: DN80 are ø88,9 (ISO); PP-R ø90 e aceeasi marime. Peste, se comanda pe m². */
export const PRAG_TUB_MM = 90;

/** π al firmei („3,14"), acelasi ca in regula de pret peste lista. */
export const PI_FIRMA = 3.14;

export interface MaterialNecesar {
  /** sistem|grosime|rand — aceeasi cheie ca articolul din stoc. */
  cheie: string;
  sistem: string;
  grosime_mm: number | null;
  /** ø tubului (randul din lista). Null = se comanda pe suprafata, in m². */
  rand: number | null;
  /** Metri de teava acoperiti, cu rezerva. */
  ml: number;
  /** Metri patrati, cu rezerva (la tuburi: informativ). */
  m2: number;
  /** Piese numarate in bucati (cot si teu sub 3 toli, flansa, caseta …), fara rezerva. */
  bucati: number;
  /** Cate pozitii din oferta au contribuit. */
  pozitii: number;
  /**
   * Cat plateste clientul pentru materialul asta, in EUR: valoarea liniilor
   * din oferta (cu ajustarea tehnicului si discountul), impartita pe straturi
   * dupa pretul lor din lista. Lista include manopera, deci e mai mult decat
   * costul de achizitie.
   */
  valoareOferta: number;
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

const rotunjit = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** m² pe metru liniar pentru un strat de grosime g pus pe φ: formula firmei, rotunjita la 2 zecimale. */
export const m2PeMetru = (fi: number, grosime: number): number => rotunjit(((fi + 2 * grosime) / 1000) * PI_FIRMA);

/**
 * Cate coturi sau teuri se fac dintr-un metru de izolatie, dupa diametrul
 * tevii (peste 3 toli). Firma: 114–140 → 3, 159–168 → 2, „119–123” → 1.
 * Literal, 119–123 nu se poate aplica: nicio teava, din niciun material, n-are
 * ø intre 119 si 123, si intervalul e in interiorul lui 114–140, unde firma a
 * spus 3. Citim 219–323 (DN200–DN300 pe ISO), care continua sirul
 * 114 · 140 · 168 · 219 · 273 · 324 si scade cum trebuie: teava mai groasa,
 * mai putine piese pe metru. De confirmat; peste ø324 nu s-a spus nimic.
 */
export function piesePeMetru(teava: number): number {
  if (teava < 150) return 3; // ø108 / 114 / 140
  if (teava < 200) return 2; // ø159 / 168
  return 1; // de la ø219 (citit din „119–123”, de confirmat)
}

const PE_SUPRAFATA = new Set(["tabla", "tabla_inox", "pvc"]);
const ORDINE = ["elastomer", "vata_minerala", "tabla", "tabla_inox", "pvc"];
const estePeMatrice = (p: LinieProcesata["pret"]): p is RezultatTarifare =>
  p !== undefined && "straturi" in p && !p.manual;

/**
 * `linii` sunt cele care pleaca in oferta (`imparte(cuAjustare(...)).oferta`):
 * santierul se face din oferta, deci nici materialele nu se comanda pentru
 * pozitii care n-au intrat in ea. `discountProcent` scade din `valoareOferta`
 * ce scade si din totalul ofertei.
 */
export function necesarDinLinii(linii: LinieProcesata[], adaos = ADAOS_IMPLICIT, discountProcent = 0): Necesar {
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
    const teava = l.pret.straturi[0]!.diametru_geometric;
    const pesteTrei = teava > PRAG_TUB_MM;
    // Pretul unitar al liniei poate fi ajustat de tehnic (`cuAjustare`), iar
    // al straturilor nu: valoarea liniei se imparte pe straturi dupa pretul
    // lor din lista, ca suma pe materiale sa fie exact cat plateste clientul.
    const dinLista = (s: StratTarifat): number => (s.inclus ? bani(s.pret_unitar * s.multiplicator) : 0);
    const sumaLista = l.pret.straturi.reduce((t, s) => t + dinLista(s), 0);
    const valoareLinie = l.pret.pret_unitar * l.pret.cantitate * (1 - discountProcent / 100);
    for (const s of l.pret.straturi) {
      const peSuprafata = forma === "mp" || s.diametru_geometric === 0 || PE_SUPRAFATA.has(s.sistem) || pesteTrei;
      const rand = peSuprafata ? null : randStrat(s);
      const cheie = cheieMaterial(s.sistem, s.grosime_mm, rand);
      const m = acc.get(cheie) ?? {
        cheie, sistem: s.sistem, grosime_mm: s.grosime_mm, rand,
        ml: 0, m2: 0, bucati: 0, pozitii: 0, valoareOferta: 0, brutMl: 0, brutM2: 0,
      };
      m.pozitii++;
      if (sumaLista > 0) m.valoareOferta += valoareLinie * (dinLista(s) / sumaLista);
      const peMetru = m2PeMetru(s.diametru_geometric, s.grosime_mm ?? 0);
      // Echipamentul (distribuitorul de abur) n-are diametru: suprafata lui e pe pret.
      if (l.pret.suprafata_mp !== undefined) m.brutM2 += cantitate * l.pret.suprafata_mp;
      else if (forma === "mp") m.brutM2 += cantitate;
      else if (forma === "ml") {
        m.brutMl += cantitate;
        m.brutM2 += cantitate * peMetru;
      } else if ((forma === "cot" || forma === "teu") && peSuprafata && pesteTrei) {
        m.brutM2 += (cantitate / piesePeMetru(teava)) * peMetru;
      } else m.bucati += cantitate;
      acc.set(cheie, m);
    }
  }

  const materiale = [...acc.values()]
    .map(({ brutMl, brutM2, ...m }) => ({
      ...m, ml: rotunjit(brutMl * (1 + adaos)), m2: rotunjit(brutM2 * (1 + adaos)), valoareOferta: rotunjit(m.valoareOferta),
    }))
    .sort((a, b) => ORDINE.indexOf(a.sistem) - ORDINE.indexOf(b.sistem)
      || (a.rand === null ? 1 : 0) - (b.rand === null ? 1 : 0)
      || (a.grosime_mm ?? 0) - (b.grosime_mm ?? 0) || (a.rand ?? 0) - (b.rand ?? 0));
  return { adaos, materiale, faraNecesar };
}

/**
 * ø tubului. Peste lista (`rand_lista` 0) nu exista rand: se ia diametrul
 * geometric, rotunjit la milimetru.
 */
function randStrat(s: StratTarifat): number {
  return s.rand_lista > 0 ? s.rand_lista : Math.round(s.diametru_geometric);
}

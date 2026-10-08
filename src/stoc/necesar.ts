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
 * - **Piesele** (cot, teu, reductie, flansa, caseta de robinet, mansete) se
 *   transforma in metri de teava, deci in tub sau in m²: dintr-un metru se fac
 *   3 piese la ø114–140, 2 la ø159–168 si una de la ø219 in sus
 *   (`piesePeMetru`). Firma (5 octombrie 2026): tabelul de echivalenta e doar
 *   pentru oferta; la comanda se socoteste „cum s-a discutat la telefon", adica
 *   asa. Sub 3 toli si peste ø273 regula e presupusa (`regulaPresupusa`).
 * - Tabla (aluminiu, inox) si PVC-ul sunt mereu pe suprafata, cu aceeasi formula;
 *   tabla se cumpara la kg (S13), deci are si greutatea.
 *
* Lista de preturi include si manopera, deci necesarul e mai mic decat oferta,
 * iar scopul lui e sa nu ramana material pe stoc: rezerva peste calcul e zero.
 * Raman pierderile la croit, pe categorie (S15, S16: tabla si placile 10 %;
 * tuburile 0), care se pot schimba (`OptiuniNecesar.pierderi`).
 *
 * Pur, fara I/O: ruleaza la fel in browser si in teste.
 */
import type { LinieProcesata } from "../import/nucleu.js";
import type { RezultatTarifare, StratTarifat } from "../pricing/types.js";
import { bani } from "../pricing/engine.js";

/** 3 toli: DN80 are ø88,9 (ISO); PP-R ø90 e aceeasi marime. Peste, se comanda pe m². */
export const PRAG_TUB_MM = 90;

/** π al firmei („3,14"), acelasi ca in regula de pret peste lista. */
export const PI_FIRMA = 3.14;

/** Cum se comanda materialul: tub pe ø, placa pe m², tabla (sau PVC) pe m². */
export type Categorie = "tub" | "placa" | "tabla";

/** Pierderea la croit, pe categorie, ca fractie (0,1 = 10 %). */
export type Pierderi = Record<Categorie, number>;

/** Firma, 5 octombrie 2026: tabla 10 % (S15), placile 10 % (S16); tuburile nu se croiesc. */
export const PIERDERI_IMPLICITE: Pierderi = { tub: 0, placa: 0.1, tabla: 0.1 };

/**
 * kg pe m² pe fiecare mm de grosime: aluminiu 2,70, inox 7,93 (densitatea, in
 * g/cm³). Tabla se cumpara la kg (S13); 0,8 mm de aluminiu = 2,16 kg/m².
 */
export const KG_PE_MP_PE_MM: Partial<Record<string, number>> = { tabla: 2.7, tabla_inox: 7.93 };

export interface OptiuniNecesar {
  pierderi?: Pierderi;
  /**
   * Pana la ce diametru se comanda tuburi (cochilii, tub de elastomer). Firma:
   * 3 toli, dar „se pot comanda si cochilii peste 3 toli, in functie de nevoia
   * santierului" (S12). `Infinity` = toate in tuburi.
   */
  pragTub?: number;
  /** Scade din `valoareOferta` ce scade si din totalul ofertei. */
  discountProcent?: number;
}

/** Cat din material intra intr-o unitate a unei pozitii din oferta. */
export interface PePozitie {
  /** Numarul pozitiei in plan: ordinea liniilor primite, de la 1 (`planDinOferta`). */
  pozitie: number;
  /** Material pe unitatea pozitiei (ml sau m², ca articolul), fara pierderi. */
  peUnitate: number;
}

export interface MaterialNecesar {
  /** sistem|grosime|rand — aceeasi cheie ca articolul din stoc, fara marca. */
  cheie: string;
  sistem: string;
  grosime_mm: number | null;
  /** ø tubului (randul din lista). Null = se comanda pe suprafata, in m². */
  rand: number | null;
  categorie: Categorie;
  /** Metri de teava acoperiti, cu pierderi (piesele incluse, trecute in metri). */
  ml: number;
  /** Metri patrati, cu pierderi (la tuburi: informativ). */
  m2: number;
  /** Tabla: greutatea, in kg, pentru comanda. */
  kg?: number;
  /** Piese (cot, teu, flansa …) trecute in metri de teava. */
  piese: number;
  /** Din ele, cate pe regula presupusa: sub 3 toli sau peste ø273. */
  piesePresupuse: number;
  /** Pierderea aplicata, ca fractie. */
  pierdere: number;
  /** Cate pozitii din oferta au contribuit. */
  pozitii: number;
  /** Materialul pe fiecare pozitie: din el se calculeaza consumul din situatii. */
  pePozitie: PePozitie[];
  /**
   * Cat plateste clientul pentru materialul asta, in EUR: valoarea liniilor
   * din oferta (cu ajustarea tehnicului si discountul), impartita pe straturi
   * dupa pretul lor din lista. Lista include manopera, deci e mai mult decat
   * costul de achizitie.
   */
  valoareOferta: number;
  /** Adaugat de mana pe necesar (goluri la foc, distribuitor …), cu motivul. */
  manual?: string;
  /** Materialul il da clientul: valoare zero, nu intra in „De comandat" (S38). */
  alClientului?: true;
}

export interface FaraNecesar {
  rand: number;
  text: string;
  motiv: string;
}

export interface Necesar {
  pierderi: Pierderi;
  pragTub: number;
  materiale: MaterialNecesar[];
  faraNecesar: FaraNecesar[];
}

export const cheieMaterial = (sistem: string, grosime: number | null, rand: number | null): string =>
  `${sistem}|${grosime ?? "-"}|${rand ?? "-"}`;

const rotunjit = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** m² pe metru liniar pentru un strat de grosime g pus pe φ: formula firmei, rotunjita la 2 zecimale. */
export const m2PeMetru = (fi: number, grosime: number): number => rotunjit(((fi + 2 * grosime) / 1000) * PI_FIRMA);

/**
 * Cate piese (cot, teu, flansa …) se fac dintr-un metru de izolatie, dupa
 * diametrul tevii. Firma: 114–140 → 3, 159–168 → 2, 219–273 → 1 (Adrian a
 * corectat pe foaia din 5 octombrie „119–123" in „219–273").
 *
 * Sub 3 toli piesele se taie tot din tub, dar firma n-a spus cat ia una: 3 pe
 * metru, ca la cel mai mic interval spus (o teava mai subtire nu da mai putine
 * piese decat ø114). Peste ø273, 1, ca ultimul interval. Amandoua presupuse.
 */
export function piesePeMetru(teava: number): number {
  if (teava < 150) return 3; // pana la ø108 / 114 / 140
  if (teava < 200) return 2; // ø159 / 168
  return 1; // de la ø219
}

/** Regula de piese nu e spusa de firma pentru diametrul asta. */
export const regulaPresupusa = (teava: number): boolean => teava <= PRAG_TUB_MM || teava > 274;

const PE_SUPRAFATA = new Set(["tabla", "tabla_inox", "pvc"]);
const ORDINE = ["elastomer", "vata_minerala", "tabla", "tabla_inox", "pvc"];
const estePeMatrice = (p: LinieProcesata["pret"]): p is RezultatTarifare =>
  p !== undefined && "straturi" in p && !p.manual;

/**
 * `linii` sunt cele care pleaca in oferta (`imparte(cuAjustare(...)).oferta`):
 * santierul se face din oferta, deci nici materialele nu se comanda pentru
 * pozitii care n-au intrat in ea. A n-a pozitie din `linii` e pozitia n din
 * planul de santier (`planDinOferta` le numeroteaza in aceeasi ordine).
 */
export function necesarDinLinii(linii: LinieProcesata[], o: OptiuniNecesar = {}): Necesar {
  const pierderi = o.pierderi ?? PIERDERI_IMPLICITE;
  const pragTub = o.pragTub ?? PRAG_TUB_MM;
  const discountProcent = o.discountProcent ?? 0;
  type Acc = MaterialNecesar & { brutMl: number; brutM2: number; pe: Map<number, number> };
  const acc = new Map<string, Acc>();
  const faraNecesar: FaraNecesar[] = [];

  let nr = 0;
  for (const l of linii) {
    if (l.extras.sistem === null) continue;
    // Numarul pozitiei in plan: doar pozitiile se numara, ca in `planDinOferta`.
    nr++;
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
    const pePlaca = teava > pragTub;
    // O piesa e un metru de teava impartit la cate piese ies din el.
    const piesa = forma !== "ml" && forma !== "mp";
    const metri = piesa ? cantitate / piesePeMetru(teava) : cantitate;
    // Pretul unitar al liniei poate fi ajustat de tehnic (`cuAjustare`), iar
    // al straturilor nu: valoarea liniei se imparte pe straturi dupa pretul
    // lor din lista, ca suma pe materiale sa fie exact cat plateste clientul.
    const dinLista = (s: StratTarifat): number => (s.inclus ? bani(s.pret_unitar * s.multiplicator) : 0);
    const sumaLista = l.pret.straturi.reduce((t, s) => t + dinLista(s), 0);
    const valoareLinie = l.pret.pret_unitar * l.pret.cantitate * (1 - discountProcent / 100);
    for (const s of l.pret.straturi) {
      const jacheta = PE_SUPRAFATA.has(s.sistem);
      const peSuprafata = forma === "mp" || s.diametru_geometric === 0 || jacheta || pePlaca
        || l.pret.suprafata_mp !== undefined;
      const rand = peSuprafata ? null : randStrat(s);
      const categorie: Categorie = jacheta ? "tabla" : rand === null ? "placa" : "tub";
      const cheie = cheieMaterial(s.sistem, s.grosime_mm, rand);
      const m = acc.get(cheie) ?? {
        cheie, sistem: s.sistem, grosime_mm: s.grosime_mm, rand, categorie,
        ml: 0, m2: 0, piese: 0, piesePresupuse: 0, pierdere: pierderi[categorie], pozitii: 0, pePozitie: [],
        valoareOferta: 0, brutMl: 0, brutM2: 0, pe: new Map(),
      };
      m.pozitii++;
      if (sumaLista > 0) m.valoareOferta += valoareLinie * (dinLista(s) / sumaLista);
      const peMetru = m2PeMetru(s.diametru_geometric, s.grosime_mm ?? 0);
      let adaugat: number;
      if (l.pret.suprafata_mp !== undefined) {
        // Echipamentul (distribuitorul de abur) n-are diametru: suprafata lui e pe pret.
        adaugat = cantitate * l.pret.suprafata_mp;
        m.brutM2 += adaugat;
      } else if (forma === "mp") {
        adaugat = cantitate;
        m.brutM2 += adaugat;
      } else {
        m.brutMl += metri;
        m.brutM2 += metri * peMetru;
        adaugat = rand === null ? metri * peMetru : metri;
        if (piesa) {
          m.piese += cantitate;
          if (regulaPresupusa(teava)) m.piesePresupuse += cantitate;
        }
      }
      m.pe.set(nr, (m.pe.get(nr) ?? 0) + (cantitate > 0 ? adaugat / cantitate : 0));
      acc.set(cheie, m);
    }
  }

  const materiale = [...acc.values()]
    .map(({ brutMl, brutM2, pe, ...m }): MaterialNecesar => {
      const f = 1 + m.pierdere;
      const m2 = rotunjit(brutM2 * f);
      const kgPeMp = KG_PE_MP_PE_MM[m.sistem];
      return {
        ...m, ml: rotunjit(brutMl * f), m2, valoareOferta: rotunjit(m.valoareOferta),
        pePozitie: [...pe].map(([pozitie, peUnitate]) => ({ pozitie, peUnitate: Math.round(peUnitate * 10000) / 10000 })),
        ...(kgPeMp !== undefined && m.grosime_mm !== null ? { kg: rotunjit(m2 * kgPeMp * m.grosime_mm) } : {}),
      };
    })
    .sort((a, b) => ORDINE.indexOf(a.sistem) - ORDINE.indexOf(b.sistem)
      || (a.rand === null ? 1 : 0) - (b.rand === null ? 1 : 0)
      || (a.grosime_mm ?? 0) - (b.grosime_mm ?? 0) || (a.rand ?? 0) - (b.rand ?? 0));
  return { pierderi, pragTub, materiale, faraNecesar };
}

/**
 * ø tubului. Peste lista (`rand_lista` 0) nu exista rand: se ia diametrul
 * geometric, rotunjit la milimetru.
 */
function randStrat(s: StratTarifat): number {
  return s.rand_lista > 0 ? s.rand_lista : Math.round(s.diametru_geometric);
}

/**
 * Un material adaugat de mana pe necesar: goluri la foc (banda, colier),
 * distribuitorul, materialul la o lucrare cu pret pus de mana (S19, S20).
 * Cantitatea e a omului, in unitatea articolului; fara valoare in oferta.
 */
export function materialManual(
  sistem: string, grosime_mm: number | null, rand: number | null, cantitate: number, motiv: string,
): MaterialNecesar {
  const categorie: Categorie = PE_SUPRAFATA.has(sistem) ? "tabla" : rand === null ? "placa" : "tub";
  const kgPeMp = KG_PE_MP_PE_MM[sistem];
  return {
    cheie: cheieMaterial(sistem, grosime_mm, rand), sistem, grosime_mm, rand, categorie,
    ml: rand === null ? 0 : cantitate, m2: rand === null ? cantitate : 0,
    ...(kgPeMp !== undefined && grosime_mm !== null && rand === null ? { kg: rotunjit(cantitate * kgPeMp * grosime_mm) } : {}),
    piese: 0, piesePresupuse: 0, pierdere: 0, pozitii: 0, pePozitie: [], valoareOferta: 0, manual: motiv,
  };
}

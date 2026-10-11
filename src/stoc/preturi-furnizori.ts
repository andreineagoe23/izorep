/**
 * Pretul de achizitie de pus pe ciorna comenzii (Faza 4, S26: „pretul din
 * lista furnizorului daca exista, altfel se scrie pe comanda”).
 *
 * Sursele, de la cea mai noua:
 *
 *   1. intrarile din aplicatie, cu pret, de la acel furnizor (factura trecuta
 *      la receptie);
 *   2. `data/preturi-furnizori.json` (`npm run preturi-furnizori`): lista
 *      K-Flex ST de la Banda Tech si ultima factura din evidenta firmei, pe
 *      furnizor si articol.
 *
 * Se ia cel mai recent pret al furnizorului ales. Pretul e o propunere: omul
 * il vede pe ciorna, cu sursa, si il schimba. Pe receptie nu se pune singur:
 * avizul n-are pret, iar factura spune pretul adevarat.
 *
 * Unitatea e cea de pe document: lei sau euro pe ml la tub, pe m² la saltea si
 * placa, pe kg la tabla (asa se cumpara si asa e in evidenta).
 *
 * Pur, fara I/O.
 */
import date from "../../data/preturi-furnizori.json" with { type: "json" };
import { kgPeMp } from "./produse.js";
import { cheieBaza, esteAnulata, type Articol, type Miscare } from "./registru.js";

export interface PretFurnizor {
  furnizor: string;
  valoare: number;
  moneda: "EUR" | "RON";
  /** ISO, data documentului. */
  data: string;
  /** „lista K-Flex ST, 24.06.2026”, „factura 20262729 din 20.07.2026”. */
  sursa: string;
  /** Cursul de pe factura, cand pretul e in lei. */
  curs?: number;
}

export interface PreturiFurnizori {
  generat: string;
  surse: string[];
  /** Pe cheia articolului fara marca (`cheieBaza`), cel mai nou pret al fiecarui furnizor. */
  preturi: Record<string, PretFurnizor[]>;
}

export const PRETURI_FURNIZORI = date as PreturiFurnizori;

/**
 * Numele din evidenta („BANDATECH SRL”, „COLOR - METAL”, „METAL  DM AUTOMOTIVE
 * SRL”) pe numele din lista furnizorilor (`FURNIZORI`, S25).
 */
export function numeFurnizor(brut: string): string {
  const t = brut.toUpperCase().replace(/[^A-Z&]+/g, " ").trim();
  const cunoscuti: [RegExp, string][] = [
    [/^BANDA ?TECH/, "Banda Tech"], [/^ISOLINE/, "Isoline"], [/^RAVAGO/, "Ravago Rom"], [/^MTM/, "MTM Izolatii"],
    [/^COLOR METAL/, "Color Metal"], [/^STEELMET/, "STEELMET Romania"], [/^METAL DM/, "Metal DM Automotive"],
    [/^DIRECT LINE/, "Direct Line Inox"], [/^ISOPARTNER/, "Isopartner"], [/^VENUS/, "Venus DSH"], [/^SEA /, "SEA Romania"],
    [/^RECA/, "Reca Romania"], [/^ROCAST/, "Rocast"],
  ];
  return cunoscuti.find(([re]) => re.test(t))?.[1] ?? brut.replace(/\s+/g, " ").trim();
}

/** Ultimul pret de pe o intrare din aplicatie, pe unitatea documentului. */
function dinIntrari(a: Pick<Articol, "sistem" | "grosime_mm" | "rand" | "forma">, furnizor: string, miscari: readonly Miscare[]): PretFurnizor | null {
  const cheie = cheieBaza(a);
  const kg = kgPeMp(a);
  let gasit: PretFurnizor | null = null;
  for (const m of miscari) {
    if (m.tip !== "intrare" || m.anuleaza || !m.pret || m.furnizor !== furnizor || cheieBaza(m.articol) !== cheie) continue;
    if (esteAnulata(m, miscari)) continue;
    const data = (m.document?.data ?? m.data).slice(0, 10);
    if (gasit && gasit.data > data) continue;
    // In stoc pretul e pe unitatea articolului (m² la tabla); pe document, pe kg.
    const peDoc = (v: number): number => Math.round((kg !== null ? v / kg : v) * 10000) / 10000;
    const doc = m.document ? `${m.document.tip === "aviz" ? "aviz" : "factura"} ${[m.document.serie, m.document.numar].filter(Boolean).join(" ")}` : "intrare";
    const [an, luna, zi] = data.split("-");
    gasit = m.pret.lei !== undefined && m.pret.curs
      ? { furnizor, valoare: peDoc(m.pret.lei), moneda: "RON", curs: m.pret.curs, data, sursa: `${doc} din ${zi}.${luna}.${an}` }
      : { furnizor, valoare: peDoc(m.pret.valoare), moneda: "EUR", data, sursa: `${doc} din ${zi}.${luna}.${an}` };
  }
  return gasit;
}

/** Cel mai nou pret al furnizorului pentru articol; null = nu stim, se scrie de mana. */
export function pretPropus(
  a: Pick<Articol, "sistem" | "grosime_mm" | "rand" | "forma">, furnizor: string, miscari: readonly Miscare[] = [],
  surse: PreturiFurnizori = PRETURI_FURNIZORI,
): PretFurnizor | null {
  const static_ = surse.preturi[cheieBaza(a)]?.find((p) => p.furnizor === furnizor) ?? null;
  const aplicatie = dinIntrari(a, furnizor, miscari);
  if (!static_) return aplicatie;
  if (!aplicatie) return static_;
  return aplicatie.data >= static_.data ? aplicatie : static_;
}

/** Furnizorii care au un pret pentru articol, cel mai ieftin in euro intai (la cursul de pe document). */
export function preturiArticol(a: Pick<Articol, "sistem" | "grosime_mm" | "rand" | "forma">, surse: PreturiFurnizori = PRETURI_FURNIZORI): PretFurnizor[] {
  const inEuro = (p: PretFurnizor): number => (p.moneda === "EUR" ? p.valoare : p.curs ? p.valoare / p.curs : Infinity);
  return [...(surse.preturi[cheieBaza(a)] ?? [])].sort((x, y) => inEuro(x) - inEuro(y));
}

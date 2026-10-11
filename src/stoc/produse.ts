/**
 * Produsele furnizorilor, in ambele sensuri: cum se scrie un articol pe
 * comanda si cum se citeste denumirea de pe aviz, factura sau evidenta.
 *
 * Denumirile sunt cele din evidenta firmei (`../attachments/achizitii/`,
 * 2017–2026) si din lista K-Flex de la Banda Tech:
 *
 *   COCHILTECH AL. 140 X 50          cochilie de vata, ø140, 50 mm
 *   ARMAFLEX ACE PLUS TUBES 09 X 60   tub de elastomer, 9 mm, ø60 (grosimea intai)
 *   TUBURI K-FLEX 25X89 · ST 9x22     idem
 *   ARMAFLEX ACE PLACA 25 MM          placa de elastomer, 25 mm
 *   LM ECO ALU M 50X1000X5000         saltea de vata lamelara, 50 mm, rola de 5 m²
 *   TABLA AL. 0,8*1000 (KG)           tabla de aluminiu, 0,8 mm, la kg
 *
 * La cochilii ø e al tevii, scris cum il vinde producatorul (116 pentru DN100):
 * se trece pe randul cel mai apropiat din lista de vata, ca articolul sa fie
 * acelasi cu cel din necesar (TRANSAVIA: necesarul ø114, cumparat 116).
 *
 * Pur, fara I/O.
 */
import { diametreDin, lista } from "../pricing/lists.js";
import { KG_PE_MP_PE_MM, type Categorie } from "./necesar.js";
import { formaArticol, type Articol } from "./registru.js";

export interface ArticolCitit {
  sistem: string;
  forma: Categorie;
  grosime_mm: number | null;
  rand: number | null;
  marca?: string;
  /** Tabla vine la kg: cantitatea de pe document e in kg, nu in m². */
  laKg?: true;
}

const nr = (s: string): number => Number(s.replace(",", "."));

/** Randul din lista cel mai apropiat, daca e la cel mult 3 mm; altfel ø-ul scris. */
function peRand(sistem: "vata_minerala" | "elastomer", d: number): number {
  const randuri = diametreDin(lista(sistem));
  const cel = randuri.reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a), randuri[0]!);
  return Math.abs(cel - d) <= 3 ? cel : d;
}

const MARCA: [RegExp, string][] = [
  [/ARMAFLEX/i, "Armaflex"], [/K-?FLEX|\bST\s+\d/i, "K-Flex"], [/\bNMC\b/i, "NMC"], [/KAIFLEX/i, "Kaiflex"],
  [/COCHILTECH/i, "Cochiltech"], [/LM\s+ECO/i, "LM Eco"],
  [/LAROCK|KLIMAMAT|CONLIT|TECHROCK|PROROX|ROCKWOOL/i, "Rockwool"], [/POWER-?TEK/i, "Power-teK"],
];
const marca = (t: string): string | undefined => MARCA.find(([re]) => re.test(t))?.[1];

/** Citeste o denumire de furnizor. Null = nu e un material pe care il tinem in stoc. */
export function articolDinDenumire(denumire: string): ArticolCitit | null {
  const t = denumire.toUpperCase().replace(/\s+/g, " ").trim();
  const cu = (a: Omit<ArticolCitit, "marca">): ArticolCitit => {
    const m = marca(t);
    return m ? { ...a, marca: m } : a;
  };
  let m: RegExpMatchArray | null;

  if ((m = t.match(/COCHILTECH(?:\s+AL\.?)?\s*(\d{2,3})\s*X\s*(\d{2,3})/))) {
    return cu({ sistem: "vata_minerala", forma: "tub", rand: peRand("vata_minerala", nr(m[1]!)), grosime_mm: nr(m[2]!) });
  }
  // Tubul de elastomer: grosimea intai, apoi ø („TUBES 19 X 48", „ST 9x22").
  if ((m = t.match(/(?:TUBES?|TUBURI(?:\s+(?:K-?FLEX|KFLEX|CAUCIUC))?|^ST)\s*(\d{1,2})\s*X\s*(\d{1,3})(?!\d)/))) {
    return cu({ sistem: "elastomer", forma: "tub", grosime_mm: nr(m[1]!), rand: peRand("elastomer", nr(m[2]!)) });
  }
  if (/(ARMAFLEX|K-?FLEX|NMC|KAIFLEX)/.test(t) && /PLAC|ROLA/.test(t) && (m = t.match(/(\d{1,2})\s*(?:-\d+\/E|MM)/))) {
    return cu({ sistem: "elastomer", forma: "placa", grosime_mm: nr(m[1]!), rand: null });
  }
  // Saltelele lamelare: LM ECO ALU M 50X1000X5000, POWER-TEK … 50X1000X4000.
  if ((m = t.match(/(?:LM\s+ECO\s+ALU\s+M|POWER-?TEK[\w\s]*?M)\s*(\d{2,3})\s*X\s*\d/))) {
    return cu({ sistem: "vata_minerala", forma: "saltea", grosime_mm: nr(m[1]!), rand: null });
  }
  if (/LAROCK|KLIMAMAT|LAMEL|PROROX\s+WM/.test(t)) {
    const g = t.match(/ALS\s+0?(\d{2,3})\//) ?? t.match(/(\d{2,3})\s*MM/) ?? t.match(/X(\d{2,3})$/);
    if (g) return cu({ sistem: "vata_minerala", forma: "saltea", grosime_mm: nr(g[1]!), rand: null });
  }
  if (/CONLIT|TECHROCK|PROROX\s+SL/.test(t)) {
    const g = t.match(/ALS\s+0?(\d{2,3})\//) ?? t.match(/ALU\s*\d+\s+(\d{2,3})\//) ?? t.match(/(\d{2,3})\s*MM/);
    if (g) return cu({ sistem: "vata_minerala", forma: "placa", grosime_mm: nr(g[1]!), rand: null });
  }
  if ((m = t.match(/(?:TABLA\s+AL\.?(?:\s+STUCCO)?|BANDA\s+ALUMINIU)\D*?(\d[.,]\d{1,2})\s*(?:\*|X)/))) {
    return { sistem: "tabla", forma: "tabla", grosime_mm: nr(m[1]!), rand: null, laKg: true };
  }
  if ((m = t.match(/TABLA\s+INOX\D*?(\d[.,]\d{1,2})/))) {
    return { sistem: "tabla_inox", forma: "tabla", grosime_mm: nr(m[1]!), rand: null, laKg: true };
  }
  return null;
}

const ROTUND = (n: number): string => n.toLocaleString("ro-RO", { maximumFractionDigits: 2 });

/**
 * Cum se scrie articolul pe comanda. Forma e cea din comanda reala TRANSAVIA
 * (13 iulie 2026): „Cochilii caserate Ø140 x 50 mm = 350 m".
 */
export function denumireComanda(a: Pick<Articol, "sistem" | "grosime_mm" | "rand" | "forma" | "marca">): string {
  const g = a.grosime_mm !== null ? ROTUND(a.grosime_mm) : "";
  const forma = formaArticol(a);
  const brand = a.marca ? ` (${a.marca})` : "";
  if (forma === "tub") {
    const ce = a.sistem === "vata_minerala" ? "Cochilii caserate" : "Tuburi elastomer";
    return `${ce} Ø${a.rand} x ${g} mm${brand}`;
  }
  if (a.sistem === "vata_minerala") {
    return `${forma === "saltea" ? "Saltea vată minerală lamelară caserată Al" : "Placă vată minerală"} ${g} mm${brand}`;
  }
  if (a.sistem === "elastomer") return `Placă elastomer ${g} mm${brand}`;
  if (a.sistem === "tabla") return `Tablă aluminiu ${g} mm${brand}`;
  if (a.sistem === "tabla_inox") return `Tablă inox ${g} mm${brand}`;
  if (a.sistem === "pvc") return `Folie PVC${brand}`;
  return `${a.sistem} ${g} mm${brand}`;
}

/** kg pe m² pentru tabla (densitate × grosime); null la restul. */
export function kgPeMp(a: Pick<Articol, "sistem" | "grosime_mm">): number | null {
  const d = KG_PE_MP_PE_MM[a.sistem];
  return d !== undefined && a.grosime_mm !== null ? Math.round(d * a.grosime_mm * 10000) / 10000 : null;
}

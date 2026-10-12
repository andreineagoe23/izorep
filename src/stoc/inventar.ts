/**
 * Inventarul și stocul de pornire (Faza 8).
 *
 * **Inventarul** (S45: „se face; la un sfârșit de șantier, șeful de lucrare, și
 * în depozit și în șantiere”). Omul numără ce e fizic într-un loc și scrie
 * cifrele. Pe fiecare material numărat, diferența față de ce arată aplicația
 * (soldul din `solduri`) devine o mișcare `ajustare`, cu motivul ales de om
 * (pierdut, furat, reciclat …). Ce nu s-a numărat nu se atinge: inventarul
 * complet nu e condiție (plan, Faza 8). Funcția e generală, pe orice loc:
 * centralul, atelierul, un șantier — și închiderea șantierului (Faza 7) o
 * folosește pentru inventarul de la final.
 *
 * **Stocul de pornire** (S48: „doar cele noi”). Aplicația pornește goală; în
 * ea intră doar șantierele noi, făcute din ofertă, care pornesc fără material.
 * Ce e deja fizic în depozitul central (sau în atelier) se trece o dată, ca
 * intrare marcată `motiv: "stoc de pornire"`: nu e o cumpărare, deci nu apare
 * în evidența cumpărărilor, dar se vede ca atare în jurnal și în drumul
 * materialului. La fel, mai târziu, restul care se întoarce de pe un șantier
 * început înainte de aplicație: șantierul acela nu e în aplicație, deci
 * materialul intră în central ca stoc de pornire, nu ca retur.
 *
 * Prețul stocului de pornire, când omul nu-l scrie: ultimul preț de cumpărare
 * cunoscut al materialului (o factură din aplicație sau evidența firmei din
 * `data/preturi-furnizori.json`), în euro cu cursul documentului — aceeași
 * regulă ca la intrări („euro = lei / cursul de pe document”, decizia din 11
 * octombrie). Fără el, materialul din central n-ar avea cost când pleacă pe un
 * șantier nou (S44: prețul mediu). Sursa se scrie în nota mișcării.
 *
 * Pur, fără I/O, ca `registru.ts`: aceleași funcții le cheamă ecranul și
 * serverul (care le recalculează din mișcările din bază).
 */
import { PRETURI_FURNIZORI, type PreturiFurnizori } from "./preturi-furnizori.js";
import { kgPeMp } from "./produse.js";
import { ATELIER, CENTRAL } from "./locuri.js";
import {
  cheieBaza, esteAnulata, solduri, valideazaMiscare, type Articol, type Miscare, type PretAchizitie,
} from "./registru.js";

/** Motivul intrării care pune în aplicație materialul existent la pornire. */
export const MOTIV_PORNIRE = "stoc de pornire";

/**
 * Motivele propuse pe ecran la inventar, din răspunsurile firmei: S4 („furate /
 * pierdute”), S43 („se duce la reciclat”), S45 (diferențele). Omul poate
 * scrie și altul.
 */
export const MOTIVE_INVENTAR = [
  "diferență la numărătoare", "pierdut", "furat", "deteriorat", "dus la reciclat", "găsit în plus",
] as const;

/** Unde se poate trece stoc de pornire: locurile firmei, nu șantierele (S48). */
export const LOCURI_PORNIRE: readonly string[] = [CENTRAL, ATELIER];

export const estePornire = (m: Pick<Miscare, "tip" | "motiv">): boolean => m.tip === "intrare" && m.motiv === MOTIV_PORNIRE;

/** Cantitățile se țin la centimetru (ml, m²), ca soldurile. */
const r2 = (x: number): number => Math.round(x * 100) / 100;

/* ------------------------------------------------------------- inventarul */

export interface LinieNumarata {
  /** Articolul numărat, cu marca dacă o are (soldul e pe cheia întreagă). */
  articol: Articol;
  /** Cât s-a numărat, în unitatea articolului (ml sau m²). Zero = nu mai e nimic. */
  cantitate: number;
  /** Motivul doar pentru linia asta; lipsă = motivul inventarului. */
  motiv?: string;
}

export interface Inventar {
  /** Locul numărat: `central`, `atelier` sau id-ul unui șantier. */
  depozit: string;
  /** Doar ce s-a numărat. Restul materialelor din loc nu se ating. */
  numarat: readonly LinieNumarata[];
  /** De ce diferă (S45): „pierdut”, „furat”, „dus la reciclat” … */
  motiv: string;
  /** Cine a numărat, când; se scrie pe fiecare ajustare. */
  nota?: string;
}

/** Ce arată aplicația pentru un articol într-un loc (soldul, poate negativ). */
export function inAplicatie(miscari: readonly Miscare[], depozit: string, cheie: string): number {
  return solduri(miscari).find((s) => s.depozit === depozit && s.articol.cheie === cheie)?.cantitate ?? 0;
}

/** De ce nu se poate trece inventarul; null = se poate. */
export function valideazaInventar(inv: Inventar): string | null {
  if (!inv.depozit) return "Alege locul în care s-a numărat.";
  if (inv.numarat.length === 0) return "Scrie cel puțin o cantitate numărată.";
  if (inv.numarat.some((l) => !Number.isFinite(l.cantitate) || l.cantitate < 0)) {
    return "Cantitatea numărată trebuie să fie zero sau mai mare.";
  }
  const chei = inv.numarat.map((l) => l.articol.cheie);
  if (new Set(chei).size !== chei.length) return "Același material e scris de două ori.";
  if (inv.numarat.some((l) => !(l.motiv ?? inv.motiv).trim())) {
    return "Alege motivul diferențelor (de exemplu pierdut, furat, dus la reciclat).";
  }
  return null;
}

/**
 * Ajustările care aduc fiecare material numărat la cifra numărată: numărat −
 * ce arată aplicația, cu semn, în locul numărat. Materialul la fel ca în
 * aplicație nu primește nimic; cel nenumărat nu e atins. `id(i)` dă id-ul
 * mișcării pentru linia `i` din `numarat` (pe server, id-urile trimise de
 * browser, deci un inventar retrimis nu se dublează). Aruncă dacă inventarul
 * nu e valid (`valideazaInventar`).
 */
export function ajustariInventar(
  miscari: readonly Miscare[], inv: Inventar, id: (linie: number) => string, data: string,
): Miscare[] {
  const gresit = valideazaInventar(inv);
  if (gresit) throw new Error(gresit);
  const sold = solduri(miscari);
  const out: Miscare[] = [];
  inv.numarat.forEach((l, i) => {
    const arata = sold.find((s) => s.depozit === inv.depozit && s.articol.cheie === l.articol.cheie)?.cantitate ?? 0;
    const numarat = r2(l.cantitate);
    const diferenta = r2(numarat - arata);
    if (diferenta === 0) return;
    const cifra = (x: number): string => String(x).replace(".", ",");
    out.push({
      id: id(i), data, tip: "ajustare", articol: l.articol, cantitate: diferenta, spre: inv.depozit,
      motiv: (l.motiv ?? inv.motiv).trim(),
      nota: [`inventar: numărat ${cifra(numarat)}, aplicația arăta ${cifra(arata)}`, inv.nota?.trim()].filter(Boolean).join(" · "),
    });
  });
  return out;
}

/** Pe scurt, pentru mesajul de după: câte ajustări, câte la fel, câte nenumărate în loc. */
export function rezumatInventar(
  miscari: readonly Miscare[], inv: Pick<Inventar, "depozit" | "numarat">, ajustari: readonly Miscare[],
): { ajustate: number; laFel: number; nenumarate: number } {
  const numarate = new Set(inv.numarat.map((l) => l.articol.cheie));
  const inLoc = solduri(miscari).filter((s) => s.depozit === inv.depozit).map((s) => s.articol.cheie);
  return {
    ajustate: ajustari.length,
    laFel: inv.numarat.length - ajustari.length,
    nenumarate: inLoc.filter((c) => !numarate.has(c)).length,
  };
}

/* -------------------------------------------------------- stocul de pornire */

export interface Pornire {
  /** `central` sau `atelier` (`LOCURI_PORNIRE`). */
  depozit: string;
  articol: Articol;
  /** În unitatea articolului (ml sau m²). */
  cantitate: number;
  /** Euro pe unitate, scris de om. Lipsă = ultimul preț de cumpărare cunoscut. */
  pret?: number;
  nota?: string;
}

export function valideazaPornire(p: Pick<Pornire, "depozit" | "cantitate" | "pret">): string | null {
  if (!LOCURI_PORNIRE.includes(p.depozit)) {
    return "Stocul de pornire se trece doar în depozitul central sau în atelier: șantierele noi pornesc fără material.";
  }
  if (!Number.isFinite(p.cantitate) || p.cantitate <= 0) return "Cantitatea trebuie să fie un număr pozitiv.";
  if (p.pret !== undefined && (!Number.isFinite(p.pret) || p.pret < 0)) return "Prețul trebuie să fie un număr pozitiv.";
  return null;
}

const dataRo = (iso: string): string => {
  const [a, l, z] = iso.slice(0, 10).split("-");
  return `${z}.${l}.${a}`;
};

/**
 * Ultimul preț de cumpărare cunoscut al materialului, în euro pe unitatea
 * articolului: o intrare cu preț din aplicație (nu alt stoc de pornire) sau
 * evidența firmei, oricare e mai nouă. Null = nu s-a cumpărat niciodată.
 */
export function ultimulPretCumparat(
  a: Pick<Articol, "sistem" | "grosime_mm" | "rand" | "forma">, miscari: readonly Miscare[] = [],
  surse: PreturiFurnizori = PRETURI_FURNIZORI,
): { pret: PretAchizitie; sursa: string; data: string } | null {
  const cheie = cheieBaza(a);
  const kg = kgPeMp(a);
  // Evidența e pe unitatea documentului (kg la tablă); stocul, pe m².
  const peUnitate = (v: number): number => (kg !== null ? v * kg : v);
  const r4 = (x: number): number => Math.round(x * 10000) / 10000;
  let gasit: { pret: PretAchizitie; sursa: string; data: string } | null = null;
  for (const p of surse.preturi[cheie] ?? []) {
    if (p.moneda === "RON" && !p.curs) continue;
    if (gasit && gasit.data >= p.data) continue;
    const lei = p.moneda === "RON" ? r4(peUnitate(p.valoare)) : undefined;
    gasit = {
      data: p.data, sursa: `${p.furnizor}, ${p.sursa}`,
      pret: lei !== undefined ? { valoare: r4(lei / p.curs!), lei, curs: p.curs! } : { valoare: r4(peUnitate(p.valoare)) },
    };
  }
  for (const m of miscari) {
    if (m.tip !== "intrare" || m.anuleaza || !m.pret || estePornire(m) || cheieBaza(m.articol) !== cheie) continue;
    if (esteAnulata(m, miscari)) continue;
    const data = (m.document?.data ?? m.data).slice(0, 10);
    if (gasit && gasit.data > data) continue;
    const doc = m.document ? `${m.document.tip} ${[m.document.serie, m.document.numar].filter(Boolean).join(" ")}` : "intrare";
    gasit = { data, sursa: `${m.furnizor ? `${m.furnizor}, ` : ""}${doc} din ${dataRo(data)}`, pret: { ...m.pret } };
  }
  return gasit;
}

/**
 * Intrarea care pune materialul existent în aplicație, marcată „stoc de
 * pornire”. Aruncă dacă nu e validă (`valideazaPornire`).
 */
export function intrareDePornire(
  p: Pornire, miscari: readonly Miscare[], id: string, data: string, surse: PreturiFurnizori = PRETURI_FURNIZORI,
): Miscare {
  const gresit = valideazaPornire(p);
  if (gresit) throw new Error(gresit);
  const dinEvidenta = p.pret === undefined ? ultimulPretCumparat(p.articol, miscari, surse) : null;
  const pret: PretAchizitie | undefined = p.pret !== undefined ? { valoare: p.pret } : dinEvidenta?.pret;
  const nota = [p.nota?.trim(), dinEvidenta ? `preț din ultima cumpărare: ${dinEvidenta.sursa}` : ""].filter(Boolean).join(" · ");
  const m: Miscare = {
    id, data, tip: "intrare", articol: p.articol, cantitate: p.cantitate, spre: p.depozit, motiv: MOTIV_PORNIRE,
    ...(pret ? { pret } : {}), ...(nota ? { nota } : {}),
  };
  const invalid = valideazaMiscare(m);
  if (invalid) throw new Error(invalid);
  return m;
}

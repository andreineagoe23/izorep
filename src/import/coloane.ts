/**
 * Coloanele unei foi, la import (planul UX, Faza 6, punctul 1, 14 noiembrie
 * 2026): ce foi trebuie citite cu modelul, foaia pe fir spre server, ce spune
 * o mapare în cuvinte („cantitatea e în coloana F”) și maparea din alegerea
 * omului.
 *
 * Până acum `propuneMapare` se chema doar din `npm run mapare`, de pe laptop:
 * un client nou, încărcat din ecran, cădea pe euristica de cantitate, cea care
 * dădea 0 din 56 cantități corecte pe oferta semnată (`import.md`).
 *
 * Izomorf, pur: îl folosesc ecranul (ce întreabă, ce arată) și serverul (foaia
 * primită, verificată cu `valideazaMapare`).
 */
import {
  amprentaFoaie, indexAntetFizic, laColoana, MapareFoaie, UM_TOKEN, valideazaMapare,
  type AvertismentMapare, type RolColoana,
} from "./mapare.js";
import type { FoaieBruta, RandBrut } from "./rand.js";

/** A, B, …, Z, AA, AB: litera coloanei, ca în Excel. */
export function literaColoana(i: number): string {
  let n = i + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Foile de întrebat modelul: au rânduri care pot fi poziții, iar antetul lor
 * nu e cunoscut (nici în maparile din repo, nici în cele ale firmei, nici
 * respins deja). O singură foaie pe amprentă: spitalul are șapte foi cu
 * același antet, un apel.
 */
export function foiDeCitit(foi: readonly FoaieBruta[], cunoscute: ReadonlySet<string>): FoaieBruta[] {
  const vazute = new Set<string>();
  const out: FoaieBruta[] = [];
  for (const f of foi) {
    const a = amprentaFoaie(f);
    if (cunoscute.has(a) || vazute.has(a)) continue;
    if (!f.randuri.some((r) => r.linie)) continue;
    vazute.add(a);
    out.push(f);
  }
  return out;
}

/** Foaia, ca pe fir: doar celulele și unde e antetul. Linia extrasă nu pleacă. */
export interface FoaiePeFir {
  nume: string;
  coloane: number;
  antet: number | null;
  randuri: { rand: number; celule: { v: string | number | null; span: number }[] }[];
}

export const foaiePeFir = (f: FoaieBruta): FoaiePeFir => ({
  nume: f.nume, coloane: f.coloane, antet: indexAntetFizic(f),
  randuri: f.randuri.map((r) => ({ rand: r.rand, celule: r.celule.map((c) => ({ v: c.v, span: c.span })) })),
});

export function foaieDinFir(p: FoaiePeFir): FoaieBruta {
  const randuri: RandBrut[] = p.randuri.map((r) => ({ rand: r.rand, celule: r.celule }));
  const antet = p.antet === null ? undefined : randuri[p.antet];
  return { nume: p.nume, coloane: p.coloane, randuri, ...(antet ? { antet } : {}) };
}

/** Coloana cantității și a denumirii, după mapare (null = nu e). */
export function coloaneCitite(m: MapareFoaie): { cantitate: number | null; denumire: number | null } {
  const i = (rol: RolColoana): number | null => {
    const k = m.roluri.indexOf(rol);
    return k >= 0 ? k : null;
  };
  return { cantitate: i("cantitate") ?? i("cantitate_unitara"), denumire: i("denumire") };
}

/** O coloană a foii, pentru alegere: litera și ce scrie deasupra ei. */
export interface ColoanaFoii {
  coloana: number;
  litera: string;
  eticheta: string;
}

/** Rândurile de date: cele care pot fi poziții. */
const randuriDate = (f: FoaieBruta): RandBrut[] => f.randuri.filter((r) => r.linie);

/** Coloanele care au ceva pe rândurile de date, în ordine, cu eticheta din antet. */
export function coloaneFoaie(f: FoaieBruta): ColoanaFoii[] {
  const date = randuriDate(f);
  const out: ColoanaFoii[] = [];
  for (let c = 0; c < f.coloane; c++) {
    if (!date.some((r) => { const v = laColoana(r.celule, c); return v !== null && String(v).trim() !== ""; })) continue;
    const e = f.antet ? laColoana(f.antet.celule, c) : null;
    out.push({ coloana: c, litera: literaColoana(c), eticheta: e === null ? "" : String(e).replace(/\s+/g, " ").trim().slice(0, 40) });
  }
  return out;
}

const plina = (v: string | number | null): v is string | number => v !== null && String(v).trim() !== "";
const numeric = (v: string | number): boolean =>
  typeof v === "number" || (v.trim() !== "" && !Number.isNaN(Number(v.replace(/\s/g, "").replace(",", "."))));

/** Partea din valorile pline ale coloanei care trec testul; null = coloana e goală. */
function parte(date: RandBrut[], c: number, test: (v: string | number) => boolean): number | null {
  const v = date.map((r) => laColoana(r.celule, c)).filter(plina);
  return v.length ? v.filter(test).length / v.length : null;
}

/**
 * Maparea din alegerea omului: coloana cantității și a denumirii.
 *
 * Pornește de la maparea de până acum, dacă e: restul rolurilor rămân. Fără
 * ea, unitatea de măsură e coloana plină de „ml”, „buc”, „mp”, iar celelalte
 * coloane de text intră ca observații, ca textul poziției să nu piardă
 * dimensiunea sau a doua descriere (Matari, Book15).
 */
export function mapareAleasa(
  f: FoaieBruta, veche: MapareFoaie | undefined, alegere: { cantitate: number; denumire: number },
): MapareFoaie {
  const date = randuriDate(f);
  const roluri: RolColoana[] = Array.from({ length: f.coloane }, (_, i) => veche?.roluri[i] ?? "ignora");
  for (let i = 0; i < roluri.length; i++) {
    if (roluri[i] === "cantitate" || roluri[i] === "cantitate_unitara" || roluri[i] === "denumire") roluri[i] = "ignora";
  }
  if (!veche) {
    for (let i = 0; i < roluri.length; i++) {
      if ((parte(date, i, (v) => typeof v === "string" && UM_TOKEN.test(v.trim())) ?? 0) >= 0.6) roluri[i] = "um";
      else if ((parte(date, i, (v) => typeof v === "string" && !numeric(v) && v.trim().length > 3) ?? 0) >= 0.6) {
        roluri[i] = "observatii";
      }
    }
  }
  roluri[alegere.cantitate] = "cantitate";
  roluri[alegere.denumire] = "denumire";
  const antet = veche?.rand_antet ?? indexAntetFizic(f);
  const primul = f.randuri.findIndex((r) => r.linie);
  const start = veche?.rand_start ?? (antet !== null ? antet + 1 : Math.max(primul, 0));
  return { rand_antet: antet, rand_start: start, roluri, motiv: "coloane alese de om" };
}

/** Ce n-a trecut de verificare, în cuvinte pentru om; gol = maparea se poate folosi. */
export function problemaAlegerii(f: FoaieBruta, m: MapareFoaie): string | null {
  const av: AvertismentMapare[] = valideazaMapare(f, m);
  if (av.length === 0) return null;
  const c = coloaneCitite(m);
  if (av.some((a) => a.rol === "cantitate" && a.coloana === c.cantitate)) {
    return `În coloana ${literaColoana(c.cantitate ?? 0)} nu sunt cifre pe cele mai multe rânduri: nu poate fi cantitatea.`;
  }
  if (av.some((a) => a.rol === "denumire" && a.coloana === c.denumire)) {
    return `În coloana ${literaColoana(c.denumire ?? 0)} nu e text pe cele mai multe rânduri: nu poate fi denumirea.`;
  }
  return "Coloanele alese nu se potrivesc cu ce e scris în foaie.";
}

/** Maparea primită de pe fir, verificată ca formă (ca la model). */
export const mapareValida = (v: unknown): MapareFoaie => MapareFoaie.parse(v);

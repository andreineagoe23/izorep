/**
 * Situația de lucrări începută și nesalvată, pe șantier, în browser
 * (15 noiembrie 2026). Ce scria omul în „Situație nouă” (cantitățile, data,
 * nota, alegerile „De ales” venite din poze) stătea doar în memoria paginii și
 * se pierdea la reîncărcare; iar pe Acasă nu se vedea că a rămas ceva la
 * jumătate.
 *
 * Doar în acest browser (`localStorage`): pe alt calculator situația începută
 * nu se vede. Se șterge la „Salvează” și la „Renunță”.
 *
 * Best-effort, ca `meniu-stare.ts`: fără stocare (fereastră privată, stocare
 * blocată) ecranul merge ca înainte, doar reîncărcarea pierde ce era scris.
 * Depozitul e injectabil, pentru teste.
 */
import type { Potrivire } from "../src/lucrari/potrivire.js";
import type { PlanSantier, Situatie } from "../src/lucrari/situatii.js";

export const CHEIE_SITUATII = "izorep-situatii-incepute";

export interface SituatieInceputa {
  situatie: Situatie;
  /** Venită din poze: ce e încă „De ales” și ce nu e în ofertă. */
  dinPoze: Potrivire | null;
  /** ISO, ultima schimbare. */
  cand: string;
}

type Toate = Record<string, SituatieInceputa>;

const alege = (d?: Storage): Storage | null => {
  if (d) return d;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

function citesteToate(d?: Storage): Toate {
  try {
    const t = alege(d)?.getItem(CHEIE_SITUATII);
    if (!t) return {};
    const v = JSON.parse(t) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Toate) : {};
  } catch {
    return {};
  }
}

function scrieToate(t: Toate, d?: Storage): void {
  try {
    const dep = alege(d);
    if (!dep) return;
    if (Object.keys(t).length === 0) dep.removeItem(CHEIE_SITUATII);
    else dep.setItem(CHEIE_SITUATII, JSON.stringify(t));
  } catch { /* cotă sau stocare blocată: situația rămâne pe ecran, doar nu trece de reîncărcare */ }
}

/**
 * Are omul ceva scris în ea? O situație doar deschisă („Situație nouă” apăsat,
 * nimic scris) nu e lucru lăsat la jumătate.
 */
export const areContinut = (s: Situatie, dinPoze: Potrivire | null): boolean =>
  Object.values(s.cantitati).some((x) => Number.isFinite(x) && x !== 0) || !!s.nota?.trim() || !!dinPoze;

/** Ce e început pe șantier, sau nimic. */
export function citesteInceputa(plan: string, d?: Storage): SituatieInceputa | null {
  const x = citesteToate(d)[plan];
  if (!x || !x.situatie || typeof x.situatie !== "object" || typeof x.cand !== "string") return null;
  return { situatie: x.situatie, dinPoze: x.dinPoze ?? null, cand: x.cand };
}

/** Toate situațiile începute, pe id-ul șantierului. */
export function situatiiIncepute(d?: Storage): Record<string, SituatieInceputa> {
  const t = citesteToate(d);
  const out: Record<string, SituatieInceputa> = {};
  for (const k of Object.keys(t)) {
    const x = citesteInceputa(k, d);
    if (x) out[k] = x;
  }
  return out;
}

/** Scrie situația în lucru; fără nimic scris în ea, o scoate. */
export function tineSituatia(plan: string, s: Situatie, dinPoze: Potrivire | null, cand: string, d?: Storage): void {
  const t = citesteToate(d);
  if (areContinut(s, dinPoze)) t[plan] = { situatie: s, dinPoze, cand };
  else delete t[plan];
  scrieToate(t, d);
}

export function uitaSituatia(plan: string, d?: Storage): void {
  const t = citesteToate(d);
  if (!(plan in t)) return;
  delete t[plan];
  scrieToate(t, d);
}

/**
 * Situația refăcută pe planul de acum: numărul următor (un coleg poate fi
 * salvat între timp una), doar pozițiile care mai există. Pe un șantier închis
 * sau dispărut, nimic.
 */
export function refaPePlan(x: SituatieInceputa, p: PlanSantier | undefined): SituatieInceputa | null {
  if (!p || p.inchis) return null;
  const nr = new Set(p.pozitii.map((z) => z.nr));
  const cantitati: Record<number, number> = {};
  for (const [k, v] of Object.entries(x.situatie.cantitati)) if (nr.has(Number(k))) cantitati[Number(k)] = v;
  return { ...x, situatie: { ...x.situatie, nr: p.situatii.length + 1, cantitati } };
}

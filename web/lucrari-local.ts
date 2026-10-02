/**
 * Planurile de santier ale prototipului, pastrate in browser.
 *
 * Ca `depozit-local.ts`: doar pentru prototip, in `localStorage`, deci le vede
 * doar browserul in care au fost facute. Logica (valori, cumulat, istoric) e
 * in `src/lucrari/situatii.ts`, pura; aici e doar pastrarea. Best-effort:
 * blocat sau stricat, ecranul porneste gol, nu cade.
 */
import type { PlanSantier } from "../src/lucrari/situatii.js";

export const CHEIE_LUCRARI = "izorep-lucrari";

const alege = (d?: Storage): Storage | null => {
  if (d) return d;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export function citestePlanuri(d?: Storage): PlanSantier[] {
  try {
    const brut = alege(d)?.getItem(CHEIE_LUCRARI);
    if (!brut) return [];
    const s = JSON.parse(brut) as { planuri?: unknown };
    return Array.isArray(s.planuri) ? (s.planuri as PlanSantier[]) : [];
  } catch {
    return [];
  }
}

/** Intoarce fals cand nu s-a putut scrie: ecranul spune ca nu se pastreaza. */
export function scriePlanuri(planuri: PlanSantier[], d?: Storage): boolean {
  try {
    const dep = alege(d);
    if (!dep) return false;
    dep.setItem(CHEIE_LUCRARI, JSON.stringify({ planuri }));
    return true;
  } catch {
    return false;
  }
}

/** Santierul de deschis cand se ajunge pe ecranul Lucrari (dupa „Creeaza santierul"). Se ia o data. */
let deDeschis: string | null = null;
export const deschideLaIntrare = (id: string): void => { deDeschis = id; };
export const iaDeDeschis = (): string | null => { const id = deDeschis; deDeschis = null; return id; };

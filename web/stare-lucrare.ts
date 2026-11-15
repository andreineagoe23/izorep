/**
 * Starea unei lucrări din datele de acum (cererea, oferta, șantierul, depozitul),
 * cât trebuie ca `urmeaza` și `deFacutLucrare` (`web/lucrare.ts`) să spună ce
 * urmează. Un singur loc pentru pagina lucrării, lista Lucrări și Acasă, ca să
 * nu spună lucruri diferite (planul UX, Faza 5, 15 noiembrie 2026; până atunci
 * stătea în `ecrane/lucrari.ts`).
 */
import { ramasPeNecesar } from "./materiale.js";
import { deVerificatCerere, refuzata, ziRo, type Lucrare, type StareLucrare } from "./lucrare.js";
import { progresPlan, type PlanSantier } from "../src/lucrari/situatii.js";
import type { StareDepozit } from "./depozit-local.js";
import { situatiiIncepute, type SituatieInceputa } from "./situatie-local.js";

/**
 * Câte materiale mai sunt de comandat pe șantier, ca în Materiale, câte nu
 * sunt încă toate pe șantier (lipsesc, în ciornă, comandate și nevenite) și
 * câte așteaptă doar trimiterea ciornei; pe unul închis, nimic.
 */
export function materialePlan(p: PlanSantier, dep: StareDepozit): { deComandat: number; neadus: number; deTrimis: number } {
  if (p.inchis) return { deComandat: 0, neadus: 0, deTrimis: 0 };
  const n = dep.necesare.find((x) => x.santier === p.id);
  if (!n) return { deComandat: 0, neadus: 0, deTrimis: 0 };
  const r = ramasPeNecesar(dep, n);
  return {
    deComandat: r.filter((d) => d.ramas > 0).length,
    neadus: r.filter((d) => !d.material.alClientului && (d.ramas > 0 || d.comandat > 0 || d.inCiorna > 0)).length,
    deTrimis: r.filter((d) => !d.material.alClientului && d.ramas <= 0 && d.inCiorna > 0).length,
  };
}

/**
 * `incepute`: situațiile începute și nesalvate, pe șantier (din acest browser,
 * `situatie-local.ts`); implicit cele ținute acum.
 */
export function stareLucrarii(
  l: Lucrare, dep: StareDepozit, incepute: Readonly<Record<string, SituatieInceputa>> = situatiiIncepute(),
): StareLucrare {
  const inc = l.plan && !l.plan.inchis ? incepute[l.plan.id] : undefined;
  return {
    deVerificat: l.cerere ? deVerificatCerere(l.cerere) : 0,
    areCerere: !!l.cerere,
    oferta: l.oferta ? { numar: l.oferta.numar, data: l.oferta.data || ziRo(l.oferta.cand), cand: l.oferta.cand } : undefined,
    refuzat: refuzata(l),
    santier: l.plan ? {
      inchis: l.plan.inchis, ...materialePlan(l.plan, dep), progres: progresPlan(l.plan),
      ultimaSituatie: l.plan.situatii.at(-1)?.data ?? l.plan.creat,
      ...(inc ? { inceputa: { nr: l.plan.situatii.length + 1, cand: inc.cand } } : {}),
    } : undefined,
  };
}

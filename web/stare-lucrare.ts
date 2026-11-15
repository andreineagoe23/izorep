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

/**
 * Câte materiale mai sunt de comandat pe șantier, ca în Materiale, și câte nu
 * sunt încă toate pe șantier (lipsesc, în ciornă, comandate și nevenite); pe
 * unul închis, nimic.
 */
export function materialePlan(p: PlanSantier, dep: StareDepozit): { deComandat: number; neadus: number } {
  if (p.inchis) return { deComandat: 0, neadus: 0 };
  const n = dep.necesare.find((x) => x.santier === p.id);
  if (!n) return { deComandat: 0, neadus: 0 };
  const r = ramasPeNecesar(dep, n);
  return {
    deComandat: r.filter((d) => d.ramas > 0).length,
    neadus: r.filter((d) => !d.material.alClientului && (d.ramas > 0 || d.comandat > 0 || d.inCiorna > 0)).length,
  };
}

export function stareLucrarii(l: Lucrare, dep: StareDepozit): StareLucrare {
  return {
    deVerificat: l.cerere ? deVerificatCerere(l.cerere) : 0,
    areCerere: !!l.cerere,
    oferta: l.oferta ? { numar: l.oferta.numar, data: l.oferta.data || ziRo(l.oferta.cand), cand: l.oferta.cand } : undefined,
    refuzat: refuzata(l),
    santier: l.plan ? {
      inchis: l.plan.inchis, ...materialePlan(l.plan, dep), progres: progresPlan(l.plan),
      ultimaSituatie: l.plan.situatii.at(-1)?.data ?? l.plan.creat,
    } : undefined,
  };
}

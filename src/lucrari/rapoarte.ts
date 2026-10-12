/**
 * Faza 7: ce vede directorul (S49: „o listă săptămânală, o alertă când
 * lipsește ceva, cifrele la sfârșitul lucrării?” — „toate”).
 *
 * Trei bucati, toate pe datele care exista deja (planuri, miscari, comenzi,
 * necesaruri), fara nimic scris in plus:
 *
 * - **lista saptamanala**: pe fiecare santier, ce s-a intamplat in ultimele 7
 *   zile (situatii, material venit, comenzi trimise, inchiderea);
 * - **alertele**: lipsa pe santier, comenzile nereceptionate, pierderea peste
 *   10 % (din consumul Fazei 6: `pierderiPestePrag`);
 * - **cifrele la inchidere**: costul materialului fata de oferta, pe fiecare
 *   santier inchis (`cifreInchidere`).
 *
 * Emailul nu: vine odata cu conturile (docs/plan-implementare.md, Faza 7).
 *
 * Pur, fara I/O: ruleaza la fel in browser si in teste.
 */
import { bani } from "../pricing/engine.js";
import { CERE, cheieBaza, pretMediu, type Miscare } from "../stoc/registru.js";
import { adus, comandatNesosit, stareComanda, type Comanda } from "../stoc/comenzi.js";
import type { MaterialNecesar } from "../stoc/necesar.js";
import { consumSantier } from "../stoc/consum.js";
import { cifreInchidere, materialSantier, type CifreInchidere } from "./inchidere.js";
import { totalSituatie, type PlanSantier } from "./situatii.js";

/** Ce citesc rapoartele din depozit (forma `StareDepozit` din browser). */
export interface DateRapoarte {
  miscari: readonly Miscare[];
  necesare: readonly { santier?: string; materiale: readonly MaterialNecesar[] }[];
  comenzi?: readonly Comanda[];
}

/** Lista e pe ultimele 7 zile, nu pe saptamana din calendar: luni dimineata n-ar fi goala. */
export const ZILE_LISTA = 7;

/**
 * O comanda trimisa e „nereceptionata” dupa 7 zile. Singura comanda reala pe
 * care o avem, TRANSAVIA (Isoline, cochilii ø140), a venit in 4 zile: trimisa
 * pe 13 iulie 2026, avizul pe 17 iulie. 7 zile = peste ce s-a vazut, pe
 * ritmul listei saptamanale; mai devreme, fiecare comanda proaspata ar aparea
 * ca alerta.
 */
export const ZILE_COMANDA = 7;

const ZI = 24 * 60 * 60 * 1000;
const zileIntre = (de: string, pana: string): number => Math.floor((Date.parse(pana) - Date.parse(de)) / ZI);

export const materialePe = (d: DateRapoarte, santier: string): MaterialNecesar[] =>
  d.necesare.filter((n) => n.santier === santier).flatMap((n) => [...n.materiale]);

/* ------------------------------------------------------ lista saptamanala */

export interface RandSaptamana {
  santier: string;
  denumire: string;
  /** Situatiile emise in perioada si valoarea lor (in perioada, nu cumulat). */
  situatii: number;
  executat: number;
  /** Intrarile si transferurile care au ajuns pe santier. */
  livrari: number;
  /** Valoarea lor, la pretul intrarii sau la pretul mediu (EUR). */
  valoareVenita: number;
  /** Comenzile trimise pentru santier in perioada. */
  comenziTrimise: number;
  /** S-a inchis in perioada. */
  inchis: boolean;
}

export interface ListaSaptamanala {
  /** ISO, inceputul perioadei (inclusiv) si sfarsitul ei (azi). */
  de: string;
  pana: string;
  randuri: RandSaptamana[];
}

/** Ce s-a intamplat pe fiecare santier in ultimele 7 zile; santierele fara nimic nu apar. */
export function listaSaptamanala(planuri: readonly PlanSantier[], d: DateRapoarte, azi: string): ListaSaptamanala {
  const pana = Date.parse(azi);
  const de = pana - ZILE_LISTA * ZI;
  const inPerioada = (iso?: string): boolean => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return t > de && t <= pana;
  };
  const anulate = new Set(d.miscari.filter((m) => m.anuleaza).map((m) => m.anuleaza!));
  const randuri: RandSaptamana[] = [];
  for (const p of planuri) {
    const situatii = p.situatii.filter((s) => inPerioada(s.data));
    let livrari = 0;
    let valoare = 0;
    for (const m of d.miscari) {
      if (m.anuleaza || anulate.has(m.id) || m.spre !== p.id || !CERE[m.tip].spre || m.tip === "ajustare" || !inPerioada(m.data)) continue;
      livrari++;
      const pret = m.tip === "intrare" && m.pret ? m.pret.valoare : pretMediu(d.miscari, cheieBaza(m.articol));
      valoare += (pret ?? 0) * m.cantitate;
    }
    const comenziTrimise = (d.comenzi ?? []).filter((c) => (c.santier === p.id || c.spre === p.id) && inPerioada(c.trimisa)).length;
    const inchis = inPerioada(p.inchis);
    if (situatii.length === 0 && livrari === 0 && comenziTrimise === 0 && !inchis) continue;
    randuri.push({
      santier: p.id, denumire: p.denumire, situatii: situatii.length,
      executat: bani(situatii.reduce((t, s) => t + totalSituatie(p, s).curent.total, 0)),
      livrari, valoareVenita: bani(valoare), comenziTrimise, inchis,
    });
  }
  return { de: new Date(de).toISOString(), pana: new Date(pana).toISOString(), randuri };
}

/* ---------------------------------------------------------------- alertele */

export type Alerta =
  /** Pe santier lipseste material pentru lucrarea ramasa, desi necesarul e adus sau comandat tot. */
  | { fel: "lipsa"; santier: string; denumire: string; materiale: number }
  /** Comanda trimisa de cel putin `ZILE_COMANDA` zile, care n-a venit toata. */
  | { fel: "comanda"; comanda: string; furnizor: string; pentru: string; trimisa: string; zile: number; partial: boolean }
  /** Pierdere peste prag (S42: 10 % pe total), din consumul Fazei 6. */
  | { fel: "pierdere"; santier: string; denumire: string; procent: number };

/**
 * Pierderea peste 10 % pe un santier deschis (S42). Consumul calculat din
 * situatii si pierderea vin din `consumSantier` (Faza 6); aici doar se pun la
 * „Necesită atenția ta”, langa celelalte alerte. Santierul inchis nu mai
 * alerteaza: cifrele lui stau pe cardul „Șantiere închise”.
 */
export function pierderiPestePrag(planuri: readonly PlanSantier[], d: DateRapoarte): Extract<Alerta, { fel: "pierdere" }>[] {
  return planuri.flatMap((p) => {
    if (p.inchis) return [];
    const c = consumSantier(p, materialePe(d, p.id), d.miscari);
    return c.pestePrag && c.pierdereProcent !== null
      ? [{ fel: "pierdere" as const, santier: p.id, denumire: p.denumire, procent: c.pierdereProcent }]
      : [];
  });
}

/**
 * Lipsa pe santier, fara sa repete „de comandat”: un material conteaza doar
 * cand necesarul lui e deja adus sau comandat tot si totusi lucrarea ramasa
 * cere mai mult decat e pe santier si pe drum (s-a pus mai mult decat in
 * calcul). Inainte de asta, lipsa e chiar „Rămas de comandat”, care are
 * alerta lui pe tablou.
 */
export function lipsaPeSantier(p: PlanSantier, d: DateRapoarte): number {
  if (p.inchis) return 0;
  const necesar = materialePe(d, p.id);
  if (necesar.length === 0) return 0;
  const comenzi = d.comenzi ?? [];
  return materialSantier(p, necesar, d.miscari, comenzi).randuri.filter((r) => {
    if (r.lipsa <= 0 || r.necesar <= 0) return false;
    const deComandat = r.necesar - adus(d.miscari, p.id, r.cheie) - comandatNesosit(comenzi, d.miscari, p.id, r.cheie);
    return deComandat <= 0.005;
  }).length;
}

/** Alertele, in ordinea in care cer ceva: lipsa, pierderea, comenzile. */
export function alerte(planuri: readonly PlanSantier[], d: DateRapoarte, azi: string): Alerta[] {
  const out: Alerta[] = [];
  for (const p of planuri) {
    const materiale = lipsaPeSantier(p, d);
    if (materiale > 0) out.push({ fel: "lipsa", santier: p.id, denumire: p.denumire, materiale });
  }
  out.push(...pierderiPestePrag(planuri, d));
  const nume = new Map(planuri.map((p) => [p.id, p.denumire]));
  const comenzi = [...(d.comenzi ?? [])].sort((a, b) => (a.trimisa ?? "").localeCompare(b.trimisa ?? ""));
  for (const c of comenzi) {
    if (!c.trimisa || c.anulata) continue;
    const st = stareComanda(c, d.miscari);
    if (st !== "trimisa" && st !== "partial") continue;
    const zile = zileIntre(c.trimisa, azi);
    if (zile < ZILE_COMANDA) continue;
    const pentru = c.santier ? (nume.get(c.santier) ?? c.santier) : "";
    out.push({ fel: "comanda", comanda: c.id, furnizor: c.furnizor, pentru, trimisa: c.trimisa, zile, partial: st === "partial" });
  }
  return out;
}

/* --------------------------------------------------- santierele inchise */

export interface SantierInchis {
  plan: PlanSantier;
  cifre: CifreInchidere;
}

/** Santierele inchise, cel mai nou intai, cu cifrele lor. */
export function santiereInchise(planuri: readonly PlanSantier[], d: DateRapoarte): SantierInchis[] {
  return planuri.filter((p) => p.inchis)
    .sort((a, b) => b.inchis!.localeCompare(a.inchis!))
    .map((plan) => ({ plan, cifre: cifreInchidere(plan, materialePe(d, plan.id), d.miscari) }));
}
